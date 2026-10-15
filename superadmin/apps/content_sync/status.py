"""Sync status for the admin UI (brief 3.7), built from SyncEvent rows.

Per item: "LIVE · SYNCED 14:21", "SYNC PENDING", "SYNC FAILED · RETRY" or "NOT PUBLISHED".
Overall: "SITE IN SYNC", "{n} UPDATES PENDING" or "{n} SYNC FAILURES".
"""

from dataclasses import dataclass

from . import formatting
from .models import SyncEvent
from .sync import ALERT_AFTER

LIVE = "live"
PENDING = "pending"
FAILED = "failed"
NOT_PUBLISHED = "not_published"


@dataclass
class ItemStatus:
    state: str
    label: str
    event_id: str = ""

    @property
    def polling(self) -> bool:
        return self.state == PENDING


def _failed(event: SyncEvent) -> bool:
    return event.attempts >= ALERT_AFTER or (event.attempts > 0 and event.next_attempt_at is None)


def item_status(entity: str, entity_id, *, live: bool) -> ItemStatus:
    events = list(
        SyncEvent.objects.filter(entity=entity, entity_id=str(entity_id)).order_by("-created_at")[:20]
    )
    undelivered = [event for event in events if event.delivered_at is None]
    if undelivered:
        failed = next((event for event in undelivered if _failed(event)), None)
        if failed is not None:
            return ItemStatus(FAILED, "SYNC FAILED · RETRY", str(failed.pk))
        return ItemStatus(PENDING, "SYNC PENDING", str(undelivered[0].pk))
    if not live:
        return ItemStatus(NOT_PUBLISHED, "NOT PUBLISHED")
    delivered = next((event for event in events if event.delivered_at), None)
    if delivered is None:
        return ItemStatus(LIVE, "LIVE")
    return ItemStatus(LIVE, f"LIVE · SYNCED {formatting.clock(delivered.delivered_at)}", str(delivered.pk))


def statuses_for(entity: str, items) -> dict[str, ItemStatus]:
    """Statuses for many ``(id, live)`` pairs in two queries (lists)."""
    items = [(str(item_id), live) for item_id, live in items]
    ids = [item_id for item_id, _ in items]
    undelivered: dict[str, list[SyncEvent]] = {}
    for event in SyncEvent.objects.filter(entity=entity, entity_id__in=ids, delivered_at__isnull=True):
        undelivered.setdefault(event.entity_id, []).append(event)
    last_delivered: dict[str, SyncEvent] = {}
    for event in SyncEvent.objects.filter(
        entity=entity, entity_id__in=ids, delivered_at__isnull=False
    ).order_by("-delivered_at"):
        last_delivered.setdefault(event.entity_id, event)
    result = {}
    for item_id, live in items:
        pending = undelivered.get(item_id, [])
        failed = next((event for event in pending if _failed(event)), None)
        if failed is not None:
            result[item_id] = ItemStatus(FAILED, "SYNC FAILED · RETRY", str(failed.pk))
        elif pending:
            result[item_id] = ItemStatus(PENDING, "SYNC PENDING", str(pending[0].pk))
        elif not live:
            result[item_id] = ItemStatus(NOT_PUBLISHED, "NOT PUBLISHED")
        elif item_id in last_delivered:
            stamp = formatting.clock(last_delivered[item_id].delivered_at)
            result[item_id] = ItemStatus(LIVE, f"LIVE · SYNCED {stamp}", str(last_delivered[item_id].pk))
        else:
            result[item_id] = ItemStatus(LIVE, "LIVE")
    return result


@dataclass
class Overall:
    state: str
    label: str
    pending: int
    failed: int

    @property
    def polling(self) -> bool:
        return self.pending > 0


def overall() -> Overall:
    undelivered = list(
        SyncEvent.objects.filter(delivered_at__isnull=True).only("attempts", "next_attempt_at")
    )
    failed = sum(1 for event in undelivered if _failed(event))
    pending = len(undelivered) - failed
    if failed:
        return Overall(FAILED, f"{failed} SYNC FAILURE{'S' if failed != 1 else ''}", pending, failed)
    if pending:
        return Overall(PENDING, f"{pending} UPDATE{'S' if pending != 1 else ''} PENDING", pending, failed)
    return Overall(LIVE, "SITE IN SYNC", 0, 0)
