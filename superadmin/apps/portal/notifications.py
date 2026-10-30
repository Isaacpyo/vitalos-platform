"""Portal notifications: in-app list, preferences, and email with a durable delivery record.

* One notification per event per user (``dedupe_key`` is unique per user), so a repeated trigger never
  notifies twice and never emails twice.
* Recipients are live members of the organisation only. Nobody who is not a member ever receives mail.
* Email goes through ``apps.mailer.system.send`` (shared layout, ADR-046 headers). Each email has an
  ``EmailDelivery`` (queued, sent or failed, with attempts). Failure never blocks or loses the underlying
  action: it is recorded and retried a bounded number of times by ``portal_send_pending``. A sent delivery is
  terminal, so a retry can never duplicate it.
* Titles and bodies are composed by the services from customer-visible fields only; this module adds nothing.
* Push to the member's devices (ADR-056, Phase 2; ``push.py``) follows the same rules: queued per device when the
  member's push preference for the kind allows it, sent after the action commits, retried by ``send_pending``,
  and never able to break the email path or the action. A push carries only a generic line per kind.
"""

from __future__ import annotations

import datetime as dt
import logging
from contextlib import contextmanager
from contextvars import ContextVar

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record

from . import selectors
from .models import EmailDelivery, Membership, Notification, NotificationPreference

logger = logging.getLogger(__name__)

RETRY_BACKOFF_MINUTES = 5
#: ``last_error`` when a re-check refuses an email (no provider was called). Shown to staff, never to customers.
NOT_MEMBER_ERROR = "recipient is no longer a live member"
PREFERENCE_OFF_ERROR = "recipient turned these emails off"

# The demo seed command (and nothing else) turns email (and push) off for its synthetic people.
_email_suppressed: ContextVar[bool] = ContextVar("portal_email_suppressed", default=False)


@contextmanager
def email_suppressed():
    token = _email_suppressed.set(True)
    try:
        yield
    finally:
        _email_suppressed.reset(token)


def preferences(user) -> NotificationPreference:
    pref, _ = NotificationPreference.objects.get_or_create(user=user)
    return pref


def notify(
    organisation,
    *,
    kind: str,
    title: str,
    body: str = "",
    url_name: str,
    url_kwargs: dict | None = None,
    key: str,
    recipients: list[Membership] | None = None,
    min_level: int = 1,
    exclude_user=None,
    send_email: bool = True,
) -> int:
    """Notify live members (optionally a subset, at least ``min_level``). Returns notifications created.
    ``send_email`` covers the outside channels: email and push to the member's devices."""
    live = {m.user_id: m for m in selectors.live_member_users(organisation)}
    if recipients is not None:
        allowed = {m.user_id for m in recipients}
        live = {uid: m for uid, m in live.items() if uid in allowed}
    created = 0
    pushes: list[int] = []
    for user_id, member in live.items():
        if member.level < min_level or (exclude_user is not None and user_id == exclude_user.pk):
            continue
        try:
            with transaction.atomic():
                note = Notification.objects.create(
                    user=member.user,
                    organisation=organisation,
                    kind=kind,
                    title=title[:200],
                    body=body[:400],
                    url_name=url_name,
                    url_kwargs=url_kwargs or {},
                    dedupe_key=key[:120],
                )
        except IntegrityError:
            continue  # already notified for this event
        created += 1
        if not send_email or _email_suppressed.get():
            continue
        pref = preferences(member.user)
        if pref.wants_email(kind):
            delivery = EmailDelivery.objects.create(
                notification=note,
                organisation=organisation,
                recipient=member.user,
                to_email=member.user.email,
                kind=kind,
                subject=f"{organisation.name}: {title}"[:200],
            )
            deliver(delivery.pk)
        pushes += _queue_push(note, pref)
    _schedule_push(pushes)
    return created


def _queue_push(note: Notification, pref: NotificationPreference) -> list[int]:
    from . import push

    try:
        with transaction.atomic():
            return push.queue(note, pref)
    except Exception:  # noqa: BLE001 - push must never break the notification, the email or the action
        logger.exception("portal push queueing failed", extra={"notification": note.pk})
        return []


def _schedule_push(ids: list[int]) -> None:
    from . import push

    try:
        push.schedule(ids)
    except Exception:  # noqa: BLE001 - the queued rows stay for send_pending
        logger.exception("portal push scheduling failed")


def _email_doc(note: Notification, org_name: str) -> dict:
    from apps.mailer import system

    from .access import portal_absolute

    link = portal_absolute("notification_open", {"pk": note.pk})
    blocks = [{"type": "heading", "text": note.title}]
    if note.body:
        blocks.append({"type": "text", "text": note.body})
    blocks += [
        {"type": "button", "label": "Open in your portal", "url": link},
        system.link_fallback(link),
        {
            "type": "text",
            "tone": "muted",
            "text": "You receive this because you are a member of this organisation's Vitalos portal. "
            "You can change which emails you get under Notifications > Preferences.",
        },
    ]
    return {
        "title": note.title,
        "preheader": (note.body or note.title)[:120],
        "headerLabel": "Client portal",
        "blocks": blocks,
        "footer": system.footer(),
    }


