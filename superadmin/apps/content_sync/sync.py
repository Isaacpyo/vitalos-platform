"""The outbox: emit sync events inside the caller's transaction, deliver them after commit (ADR-040).

Every content mutation does, inside ``transaction.atomic()``: change the data, write the revision (when
publishing), write the audit row, and call ``emit(...)``. The event is delivered with
``transaction.on_commit`` to every website target as a signed POST (scope ``revalidate``) of
``{eventId, kind, tags, paths}``. Failures back off 1, 2, 4, 8 ... minutes, up to 10 attempts, and
staff get an in-app alert after the third. Delivery never raises into the request.
"""

import json
import logging
import urllib.error
import urllib.request
from datetime import timedelta
from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from . import relay, signing, tags
from .models import SyncEvent

logger = logging.getLogger(__name__)

REVALIDATE_PATH = "/api/content/revalidate"
TIMEOUT_SECONDS = 3
MAX_ATTEMPTS = 10
ALERT_AFTER = 3
USER_AGENT = "vitalos-superadmin/1.0"
NOTIFICATION_KIND = "content_sync_failed"


class DeliveryError(Exception):
    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def http_post(url: str, body: bytes, headers: dict[str, str], timeout: float = TIMEOUT_SECONDS) -> int:
    """POST and return the status code. Tests replace this function; nothing here logs bodies."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise DeliveryError("invalid_target")
    request = urllib.request.Request(  # noqa: S310 - http(s) only, checked above
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT, **headers},
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310  # nosec B310
            response.read(1024)
            return response.status
    except urllib.error.HTTPError as exc:
        return exc.code
    except TimeoutError:
        raise DeliveryError("timeout") from None
    except (urllib.error.URLError, OSError) as exc:
        reason = getattr(exc, "reason", None)
        raise DeliveryError("timeout" if isinstance(reason, TimeoutError) else "network") from None


# --- Emitting ----------------------------------------------------------------------------------


def emit(
    entity: str,
    entity_id,
    action: str,
    title: str = "",
    *,
    slug: str = "",
    old_slug: str = "",
    author_slugs=(),
    topic_slugs=(),
    paths=None,
    deliver: bool = True,
) -> SyncEvent:
    """Insert one outbox event in the current transaction and deliver it after commit."""
    event_tags = tags.expand_tags(
        action, slug=slug, old_slug=old_slug, author_slugs=author_slugs, topic_slugs=topic_slugs
    )
    event_paths = (
        tags.clean_paths(paths)
        if paths is not None
        else tags.default_paths(
            entity, slug=slug, old_slug=old_slug, author_slugs=author_slugs, topic_slugs=topic_slugs
        )
    )
    event = SyncEvent.objects.create(
        entity=entity,
        entity_id=str(entity_id or ""),
        action=action,
        kind=tags.kind_for(action),
        title=(title or "")[:200],
        tags=event_tags,
        paths=event_paths,
        next_attempt_at=timezone.now(),
    )
    if deliver:
        event_id = event.pk
        transaction.on_commit(lambda: deliver_safely(event_id))
    return event


# --- Delivering --------------------------------------------------------------------------------


def targets() -> list[str]:
    return list(settings.CONTENT_WEB_TARGETS)


def payload(event: SyncEvent) -> bytes:
    body = {"eventId": str(event.pk), "kind": event.kind, "tags": event.tags, "paths": event.paths}
    return json.dumps(body, separators=(",", ":")).encode()


def backoff(attempts: int) -> timedelta:
    """1, 2, 4, 8 ... minutes after the given number of failed attempts."""
    return timedelta(minutes=2 ** max(0, attempts - 1))


def deliver_safely(event_id) -> bool:
    try:
        return deliver(event_id)
    except Exception:  # noqa: BLE001 - delivery must never raise into a request or the tick
        logger.exception("Sync delivery crashed", extra={"event_id": str(event_id)})
        return False


def deliver(event_id, *, now=None) -> bool:
    """Try every target that has not acknowledged the event yet. True when the event is delivered.

    The row is locked (``skip_locked`` on PostgreSQL) for the attempt, so an overlapping tick skips it.
    """
    with transaction.atomic():
        event = (
            SyncEvent.objects.select_for_update(skip_locked=True)
            .filter(pk=event_id, delivered_at__isnull=True)
            .first()
        )
        if event is None:
            return False
        delivered = _attempt(event, now or timezone.now())
    if delivered:
        relay.after_delivery(event)
    return delivered


def _attempt(event: SyncEvent, now) -> bool:
    acknowledged = list(event.delivered_targets or [])
    pending = [target for target in targets() if target not in acknowledged]
    error = ""
    if pending:
        body = payload(event)
        try:
            headers = signing.sign_headers("revalidate", "POST", REVALIDATE_PATH, body)
        except signing.NotConfigured:
            headers = None
            error = "not_configured"
        for target in pending if headers is not None else []:
            try:
                status = http_post(target + REVALIDATE_PATH, body, headers)
            except DeliveryError as exc:
                error = exc.code
                continue
            if 200 <= status < 300:
                acknowledged.append(target)
            else:
                error = f"http_{status}"
    event.delivered_targets = acknowledged
    event.last_attempt_at = now
    if not [target for target in targets() if target not in acknowledged]:
        # Every configured target acknowledged (or none is configured: nothing to keep in sync).
        event.delivered_at = now
        event.next_attempt_at = None
        event.last_error = "" if targets() else "no_targets"
        event.save(
            update_fields=[
                "delivered_targets",
                "delivered_at",
                "next_attempt_at",
                "last_error",
                "last_attempt_at",
            ]
        )
        logger.info("Sync delivered", extra={"event_id": str(event.pk), "action": event.action})
        return True
    event.attempts += 1
    event.last_error = (error or "failed")[:60]
    event.next_attempt_at = now + backoff(event.attempts) if event.attempts < MAX_ATTEMPTS else None
    event.save(
        update_fields=["delivered_targets", "attempts", "last_error", "next_attempt_at", "last_attempt_at"]
    )
    logger.warning(
        "Sync delivery failed",
        extra={"event_id": str(event.pk), "attempts": event.attempts, "error": event.last_error},
    )
    if event.attempts >= ALERT_AFTER and event.alerted_at is None:
        _alert(event, now)
    return False


def _alert(event: SyncEvent, now) -> None:
    from apps.accounts.roles import SUPERADMIN
    from apps.notifications.services import notify

    User = get_user_model()
    recipients = User.objects.filter(is_active=True).filter(Q(is_superuser=True) | Q(groups__name=SUPERADMIN))
    notify(
        recipients.distinct(),
        NOTIFICATION_KIND,
        f"Site sync failed for {event.title or event.action}",
        body=f"{event.attempts} delivery attempts failed ({event.last_error}). Retry from the sync page.",
        url="/content/sync/",
    )
    SyncEvent.objects.filter(pk=event.pk).update(alerted_at=now)
    event.alerted_at = now


def due_events(now=None):
    now = now or timezone.now()
    return SyncEvent.objects.filter(delivered_at__isnull=True, next_attempt_at__lte=now).order_by(
        "created_at"
    )


def deliver_due(now=None, limit: int = 100) -> int:
    """Deliver pending events whose retry time has passed. Returns how many were delivered."""
    delivered = 0
    for event_id in list(due_events(now).values_list("pk", flat=True)[:limit]):
        if deliver_safely(event_id):
            delivered += 1
    return delivered


def retry(event: SyncEvent) -> bool:
    """Manual retry from the sync page: deliver now, whatever the backoff says."""
    if event.delivered_at is not None:
        return True
    SyncEvent.objects.filter(pk=event.pk, delivered_at__isnull=True).update(next_attempt_at=timezone.now())
    return deliver_safely(event.pk)
