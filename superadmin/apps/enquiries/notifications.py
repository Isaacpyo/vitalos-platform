"""Internal notifications about enquiries: in-app, optional Slack, and batched email.

Email rules (protecting the Resend free tier of 100 emails a day, which replies also use):
- The first event for a recipient is emailed at once; anything within the next 2 minutes is
  coalesced into one email.
- At most 20 instant emails per recipient per hour; overflow rolls into the 08:00 daily digest.
- At 80 emails in a day a warning is logged; at RESEND_DAILY_LIMIT remaining instants roll to digest.
Emails render on the shared layout (ADR-030), carry ``Auto-Submitted: auto-generated`` (RFC 3834) and
``X-Vitalos-Notification`` (ADR-046), and never include file attachments (only the layout's inline images).
"""

import json
import logging
import urllib.error
import urllib.request
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.db.models import Max
from django.urls import reverse
from django.utils import timezone
from django.utils.dateformat import format as date_format

from apps.audit.services import record
from apps.mailer import system
from apps.notifications.models import Notification
from apps.notifications.services import notify

from . import selectors
from .models import Message, NotificationPreference, OutboundNotification
from .sla import LONDON

logger = logging.getLogger(__name__)

Event = NotificationPreference.Event
Mode = NotificationPreference.Mode
CHANNEL = "email"
COALESCE = timedelta(minutes=2)
HOURLY_CAP = 20
DAILY_WARNING = 80
DIGEST_HOUR = 8
SNIPPET_LENGTH = 300
ITEM_SUMMARY_LENGTH = 160
SLACK_TIMEOUT = 5
SETTINGS_NOTICE = "Change these emails in Enquiries › Notification settings."
CHANNELS = {"email": "Email", "web_form": "Website form"}

KINDS = {
    Event.NEW_ENQUIRY: Notification.Kind.ENQUIRY_NEW,
    Event.ASSIGNED: Notification.Kind.ENQUIRY_ASSIGNED,
    Event.CUSTOMER_REPLY: Notification.Kind.ENQUIRY_REPLY,
}
TITLES = {
    Event.NEW_ENQUIRY: "New enquiry",
    Event.ASSIGNED: "Assigned to you",
    Event.CUSTOMER_REPLY: "Customer replied",
}


# --- Recipients and preferences -----------------------------------------------------------------


def owner():
    """The person who hears about every new enquiry: NOTIFY_OWNER_EMAIL, else the primary owner."""
    from apps.accounts.services import primary_owner

    address = (getattr(settings, "NOTIFY_OWNER_EMAIL", "") or "").strip()
    user = None
    if address:
        user = get_user_model().objects.filter(email__iexact=address, is_active=True).first()
    return user or primary_owner()


def _default_mode(user, event, owner_user) -> str:
    if event == Event.NEW_ENQUIRY:
        return Mode.INSTANT if owner_user is not None and user.pk == owner_user.pk else Mode.OFF
    return Mode.INSTANT


def get_preferences(user) -> dict[str, str]:
    owner_user = owner()
    prefs = {event: _default_mode(user, event, owner_user) for event in Event.values}
    stored = NotificationPreference.objects.filter(user=user, channel=CHANNEL)
    prefs.update(dict(stored.values_list("event", "mode")))
    return prefs


@transaction.atomic
def set_preferences(user, mapping, request=None) -> dict[str, str]:
    if not selectors.can_access(user):
        raise PermissionDenied
    for event, mode in (mapping or {}).items():
        if event not in Event.values or mode not in Mode.values:
            raise ValidationError(f"Unknown notification preference {event!r}: {mode!r}.")
    for event, mode in mapping.items():
        NotificationPreference.objects.update_or_create(
            user=user, channel=CHANNEL, event=event, defaults={"mode": mode}
        )
    prefs = get_preferences(user)
    record(
        "enquiries.updated",
        request=request,
        actor=user,
        entity=user,
        summary="Changed enquiry notification preferences",
        preferences=prefs,
    )
    return prefs


