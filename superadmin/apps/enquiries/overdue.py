"""Telling people when an enquiry passes its first-response target (finding E5).

- Once per enquiry, when ``sla_due_at`` passes with no first response: an in-app notification to the
  assignee, or to every super admin who can work enquiries when it is unassigned, and an email through
  the enquiry notification outbox (coalesced, rate-capped and counted towards RESEND_DAILY_LIMIT).
  Email follows the recipient's existing preferences: "Assigned to me" for the assignee, "New enquiry"
  for the unassigned case. ``Enquiry.sla_breach_notified_at`` makes it idempotent across processes.
- Once a day: every enquiry still overdue goes into the recipients' 08:00 digest.

Run from the content tick (``apps.content_sync.tick``) and ``manage.py notify_overdue_enquiries``.
"""

import logging

from django.utils import timezone

from apps.notifications.services import notify

from . import selectors
from .models import Enquiry, NotificationPreference, OutboundNotification

logger = logging.getLogger(__name__)

OVERDUE_KIND = "enquiry_overdue"  # Notification.kind, validated in code like careers_application
OVERDUE_EVENT = "sla_overdue"  # OutboundNotification.event for the email outbox
Event = NotificationPreference.Event
Mode = NotificationPreference.Mode


def overdue(now=None):
    """Open enquiries with no first response whose target has passed."""
    now = now or timezone.now()
    return Enquiry.objects.filter(
        status__in=selectors.OPEN_STATUSES, first_response_at__isnull=True, sla_due_at__lte=now
    )


def recipients(enquiry) -> tuple[list, str]:
    """(users, preference event that decides their email) for an overdue enquiry."""
    from apps.architecture.services import superadmins

    assignee = enquiry.assignee
    if assignee is not None and assignee.is_active and selectors.can_access(assignee):
        return [assignee], Event.ASSIGNED
    users = [user for user in superadmins().order_by("email") if selectors.can_access(user)]
    return users, Event.NEW_ENQUIRY


def _email_mode(user, preference_event) -> str:
    from .notifications import get_preferences

    return get_preferences(user)[preference_event]


def _title(enquiry) -> str:
    return f"First response overdue {enquiry.ref}: {enquiry.subject or '(no subject)'}"


def notify_overdue(now=None) -> int:
    """Tell people about enquiries that have just passed their target. Returns enquiries notified."""
    from .notifications import flush

    now = now or timezone.now()
    count = 0
    queued = False
    pending = overdue(now).filter(sla_breach_notified_at__isnull=True).select_related("assignee")
    for enquiry in pending.order_by("sla_due_at", "id"):
        claimed = Enquiry.objects.filter(pk=enquiry.pk, sla_breach_notified_at__isnull=True).update(
            sla_breach_notified_at=now
        )
        if not claimed:
            continue  # another process got there first
        users, preference_event = recipients(enquiry)
        due = timezone.localtime(enquiry.sla_due_at)
        notify(
            users,
            OVERDUE_KIND,
            title=_title(enquiry),
            body=f"From {enquiry.from_name or enquiry.from_email}. The first-response target was "
            f"{due:%d %b %Y, %H:%M}." + ("" if enquiry.assignee_id else " Nobody is assigned."),
            url=enquiry.get_absolute_url(),
        )
        rows = [
            OutboundNotification(
                recipient=user, event=OVERDUE_EVENT, enquiry=enquiry, mode=mode, created_at=now
            )
            for user in users
            if (mode := _email_mode(user, preference_event)) != Mode.OFF
        ]
        OutboundNotification.objects.bulk_create(rows)
        queued = queued or bool(rows)
        count += 1
    if queued:
        flush(now)
    if count:
        logger.info("Overdue enquiries notified", extra={"count": count})
    return count


def queue_overdue_digest(now=None) -> int:
    """Put every still-overdue enquiry into its recipients' next 08:00 digest, once per day.

    Recipients whose matching preference is Off are skipped. Returns digest rows queued.
    """
    from .notifications import _start_of_day

    now = now or timezone.now()
    start = _start_of_day(now)
    rows = []
    for enquiry in overdue(now).select_related("assignee").order_by("sla_due_at", "id"):
        users, preference_event = recipients(enquiry)
        already = set(
            OutboundNotification.objects.filter(
                enquiry=enquiry, event=OVERDUE_EVENT, mode=Mode.DIGEST, created_at__gte=start
            ).values_list("recipient_id", flat=True)
        )
        for user in users:
            if user.pk in already or _email_mode(user, preference_event) == Mode.OFF:
                continue
            rows.append(
                OutboundNotification(
                    recipient=user, event=OVERDUE_EVENT, enquiry=enquiry, mode=Mode.DIGEST, created_at=now
                )
            )
    OutboundNotification.objects.bulk_create(rows)
    return len(rows)


def overdue_count(now=None) -> int:
    return overdue(now).count()
