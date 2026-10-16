"""Relay hook (brief section 8, amendment A8). Relay is not built: this is only the subscription point.

After an event about a post or a role is delivered, ``relay_sync`` is sent when
``CONTENT_RELAY_SYNC_ENABLED`` is true (off by default). A future Relay integration connects a receiver
that upserts or archives its knowledge document. Receivers never block or fail a publish.
"""

import logging

from django.conf import settings
from django.dispatch import Signal

logger = logging.getLogger(__name__)

# Sent with ``entity`` ("post" or "role"), ``entity_id``, ``action`` and ``kind`` ("publish" or "remove").
relay_sync = Signal()

RELAY_ENTITIES = ("post", "role")


def after_delivery(event) -> None:
    if not settings.CONTENT_RELAY_SYNC_ENABLED or event.entity not in RELAY_ENTITIES:
        return
    try:
        relay_sync.send_robust(
            sender=after_delivery,
            entity=event.entity,
            entity_id=event.entity_id,
            action=event.action,
            kind=event.kind,
        )
    except Exception:  # noqa: BLE001 - Relay must never affect content sync
        logger.exception("Relay hook failed", extra={"event_id": str(event.pk)})