def _audience(event, enquiry) -> list:
    """Users who hear about ``event`` (in-app); email mode is decided per user from preferences."""
    owner_user = owner()
    users = []
    if event == Event.NEW_ENQUIRY:
        users.append(owner_user)
        opted_in = (
            NotificationPreference.objects.filter(event=event, channel=CHANNEL)
            .exclude(mode=Mode.OFF)
            .select_related("user")
        )
        users += [pref.user for pref in opted_in]
    elif event == Event.ASSIGNED:
        users.append(enquiry.assignee)
    elif event == Event.CUSTOMER_REPLY:
        users.append(enquiry.assignee or owner_user)
    seen, result = set(), []
    for user in users:
        if user is None or user.pk in seen or not user.is_active or not selectors.can_access(user):
            continue
        seen.add(user.pk)
        result.append(user)
    return result


# --- Queue --------------------------------------------------------------------------------------


def _slack(event, enquiry) -> None:
    url = getattr(settings, "SLACK_WEBHOOK_URL", "")
    if not url:
        return
    if not url.startswith("https://"):
        logger.warning("SLACK_WEBHOOK_URL must be an https URL; Slack notification skipped")
        return
    # Reference and subject only: never the message body.
    text = f"{TITLES[event]}: {enquiry.ref} {enquiry.subject or '(no subject)'}"[:300]
    request = urllib.request.Request(  # noqa: S310 - https URL from settings, checked above
        url,
        data=json.dumps({"text": text}).encode(),
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": "vitalos-superadmin/1.0"},
    )
    try:
        with urllib.request.urlopen(request, timeout=SLACK_TIMEOUT):  # noqa: S310  # nosec B310
            pass
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        logger.warning("Slack notification failed", extra={"error": type(exc).__name__, "ref": enquiry.ref})


def queue(event, enquiry, *, actor=None) -> int:
    """Tell the right people about ``event`` on ``enquiry``. Returns the number of emails queued."""
    if event not in Event.values:
        raise ValueError(f"Unknown enquiry event {event!r}")
    if enquiry.status == enquiry.Status.SPAM:
        return 0
    audience = [user for user in _audience(event, enquiry) if actor is None or user.pk != actor.pk]
    sender = enquiry.from_name or enquiry.from_email
    notify(
        audience,
        KINDS[event],
        title=f"{TITLES[event]} {enquiry.ref}: {enquiry.subject or '(no subject)'}",
        body=f"From {sender}",
        url=enquiry.get_absolute_url(),
        exclude=actor,
    )
    _slack(event, enquiry)
    now = timezone.now()
    rows = []
    for user in audience:
        mode = get_preferences(user)[event]
        if mode != Mode.OFF:
            rows.append(
                OutboundNotification(recipient=user, event=event, enquiry=enquiry, mode=mode, created_at=now)
            )
    OutboundNotification.objects.bulk_create(rows)
    if rows:
        flush(now)
    return len(rows)


# --- Sending ------------------------------------------------------------------------------------


def _start_of_day(now: datetime) -> datetime:
    return now.astimezone(LONDON).replace(hour=0, minute=0, second=0, microsecond=0)


def emails_sent_today(now: datetime) -> int:
    """Resend usage today: notification emails (one per distinct send time per recipient) and replies."""
    start = _start_of_day(now)
    notifications_sent = (
        OutboundNotification.objects.filter(sent_at__gte=start)
        .values("recipient_id", "sent_at")
        .distinct()
        .count()
    )
    replies = (
        Message.objects.filter(direction=Message.Direction.OUTBOUND, created_at__gte=start)
        .exclude(delivery_status="failed")
        .count()
    )
    return notifications_sent + replies


def _latest_text(enquiry) -> str:
    message = (
        enquiry.messages.filter(direction=Message.Direction.INBOUND).order_by("-created_at", "-id").first()
    )
    text = message.text_body if message is not None else enquiry.snippet
    return " ".join((text or "").split())[:SNIPPET_LENGTH]


def _sender(enquiry) -> str:
    return f"{enquiry.from_name} <{enquiry.from_email}>" if enquiry.from_name else enquiry.from_email


def _received(enquiry) -> str:
    return date_format(timezone.localtime(enquiry.created_at), "D j M Y, H:i")