def _refuse(d: EmailDelivery, reason: str) -> EmailDelivery:
    """A re-check said no: the delivery fails for good without calling the provider."""
    d.status = EmailDelivery.Status.FAILED
    d.attempts = max(d.attempts, EmailDelivery.MAX_ATTEMPTS)
    d.last_error = reason
    d.save()
    return d


def deliver(delivery_id: int, *, manual: bool = False) -> EmailDelivery | None:
    """Attempt one send. Idempotent: a sent (or cancelled) delivery is returned untouched. Never raises.

    ``manual`` (staff "Retry now") may try once more after the automatic attempts ran out. Every attempt re-checks
    that the recipient is still a live member at the same address and still wants this kind of email."""
    from apps.mailer import system

    try:
        with transaction.atomic():
            d = (
                EmailDelivery.objects.select_for_update(of=("self",))
                .select_related("notification", "organisation", "recipient")
                .get(pk=delivery_id)
            )
            if d.status == EmailDelivery.Status.SENT or d.last_error == EmailDelivery.CANCELLED_ERROR:
                return d
            if not manual and d.attempts >= EmailDelivery.MAX_ATTEMPTS:
                return d
            member = selectors.get_membership(d.recipient, d.organisation_id)
            note = d.notification
            if member is None or note is None or d.to_email.lower() != d.recipient.email.lower():
                return _refuse(d, NOT_MEMBER_ERROR)
            pref = NotificationPreference.objects.filter(user_id=d.recipient_id).first()
            if pref is not None and not pref.wants_email(d.kind):
                return _refuse(d, PREFERENCE_OFF_ERROR)
            d.attempts += 1
            try:
                system.send(
                    _email_doc(note, d.organisation.name),
                    kind=f"portal.{d.kind}",
                    subject=d.subject,
                    to=[d.to_email],
                    from_email=f"Vitalos <{settings.NOTIFY_FROM}>",
                )
            except Exception as exc:  # noqa: BLE001 - recorded, retried, never raised into the caller's action
                d.status = EmailDelivery.Status.FAILED
                d.last_error = type(exc).__name__[:100]
                d.next_attempt_at = timezone.now() + dt.timedelta(minutes=RETRY_BACKOFF_MINUTES * d.attempts)
                d.save()
                logger.warning("portal email failed", extra={"delivery": d.pk, "error": d.last_error})
                record(
                    "portal.email_failed",
                    entity=d,
                    summary=f"Delivery {d.pk} attempt {d.attempts} failed ({d.last_error})",
                )
                return d
            d.status = EmailDelivery.Status.SENT
            d.sent_at = timezone.now()
            d.last_error = ""
            d.save()
            return d
    except EmailDelivery.DoesNotExist:
        return None
    except Exception:  # noqa: BLE001 - e.g. database trouble: the action that triggered this must still succeed
        logger.exception("portal delivery crashed", extra={"delivery": delivery_id})
        return None


def send_pending(limit: int = 100) -> dict:
    """Bounded retry of queued and failed deliveries that are due and under the attempt cap: email, and, when push
    is configured, pushes too (their counts under ``push``)."""
    result = _send_pending_email(limit)
    from . import push

    if push.enabled():
        try:
            result["push"] = push.send_pending(limit)
        except Exception:  # noqa: BLE001 - a push problem must not hide the email result
            logger.exception("portal push retry failed")
    return result


def _send_pending_email(limit: int) -> dict:
    now = timezone.now()
    due = list(
        EmailDelivery.objects.filter(
            status__in=[EmailDelivery.Status.QUEUED, EmailDelivery.Status.FAILED],
            attempts__lt=EmailDelivery.MAX_ATTEMPTS,
            next_attempt_at__lte=now,
        ).values_list("pk", flat=True)[:limit]
    )
    sent = failed = 0
    for pk in due:
        result = deliver(pk)
        if result is None:
            continue
        if result.status == EmailDelivery.Status.SENT:
            sent += 1
        else:
            failed += 1
    return {"attempted": len(due), "sent": sent, "failed": failed}


def mark_read(user, pk: int) -> Notification | None:
    note = selectors.notifications(user).filter(pk=pk).first()
    if note and note.read_at is None:
        note.read_at = timezone.now()
        note.save(update_fields=["read_at"])
    return note


def mark_all_read(user) -> int:
    return selectors.notifications(user).filter(read_at__isnull=True).update(read_at=timezone.now())
