"""The content tick (ADR-038): promote due scheduled posts, close expired roles, deliver pending sync
events, and once a day run retention and purge orphaned uploads.

Run by ``manage.py content_tick`` (``--loop`` every 60 s for local development), by the signed
``POST /api/content/v1/tick`` and opportunistically, at most once a minute, in a background thread.
Overlapping runs never process anything twice: rows are claimed with ``skip_locked`` and every
transition is conditional.
"""

import logging
import threading
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.db.models import Min
from django.utils import timezone

from . import formatting, sync
from .models import SyncEvent, TickState

logger = logging.getLogger(__name__)

MIN_INTERVAL = timedelta(seconds=60)


def next_due_at(now=None):
    """Earliest scheduled publish, published role closing or pending retry (overdue ones included,
    so the website's tick calls the admin straight away)."""
    from apps.careers.models import Role, RoleStatus
    from apps.insights.models import Post, PostStatus

    candidates = [
        Post.objects.filter(status=PostStatus.SCHEDULED, publish_at__isnull=False).aggregate(
            at=Min("publish_at")
        )["at"],
        Role.objects.filter(status=RoleStatus.OPEN, published_closes_at__isnull=False).aggregate(
            at=Min("published_closes_at")
        )["at"],
        SyncEvent.objects.filter(delivered_at__isnull=True, next_attempt_at__isnull=False).aggregate(
            at=Min("next_attempt_at")
        )["at"],
    ]
    values = [value for value in candidates if value is not None]
    return min(values) if values else None


def _daily_due(state: TickState, now) -> bool:
    if state.last_daily_at is None:
        return True
    return formatting.london(state.last_daily_at).date() < formatting.london(now).date()


def run(now=None) -> dict:
    """One tick. Returns the counts the tick endpoint reports."""
    from apps.careers import services as careers_services
    from apps.insights import services as insights_services

    now = now or timezone.now()
    promoted = insights_services.promote_due(now)
    closed = careers_services.close_due(now)
    delivered = sync.deliver_due(timezone.now())
    state = TickState.load()
    daily = {}
    if _daily_due(state, now):
        claimed = TickState.objects.filter(pk=state.pk, last_daily_at=state.last_daily_at).update(
            last_daily_at=now
        )
        if claimed:
            daily = {
                "retention": careers_services.run_retention(now),
                "orphans": careers_services.purge_orphan_uploads(now),
            }
    result = {
        "promoted": promoted,
        "closed": closed,
        "delivered": delivered,
        "nextDueAt": formatting.iso(next_due_at(now)),
    }
    TickState.objects.filter(pk=state.pk).update(
        last_finished_at=timezone.now(), last_result={**result, **daily}
    )
    if promoted or closed or delivered:
        logger.info("Content tick", extra={"promoted": promoted, "closed": closed, "delivered": delivered})
    return result


def claim(now=None) -> bool:
    """True when this caller may run the tick now (at most once a minute across every process)."""
    now = now or timezone.now()
    state = TickState.load()
    if state.last_run_at is not None and now - state.last_run_at < MIN_INTERVAL:
        return False
    return bool(TickState.objects.filter(pk=state.pk, last_run_at=state.last_run_at).update(last_run_at=now))


def _run_in_thread() -> None:
    try:
        run()
    except Exception:  # noqa: BLE001 - a background tick must never crash the worker
        logger.exception("Opportunistic content tick failed")
    finally:
        connection.close()


def maybe_run_async() -> bool:
    """Start a background tick if one is due. Never blocks or raises into the request."""
    if not settings.CONTENT_OPPORTUNISTIC_TICK:
        return False
    try:
        if not claim():
            return False
    except Exception:  # noqa: BLE001
        logger.exception("Content tick claim failed")
        return False
    threading.Thread(target=_run_in_thread, name="content-tick", daemon=True).start()
    return True
