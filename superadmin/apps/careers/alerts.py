"""Telling people about applications (brief 7.5).

- The hiring team: an in-app notification for each new application ("{Name} applied for {role}") and an
  internal email through the existing mailer, deduplicated to one email per role per 10 minutes that
  lists every new application in the window. Links go to the admin (never a login token). Recipients
  are the careers notification recipients, else every active super admin; outside the ``log`` transport
  only ``@vitalos.co.uk`` addresses are emailed. Emails count towards RESEND_DAILY_LIMIT with the
  enquiry emails.
- Candidates: receipt, rejection and invitation emails on the shared layout, sent ONLY when
  ``CAREERS_CANDIDATE_EMAILS_ENABLED=true`` (off; owner approval).
"""

import logging
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Q, Sum
from django.utils import timezone

from apps.accounts.roles import SUPERADMIN
from apps.audit.services import record
from apps.mailer import layout
from apps.mailer.messages import build_message
from apps.notifications.services import notify

from . import access
from . import config as careers_config
from .models import Application, ApplicationEvent, ApplicationEventType, CareersAlertEmail

logger = logging.getLogger(__name__)

WINDOW = timedelta(minutes=10)
NOTIFICATION_KIND = "careers_application"
INTERNAL_DOMAIN = "@vitalos.co.uk"


class EmailsOff(Exception):
    """Candidate emails are switched off (CAREERS_CANDIDATE_EMAILS_ENABLED is false)."""


def detail_url(application_id) -> str:
    return f"/careers/applications/{application_id}/"


def sender() -> str:
    return settings.CAREERS_EMAIL_FROM or settings.NOTIFY_FROM_HEADER


def recipients() -> list:
    """Users who hear about new applications (and may read them)."""
    User = get_user_model()
    chosen = careers_config.load()["notification_recipients"]
    if chosen:
        users = User.objects.filter(pk__in=chosen, is_active=True)
    else:
        users = User.objects.filter(is_active=True).filter(Q(is_superuser=True) | Q(groups__name=SUPERADMIN))
    return [user for user in users.distinct().order_by("email") if access.can_view_applications(user)]


def email_allowed(address: str) -> bool:
    return settings.EMAIL_TRANSPORT == "log" or address.lower().endswith(INTERNAL_DOMAIN)


def emails_sent_today(now) -> int:
    from apps.enquiries.notifications import _start_of_day
    from apps.enquiries.notifications import emails_sent_today as enquiry_emails

    start = _start_of_day(now)
    careers = CareersAlertEmail.objects.filter(sent_at__gte=start).aggregate(n=Sum("recipients"))["n"] or 0
    candidate = ApplicationEvent.objects.filter(type=ApplicationEventType.EMAIL_SENT, at__gte=start).count()
    return enquiry_emails(now) + careers + candidate


def application_received(application_id) -> None:
    application = Application.objects.select_related("role").filter(pk=application_id).first()
    if application is None:
        return
    role_title = application.role.title if application.role else "a speculative application"
    notify(
        recipients(),
        NOTIFICATION_KIND,
        f"{application.name} applied for {role_title}"[:200],
        url=detail_url(application.pk),
    )
    flush(timezone.now())
    if settings.CAREERS_CANDIDATE_EMAILS_ENABLED:
        try:
            send_candidate_email(application, "receipt", actor=None)
        except Exception:  # noqa: BLE001
            logger.warning("Candidate receipt email failed", extra={"application_id": str(application.pk)})


