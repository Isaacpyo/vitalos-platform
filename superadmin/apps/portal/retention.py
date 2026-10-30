"""Retention for client portal delivery records (ADR-056, "Delivery status and retention"; the policy is
docs/ai-data/operations/portal-delivery-retention.md).

Run once a day by the content tick (``content_sync.tick.run_daily``, beside recruitment retention) and on demand by
``manage.py portal_delivery_retention``. It deletes only:

* sent ``EmailDelivery`` and ``PushDelivery`` rows sent more than ``PORTAL_DELIVERY_SENT_RETENTION_DAYS`` (90) ago;
* failed-for-good and cancelled rows queued more than ``PORTAL_DELIVERY_FAILED_RETENTION_DAYS`` (180) ago;
* turned-off ``PushSubscription`` rows turned off more than ``PORTAL_PUSH_DISABLED_RETENTION_DAYS`` (90) ago, and
  only once none of their deliveries is still kept: deleting a device deletes its deliveries with it, so a device
  waits until its own records have aged out.

Never: queued or retrying deliveries, active devices, notifications, audit events or anything else. Like the other
retention jobs it is a dry run that only logs the counts until a person sets ``RETENTION_ENFORCE=true``. A setting
below ``MIN_DAYS`` counts as ``MIN_DAYS``, so the delivery page's seven-day summary always has its records.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone

from apps.audit.services import record

from .deliveries import CANCELLED, FAILED, state_q
from .models import EmailDelivery, PushDelivery, PushSubscription

logger = logging.getLogger(__name__)

MIN_DAYS = 7
DEFAULTS = {
    "PORTAL_DELIVERY_SENT_RETENTION_DAYS": 90,
    "PORTAL_DELIVERY_FAILED_RETENTION_DAYS": 180,
    "PORTAL_PUSH_DISABLED_RETENTION_DAYS": 90,
}
CATEGORIES = {
    "email_sent": "sent email record(s)",
    "email_failed": "failed or cancelled email record(s)",
    "push_sent": "sent push record(s)",
    "push_failed": "failed or cancelled push record(s)",
    "devices": "turned-off push device(s)",
}


def _days(name: str) -> int:
    try:
        value = int(getattr(settings, name, DEFAULTS[name]))
    except (TypeError, ValueError):
        value = DEFAULTS[name]
    return max(value, MIN_DAYS)


@dataclass(frozen=True)
class Policy:
    sent_days: int
    failed_days: int
    device_days: int
    enforce: bool

    def cutoffs(self, now: datetime) -> dict[str, datetime]:
        return {
            "sent": now - timedelta(days=self.sent_days),
            "failed": now - timedelta(days=self.failed_days),
            "devices": now - timedelta(days=self.device_days),
        }


def policy() -> Policy:
    return Policy(
        sent_days=_days("PORTAL_DELIVERY_SENT_RETENTION_DAYS"),
        failed_days=_days("PORTAL_DELIVERY_FAILED_RETENTION_DAYS"),
        device_days=_days("PORTAL_PUSH_DISABLED_RETENTION_DAYS"),
        enforce=bool(settings.RETENTION_ENFORCE),
    )


def _sent_q(model, cutoff) -> Q:
    # A sent row counts from when it was sent (its queue time if that was never stamped).
    return Q(status=model.Status.SENT) & (
        Q(sent_at__lt=cutoff) | Q(sent_at__isnull=True, created_at__lt=cutoff)
    )


def _failed_q(model, cutoff) -> Q:
    # Failed for good or cancelled only: a retrying row (attempts left) is pending and never deleted.
    return (state_q(model, FAILED) | state_q(model, CANCELLED)) & Q(created_at__lt=cutoff)


def plan(now: datetime | None = None, pol: Policy | None = None) -> dict:
    """The querysets the policy covers, by category (nothing is evaluated here)."""
    now = now or timezone.now()
    pol = pol or policy()
    cut = pol.cutoffs(now)
    push_due = _sent_q(PushDelivery, cut["sent"]) | _failed_q(PushDelivery, cut["failed"])
    kept = PushDelivery.objects.filter(subscription=OuterRef("pk")).exclude(push_due)
    return {
        "email_sent": EmailDelivery.objects.filter(_sent_q(EmailDelivery, cut["sent"])),
        "email_failed": EmailDelivery.objects.filter(_failed_q(EmailDelivery, cut["failed"])),
        "push_sent": PushDelivery.objects.filter(_sent_q(PushDelivery, cut["sent"])),
        "push_failed": PushDelivery.objects.filter(_failed_q(PushDelivery, cut["failed"])),
        "devices": PushSubscription.objects.filter(disabled_at__lt=cut["devices"]).exclude(Exists(kept)),
    }


def counts(now: datetime | None = None, pol: Policy | None = None) -> dict[str, int]:
    return {name: qs.count() for name, qs in plan(now, pol).items()}


def run(now: datetime | None = None, *, enforce: bool | None = None) -> int:
    """Apply (or, without RETENTION_ENFORCE, only count) the policy. Returns the rows deleted (or that would be)."""
    now = now or timezone.now()
    pol = policy()
    enforce = pol.enforce if enforce is None else enforce
    due = plan(now, pol)
    found = {name: qs.count() for name, qs in due.items()}
    total = sum(found.values())
    if not enforce:
        logger.info("Portal delivery retention dry run", extra={"would_delete": found, "total": total})
        return total
    deleted = dict.fromkeys(CATEGORIES, 0)
    cutoff = pol.cutoffs(now)["devices"]
    with transaction.atomic():
        devices = list(due["devices"].values_list("pk", flat=True))
        for name in ("email_sent", "email_failed", "push_sent", "push_failed"):
            deleted[name] = due[name].delete()[0]
        # Re-checked at delete time: still turned off, and no delivery left that the delete would cascade to.
        _, by_model = (
            PushSubscription.objects.filter(pk__in=devices, disabled_at__lt=cutoff)
            .exclude(Exists(PushDelivery.objects.filter(subscription=OuterRef("pk"))))
            .delete()
        )
        deleted["devices"] = by_model.get(PushSubscription._meta.label, 0)
    removed = sum(deleted.values())
    logger.info("Portal delivery retention", extra={"deleted": deleted, "total": removed})
    if removed:
        record(
            "portal.delivery_retention",
            entity_type="portal.delivery",
            summary="Deleted under the retention policy: "
            + ", ".join(f"{deleted[name]} {label}" for name, label in CATEGORIES.items() if deleted[name]),
            **deleted,
        )
    return removed