def _single_document(row) -> dict:
    enquiry = row.enquiry
    url = f"{settings.APP_BASE_URL}{enquiry.get_absolute_url()}"
    channel = CHANNELS.get(enquiry.source, enquiry.source)
    return {
        "title": f"{TITLES[row.event]}: {enquiry.ref}",
        "preheader": f"From {enquiry.from_name or enquiry.from_email}: {enquiry.subject or '(no subject)'}",
        "headerLabel": "Enquiries",
        "blocks": [
            {"type": "heading", "text": f"{TITLES[row.event]}: {enquiry.ref}"},
            {"type": "text", "tone": "muted", "text": enquiry.subject or "(no subject)"},
            {"type": "badge", "items": [enquiry.from_name or enquiry.from_email, channel]},
            {"type": "quote", "text": _latest_text(enquiry), "missing": "No message text"},
            {
                "type": "details",
                "rows": [
                    {"label": "Reference", "value": enquiry.ref, "code": True},
                    {"label": "From", "value": _sender(enquiry), "href": f"mailto:{enquiry.from_email}"},
                    {"label": "Received", "value": _received(enquiry)},
                    {"label": "Channel", "value": channel},
                ],
            },
            {"type": "button", "label": "Open enquiry", "url": url},
            system.link_fallback(url),
        ],
        "footer": system.footer(SETTINGS_NOTICE),
    }


def _list_item(row) -> dict:
    enquiry = row.enquiry
    summary = _latest_text(enquiry)
    if len(summary) > ITEM_SUMMARY_LENGTH:
        summary = summary[: ITEM_SUMMARY_LENGTH - 1].rstrip() + "…"
    return {
        "tag": TITLES[row.event],
        "title": f"{enquiry.ref}: {enquiry.subject or '(no subject)'}",
        "summary": summary,
        "meta": f"From {_sender(enquiry)} · {_received(enquiry)}",
        "href": f"{settings.APP_BASE_URL}{enquiry.get_absolute_url()}",
    }


def _list_document(rows, heading: str) -> dict:
    refs = list(dict.fromkeys(row.enquiry.ref for row in rows))
    shown = ", ".join(refs[:3]) + (f" and {len(refs) - 3} more" if len(refs) > 3 else "")
    url = settings.APP_BASE_URL + reverse("enquiries:inbox")
    return {
        "title": heading,
        "preheader": f"Updates on {shown}",
        "headerLabel": "Enquiries",
        "blocks": [
            {"type": "heading", "text": heading},
            {"type": "items", "items": [_list_item(row) for row in rows]},
            {"type": "button", "label": "Open the inbox", "url": url},
            system.link_fallback(url),
        ],
        "footer": system.footer(SETTINGS_NOTICE),
    }


def build_email(rows, *, digest: bool, now=None) -> tuple[str, dict]:
    """Subject and layout document for one notification email (also used by the email gallery)."""
    if digest:
        day = date_format(timezone.localtime(now or timezone.now()), "j F Y")
        subject = f"Enquiries digest: {len(rows)} update{'s' if len(rows) != 1 else ''}"
        return subject, _list_document(rows, f"Enquiries digest, {day}")
    if len(rows) == 1:
        row = rows[0]
        subject = f"{TITLES[row.event]}: {row.enquiry.ref} {row.enquiry.subject or ''}".strip()
        return subject, _single_document(row)
    subject = f"{len(rows)} enquiry updates"
    return subject, _list_document(rows, subject)


def _send(user, rows, *, digest: bool) -> None:
    subject, doc = build_email(rows, digest=digest)
    system.send(
        doc,
        kind="enquiries.digest" if digest else "enquiries.update",
        subject=subject,
        to=[user.email],
        from_email=settings.NOTIFY_FROM_HEADER,
    )


def _deliver(user, rows, now, *, digest: bool) -> bool:
    try:
        _send(user, rows, digest=digest)
    except Exception:  # noqa: BLE001 - one failed recipient must not stop the others
        logger.warning("Enquiry notification email failed", extra={"recipient": user.pk}, exc_info=True)
        return False
    OutboundNotification.objects.filter(pk__in=[row.pk for row in rows]).update(sent_at=now)
    return True


