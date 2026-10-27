"""Business rules for Mail > Outreach (DECISIONS 121-126). Views call these; they re-check the role.

The queue sends one email at a time from the content tick (ADR-042): only while a person has pressed
Start, on weekdays from 09:00 to 17:00 London time, up to the daily cap, with a random 3 to 8 minute gap
between emails. It sends only through the outreach mailbox (OUTREACH_SMTP_*), never Resend, whose
acceptable use policy forbids cold outreach (DECISIONS 120).
"""

from __future__ import annotations

import csv
import io
import logging
import secrets
from dataclasses import dataclass, field
from datetime import datetime, time, timedelta
from email.utils import formataddr, make_msgid
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.db.models import Count
from django.utils import timezone

from apps.audit.services import record
from apps.email_templates import services as template_services
from apps.email_templates.models import EmailSuppression, EmailTemplate, Kind
from apps.email_templates.rendering import unsubscribe_url
from apps.mailer.backends import outreach_connection
from apps.mailer.layout import clean_line
from apps.mailer.messages import build_message

from . import imports
from .models import Contact, OutreachSettings

logger = logging.getLogger("superadmin.mail")

LONDON = ZoneInfo("Europe/London")
WINDOW_START, WINDOW_END = time(9, 0), time(17, 0)
GAP_SECONDS = (3 * 60, 8 * 60)
DAILY_CAP_MAX = 50
FAILURES_BEFORE_PAUSE = 3
DEFAULT_TEMPLATE_KEY = "outreach-small-business-free-plan"


def require_superadmin(user) -> None:
    template_services.require_superadmin(user)


# --- Import ------------------------------------------------------------------------------------------


@dataclass
class ImportResult:
    added: int = 0
    total: int = 0
    skipped: dict[str, int] = field(default_factory=dict)

    @property
    def summary(self) -> str:
        parts = [f"Queued {self.added} of {self.total} row{'s' if self.total != 1 else ''}."]
        parts += [f"{reason}: {count}." for reason, count in self.skipped.items()]
        return " ".join(parts)


@transaction.atomic
def import_contacts(
    upload, *, user, only_new=True, corporate_only=True, no_website_only=False, request=None
) -> ImportResult:
    """Queues the export's leads. An address already held (in any state) or unsubscribed is left out."""
    require_superadmin(user)
    parsed = imports.parse(
        upload, only_new=only_new, corporate_only=corporate_only, no_website_only=no_website_only
    )
    skipped = parsed.skipped
    emails = [row.email for row in parsed.rows]
    known = set(Contact.objects.filter(email__in=emails).values_list("email", flat=True))
    suppressed = set(EmailSuppression.objects.filter(email__in=emails).values_list("email", flat=True))
    added = 0
    for row in parsed.rows:
        if row.email in suppressed:
            skipped["Unsubscribed from Vitalos email"] += 1
        elif row.email in known:
            skipped["Already loaded before"] += 1
        else:
            try:
                with transaction.atomic():
                    Contact.objects.create(
                        email=row.email,
                        first_name=row.first_name,
                        business=row.business,
                        entity_type=row.entity_type,
                        lead_ref=row.lead_ref,
                        imported_by=user,
                    )
            except IntegrityError:  # loaded by a parallel import a moment ago
                skipped["Already loaded before"] += 1
                continue
            added += 1
    result = ImportResult(added=added, total=parsed.total, skipped=dict(skipped))
    record("outreach.imported", request=request, actor=user, summary=result.summary[:300])
    return result


# --- Settings, start and pause -----------------------------------------------------------------------


def default_template():
    return EmailTemplate.objects.filter(key=DEFAULT_TEMPLATE_KEY).first()


def load_settings() -> OutreachSettings:
    current = OutreachSettings.load()
    if current.template_id is None:
        template = default_template()
        if template is not None:
            OutreachSettings.objects.filter(pk=current.pk, template__isnull=True).update(template=template)
            current.refresh_from_db()
    return current


def templates():
    """Templates the queue may send: outreach kind (so the footer carries an unsubscribe link)."""
    return EmailTemplate.objects.filter(kind=Kind.OUTREACH).exclude(status="archived").order_by("name")


def update_settings(*, user, template_id, daily_cap, request=None) -> OutreachSettings:
    require_superadmin(user)
    template = templates().filter(pk=template_id).first() if str(template_id).isdigit() else None
    if template is None:
        raise ValidationError("Choose an outreach template.")
    if not 1 <= daily_cap <= DAILY_CAP_MAX:
        raise ValidationError(f"The daily limit must be between 1 and {DAILY_CAP_MAX}.")
    current = load_settings()
    current.template, current.daily_cap = template, daily_cap
    current.save(update_fields=["template", "daily_cap", "updated_at"])
    record(
        "outreach.settings_changed",
        request=request,
        actor=user,
        summary=f"{template.name}, {daily_cap} a day",
    )
    return current