def flush(now=None) -> int:
    """Send the due alert emails: one per role, at most one per role per 10 minutes. Returns emails sent."""
    now = now or timezone.now()
    pending = Application.objects.filter(alert_emailed_at__isnull=True).select_related("role")
    role_ids = list(pending.order_by().values_list("role_id", flat=True).distinct())
    sent = 0
    for role_id in role_ids:
        recent = CareersAlertEmail.objects.filter(role_id=role_id, sent_at__gt=now - WINDOW).exists()
        if recent:
            continue  # the next tick after the window sends everything that arrived meanwhile
        to = [user.email for user in recipients() if email_allowed(user.email)]
        if not to:
            continue
        if emails_sent_today(now) + len(to) > settings.RESEND_DAILY_LIMIT:
            logger.warning("Daily email limit reached; careers alerts wait", extra={"role_id": str(role_id)})
            break
        with transaction.atomic():
            rows = list(
                pending.filter(role_id=role_id).select_for_update(skip_locked=True).order_by("created_at")
            )
            if not rows:
                continue
            role_title = rows[0].role.title if rows[0].role else "Speculative applications"
            subject = (
                f"New application: {role_title}"
                if len(rows) == 1
                else f"{len(rows)} new applications: {role_title}"
            )
            lines = [
                f"- {row.name}, received {timezone.localtime(row.created_at):%d %b %Y %H:%M}"
                f"{' (possible duplicate)' if row.duplicate_of_id else ''}\n"
                f"  {settings.APP_BASE_URL}{detail_url(row.pk)}"
                for row in rows
            ]
            body = (
                f"New applications for {role_title}:\n\n"
                + "\n".join(lines)
                + "\n\nOpen them in the Super Admin."
            )
            delivered = 0
            for address in to:
                try:
                    EmailMessage(
                        subject=subject[:200],
                        body=body,
                        from_email=sender(),
                        to=[address],
                        headers={"Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All"},
                    ).send(fail_silently=False)
                    delivered += 1
                except Exception:  # noqa: BLE001 - one recipient must not stop the others
                    logger.warning("Careers alert email failed", extra={"role_id": str(role_id)})
            Application.objects.filter(pk__in=[row.pk for row in rows]).update(alert_emailed_at=now)
            CareersAlertEmail.objects.create(
                role_id=role_id, sent_at=now, recipients=delivered, applications=len(rows)
            )
            sent += 1
    return sent


# --- Candidate emails ----------------------------------------------------------------------------


def candidate_email(application: Application | None, kind: str, config: dict | None = None) -> dict:
    """Subject and layout document for one candidate email (also used by the settings preview)."""
    config = config or careers_config.load()
    name = application.name if application else "Example Candidate"
    role = application.role.title if application and application.role else "Example role (fixture)"
    subject = config[f"email_{kind}_subject"].replace("{name}", name).replace("{role}", role)
    body = config[f"email_{kind}_body"].replace("{name}", name).replace("{role}", role)
    from apps.email_templates.rendering import company_footer

    facts, social = company_footer()
    doc = {
        "title": subject,
        "preheader": subject,
        "headerLabel": "Careers",
        "blocks": [{"type": "text", "text": body}, {"type": "signature", "name": "Vitalos"}],
        "footer": {"company": facts, "social": social},
    }
    return {"subject": subject, "doc": doc}


def preview_html(kind: str, config: dict | None = None) -> str:
    rendered = layout.render_email(candidate_email(None, kind, config)["doc"])
    html = rendered.html
    for img in rendered.inline_images:
        html = html.replace(f"cid:{img['contentId']}", f"data:{img['contentType']};base64,{img['base64']}")
    return html


def send_candidate_email(application: Application, kind: str, *, actor, request=None) -> None:
    """Send one candidate email. Refused while CAREERS_CANDIDATE_EMAILS_ENABLED is false."""
    if not settings.CAREERS_CANDIDATE_EMAILS_ENABLED:
        raise EmailsOff
    if kind not in careers_config.EMAIL_KINDS:
        raise ValueError("Unknown candidate email")
    if emails_sent_today(timezone.now()) >= settings.RESEND_DAILY_LIMIT:
        raise RuntimeError("The daily email limit is reached. Try again tomorrow.")
    email = candidate_email(application, kind)
    message = build_message(
        layout.render_email(email["doc"]),
        subject=email["subject"][:200],
        to=[application.email],
        from_email=sender(),
        headers={"Auto-Submitted": "auto-generated"},
    )
    message.send(fail_silently=False)
    ApplicationEvent.objects.create(
        application=application, actor_admin=actor, type=ApplicationEventType.EMAIL_SENT, meta={"kind": kind}
    )
    record(
        "careers.candidate_emailed",
        request=request,
        actor=actor,
        entity=application,
        summary=f"Sent the {kind} email",
        kind=kind,
    )