def _roll_to_digest(queryset) -> int:
    return queryset.update(mode=Mode.DIGEST)


def flush(now=None) -> int:
    """Send due instant notifications, one coalesced email per recipient. Returns emails sent."""
    now = now or timezone.now()
    pending = OutboundNotification.objects.filter(sent_at__isnull=True, mode=Mode.INSTANT)
    recipient_ids = list(pending.values_list("recipient_id", flat=True).distinct())
    if not recipient_ids:
        return 0
    limit = settings.RESEND_DAILY_LIMIT
    sent_today = emails_sent_today(now)
    users = get_user_model().objects.in_bulk(recipient_ids)
    sent = 0
    for recipient_id in recipient_ids:
        user = users.get(recipient_id)
        if sent_today >= limit:
            rolled = _roll_to_digest(pending)
            logger.warning(
                "Daily email limit reached; notifications rolled into the digest", extra={"rows": rolled}
            )
            break
        with transaction.atomic():
            rows = list(
                pending.filter(recipient_id=recipient_id)
                .select_for_update(skip_locked=True)
                .select_related("enquiry")
                .order_by("created_at", "id")
            )
            if not rows or user is None:
                continue
            last_email = OutboundNotification.objects.filter(
                recipient_id=recipient_id, sent_at__isnull=False
            ).aggregate(last=Max("sent_at"))["last"]
            due = now - rows[0].created_at >= COALESCE or last_email is None or now - last_email >= COALESCE
            if not due:
                continue
            sent_this_hour = (
                OutboundNotification.objects.filter(
                    recipient_id=recipient_id, mode=Mode.INSTANT, sent_at__gte=now - timedelta(hours=1)
                )
                .values("sent_at")
                .distinct()
                .count()
            )
            if sent_this_hour >= HOURLY_CAP:
                _roll_to_digest(OutboundNotification.objects.filter(pk__in=[row.pk for row in rows]))
                continue
            if _deliver(user, rows, now, digest=False):
                sent += 1
                sent_today += 1
                if sent_today == DAILY_WARNING:
                    logger.warning(
                        "Enquiry emails today reached the warning threshold", extra={"count": sent_today}
                    )
    return sent


def send_digests(now=None) -> int:
    """At or after 08:00 Europe/London, send each recipient one digest of their pending digest rows."""
    now = now or timezone.now()
    local = now.astimezone(LONDON)
    if local.hour < DIGEST_HOUR:
        return 0
    digest_time = local.replace(hour=DIGEST_HOUR, minute=0, second=0, microsecond=0)
    pending = OutboundNotification.objects.filter(sent_at__isnull=True, mode=Mode.DIGEST)
    recipient_ids = list(pending.values_list("recipient_id", flat=True).distinct())
    users = get_user_model().objects.in_bulk(recipient_ids)
    limit = settings.RESEND_DAILY_LIMIT
    sent_today = emails_sent_today(now)
    sent = 0
    for recipient_id in recipient_ids:
        user = users.get(recipient_id)
        if user is None:
            continue
        if sent_today >= limit:
            logger.warning("Daily email limit reached; digests wait until tomorrow")
            break
        already = OutboundNotification.objects.filter(
            recipient_id=recipient_id, mode=Mode.DIGEST, sent_at__gte=digest_time
        ).exists()
        if already:
            continue
        with transaction.atomic():
            rows = list(
                pending.filter(recipient_id=recipient_id)
                .select_for_update(skip_locked=True)
                .select_related("enquiry")
                .order_by("created_at", "id")
            )
            if rows and _deliver(user, rows, now, digest=True):
                sent += 1
                sent_today += 1
    return sent


def flush_if_due() -> int:
    """Cheap hook for the inbox badge poll: one indexed query when nothing is waiting."""
    try:
        if not OutboundNotification.objects.filter(sent_at__isnull=True, mode=Mode.INSTANT).exists():
            return 0
        return flush()
    except Exception:  # noqa: BLE001 - the badge must render even if mail is down
        logger.exception("Enquiry notification flush failed")
        return 0