def mailbox_ready() -> bool:
    return outreach_connection() is not None


def sends_for_real() -> bool:
    """False in development and tests (EMAIL_TRANSPORT=log with no mailbox): nothing leaves."""
    return mailbox_ready() or settings.EMAIL_TRANSPORT == "resend"


def start_problems(current: OutreachSettings) -> list[str]:
    problems = []
    template = current.template
    if template is None:
        problems.append("Choose an outreach template.")
    elif template.kind != Kind.OUTREACH or not template_services.can_use(template):
        problems.append("The chosen template is archived or not an outreach template.")
    if not mailbox_ready() and settings.EMAIL_TRANSPORT == "resend":
        problems.append(
            "No outreach mailbox is set up (OUTREACH_SMTP_*). Outreach never goes through Resend, whose "
            "acceptable use policy forbids cold email."
        )
    return problems


def start(*, user, request=None) -> None:
    require_superadmin(user)
    current = load_settings()
    problems = start_problems(current)
    if problems:
        raise ValidationError(problems)
    current.paused, current.started_by = False, user
    current.consecutive_failures, current.last_error = 0, ""
    current.save(update_fields=["paused", "started_by", "consecutive_failures", "last_error", "updated_at"])
    record("outreach.started", request=request, actor=user, summary=f"{current.daily_cap} a day")


def pause(*, user, request=None) -> None:
    require_superadmin(user)
    OutreachSettings.objects.filter(pk=load_settings().pk).update(paused=True, updated_at=timezone.now())
    record("outreach.paused", request=request, actor=user, summary="Paused")


def remove(contact_id, *, user, request=None) -> None:
    require_superadmin(user)
    changed = Contact.objects.filter(pk=contact_id, status=Contact.Status.QUEUED).update(
        status=Contact.Status.REMOVED, note="Removed from the queue"
    )
    if changed:
        record("outreach.removed", request=request, actor=user, summary=f"Contact {contact_id}")


def clear_queue(*, user, request=None) -> int:
    require_superadmin(user)
    count = Contact.objects.filter(status=Contact.Status.QUEUED).update(
        status=Contact.Status.REMOVED, note="Removed with the whole queue"
    )
    record("outreach.cleared", request=request, actor=user, summary=f"{count} removed from the queue")
    return count


# --- Pacing ------------------------------------------------------------------------------------------


def _local(value: datetime) -> datetime:
    return value.astimezone(LONDON)


def _window_start(day) -> datetime:
    """09:00 London on ``day``, or on the next weekday if ``day`` is a weekend."""
    while day.weekday() >= 5:
        day += timedelta(days=1)
    return datetime.combine(day, WINDOW_START, tzinfo=LONDON)


def in_window(now: datetime) -> bool:
    local = _local(now)
    return local.weekday() < 5 and WINDOW_START <= local.time() < WINDOW_END


def sent_today(now: datetime) -> int:
    """Emails sent since midnight London on ``now``'s day."""
    midnight = datetime.combine(_local(now).date(), time(0, 0), tzinfo=LONDON)
    return Contact.objects.filter(sent_at__gte=midnight).count()


def next_due(now: datetime | None = None, current: OutreachSettings | None = None) -> datetime | None:
    """When the queue next wants to send, or None (paused, or nothing queued): the gap after the last
    email, moved into the next weekday 09:00-17:00 window that is under the daily limit."""
    now = now or timezone.now()
    current = current or OutreachSettings.load()
    if current.paused or not Contact.objects.filter(status=Contact.Status.QUEUED).exists():
        return None
    due = max(now, current.next_send_at or now)
    for _ in range(10):
        local = _local(due)
        if local.weekday() >= 5 or local.time() < WINDOW_START:
            due = max(due, _window_start(local.date()))
        elif local.time() >= WINDOW_END or sent_today(due) >= current.daily_cap:
            due = _window_start(local.date() + timedelta(days=1))
        else:
            return due
    return None


# --- Sending -----------------------------------------------------------------------------------------


def _gap() -> timedelta:
    low, high = GAP_SECONDS
    return timedelta(seconds=low + secrets.randbelow(high - low + 1))


def send_due(now: datetime | None = None) -> int:
    """Sends at most one queued email if one is due. Called by the content tick every minute."""
    now = now or timezone.now()
    with transaction.atomic():
        current = OutreachSettings.objects.select_for_update().filter(pk=1).first()
        if current is None or current.paused:
            return 0
        due = next_due(now, current)
        if due is None or due > now:
            return 0
        contact = (
            Contact.objects.select_for_update(skip_locked=True)
            .filter(status=Contact.Status.QUEUED)
            .order_by("imported_at", "id")
            .first()
        )
        if contact is None:
            return 0
        problems = start_problems(current)
        if problems:
            current.paused, current.last_error = True, problems[0][:300]
            current.save(update_fields=["paused", "last_error", "updated_at"])
            return 0
        # Claimed before sending: a crash mid-send leaves it "Sending", never emailed twice.
        contact.status = Contact.Status.SENDING
        contact.save(update_fields=["status"])
        current.next_send_at = now + _gap()
        current.save(update_fields=["next_send_at", "updated_at"])
    return _send(contact, current, now)


def _send(contact: Contact, current: OutreachSettings, now: datetime) -> int:
    template = current.template
    if EmailSuppression.objects.filter(email=contact.email).exists():
        Contact.objects.filter(pk=contact.pk).update(
            status=Contact.Status.REMOVED, note="Unsubscribed before it was sent"
        )
        return 0
    connection = outreach_connection()
    values = {"first_name": contact.first_name, "organisation": contact.business, "email": contact.email}
    package = template_services.render_for(template, values, contact.email)
    user = current.started_by
    name = clean_line((user.get_full_name() if user else "") or "Vitalos Technologies")
    mailbox = settings.OUTREACH_SMTP_USER or (user.email if user else settings.NOTIFY_FROM)
    message = build_message(
        package.rendered.email,
        subject=package.subject,
        to=[contact.email],
        from_email=formataddr((name, mailbox)),
        reply_to=[mailbox],
        headers={
            "Message-ID": make_msgid(domain="vitalos.co.uk"),
            "List-Unsubscribe": f"<{unsubscribe_url(contact.email, template.key)}>",
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
    )
    try:
        if connection is not None:
            connection.send_messages([message])
        else:  # EMAIL_TRANSPORT=log in development: written to the log, nothing leaves
            message.send(fail_silently=False)
    except Exception as exc:  # noqa: BLE001 - any transport failure is recorded on the contact
        logger.warning("Outreach send failed", extra={"contact": contact.pk}, exc_info=True)
        Contact.objects.filter(pk=contact.pk).update(
            status=Contact.Status.FAILED, note=f"Not sent: {type(exc).__name__}"[:200]
        )
        failures = current.consecutive_failures + 1
        updates = {"consecutive_failures": failures, "updated_at": timezone.now()}
        if failures >= FAILURES_BEFORE_PAUSE:
            updates |= {"paused": True, "last_error": f"Paused after {failures} failed sends in a row."}
        OutreachSettings.objects.filter(pk=current.pk).update(**updates)
        return 0
    note = (
        ""
        if connection is not None or settings.EMAIL_TRANSPORT == "resend"
        else "Logged only (EMAIL_TRANSPORT=log)"
    )
    Contact.objects.filter(pk=contact.pk).update(
        status=Contact.Status.SENT, sent_at=now, template_key=template.key, note=note
    )
    OutreachSettings.objects.filter(pk=current.pk).update(consecutive_failures=0)
    record(
        "outreach.sent",
        actor=user,
        summary=f"{template.name} (v{template.version}) to lead {contact.lead_ref or contact.pk}",
    )
    return 1


# --- Reporting ---------------------------------------------------------------------------------------


def counts(now: datetime | None = None) -> dict[str, int]:
    now = now or timezone.now()
    by_status = {status: 0 for status in Contact.Status.values}
    for row in Contact.objects.values("status").annotate(n=Count("id")):
        by_status[row["status"]] = row["n"]
    return {**by_status, "today": sent_today(now)}


def export_csv(*, user, request=None) -> str:
    """Every contact that was sent, failed or removed, to update Notion by Lead ID."""
    require_superadmin(user)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Lead ID", "Business", "Email", "Status", "Sent at (London)", "Template", "Note"])
    for contact in Contact.objects.exclude(status=Contact.Status.QUEUED).order_by("sent_at", "id"):
        sent = _local(contact.sent_at).strftime("%Y-%m-%d %H:%M") if contact.sent_at else ""
        writer.writerow(
            [
                contact.lead_ref,
                contact.business,
                contact.email,
                contact.get_status_display(),
                sent,
                contact.template_key,
                contact.note,
            ]
        )
    record("outreach.exported", request=request, actor=user, summary="Sent list exported")
    return buffer.getvalue()
