"""Notification delivery status for staff (ADR-056, "Delivery status and retention").

Every read and staff action behind Client portal > Deliveries: email (``EmailDelivery``) and push
(``PushDelivery``) in one list, a summary, a detail view, "Retry now", "Cancel" and a capped bulk retry. Used only
by views behind ``staff_required``.

What staff never see here: push endpoints, browser keys or authentication secrets, push-service responses (none are
stored) and the push payload. Rows reach templates as ``DeliveryRow`` view models built from an allow-list of
fields, and the queries load only those fields, so a template cannot print a secret by accident. Email rows may
show the recipient's address and the subject (staff are internal); no email body is stored.

States. A row is *queued* (not tried yet), *retrying* (the last attempt failed and automatic attempts remain),
*sent*, *failed* (for good: no automatic attempt left, or a re-check refused it) or *cancelled* (by staff). The
models have no "cancelled" status (adding one would alter a column), so a cancelled row is ``failed`` with the
error category ``cancelled`` and no attempts left; both ``deliver`` functions refuse it.

Retries go through ``notifications.deliver`` and ``push.deliver`` with ``manual=True``: they may try once more
after the automatic attempts ran out, and every re-check still applies (live membership, the member's current
preference, the endpoint allowlist, the server key's fingerprint, the push's one-day expiry).
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from urllib.parse import urlencode

from django.core.paginator import EmptyPage, PageNotAnInteger, Paginator
from django.db import transaction
from django.db.models import CharField, Count, Q, Value
from django.urls import reverse
from django.utils import timezone

from apps.audit.services import record

from . import notifications, push
from .models import (
    EmailDelivery,
    InformationRequest,
    Notification,
    Organisation,
    PushDelivery,
    PushSubscription,
    Update,
)

logger = logging.getLogger(__name__)

EMAIL = "email"
PUSH = "push"
CHANNELS = {EMAIL: "Email", PUSH: "Push"}
MODELS = {EMAIL: EmailDelivery, PUSH: PushDelivery}

QUEUED = "queued"
RETRYING = "retrying"
SENT = "sent"
FAILED = "failed"
CANCELLED = "cancelled"
STATES = {
    QUEUED: ("Queued", "blue"),
    RETRYING: ("Retrying", "amber"),
    SENT: ("Sent", "green"),
    FAILED: ("Failed", "red"),
    CANCELLED: ("Cancelled", "slate"),
}

#: Status filter: value -> (label, states). ``failed`` is every row whose last attempt failed (what the Client
#: portal overview and the work queue link to); ``final`` is only those with nothing more to try.
STATUS_FILTERS = {
    "pending": ("Pending or retrying", (QUEUED, RETRYING)),
    "sent": ("Sent", (SENT,)),
    "failed": ("Last attempt failed", (RETRYING, FAILED)),
    "final": ("Failed for good", (FAILED,)),
    "cancelled": ("Cancelled", (CANCELLED,)),
}
DAY_FILTERS = {"1": "Last 24 hours", "7": "Last 7 days", "30": "Last 30 days", "90": "Last 90 days"}
TEST_KIND_LABEL = "Member's own test"

PAGE_SIZE = 50
#: Bulk "Retry all failed in this filter": at most this many rows per press, newest first.
BULK_RETRY_CAP = 100
#: ... and no new attempt starts after this many seconds, so the request stays well inside the worker timeout.
BULK_RETRY_BUDGET_SECONDS = 20

# --- Error categories, in plain English ------------------------------------------------------------------------------

#: category -> (short label, explanation). Push categories come from push.py; email ones are mapped below.
ERRORS: dict[str, tuple[str, str]] = {
    "gone": (
        "Device gone",
        "The browser removed this subscription; the device has been turned off. The member can turn "
        "notifications on again from Account in the portal.",
    ),
    "too_large": (
        "Too large",
        "The push service refused the message as too large. It is not retried; this would be a fault on our side.",
    ),
    "rate_limited": (
        "Rate limited",
        "The push service asked us to slow down (429). Automatic retries wait at least as long as it asked.",
    ),
    "server_error": (
        "Push service error",
        "The push service had a temporary fault (5xx).",
    ),
    "unauthorised": (
        "Not accepted",
        "The push service did not accept our signature (401 or 403). The member turns notifications off and on "
        "again on that device.",
    ),
    "redirect": (
        "Redirected",
        "The push service answered with a redirect. Redirects are never followed, so it is not retried.",
    ),
    "rejected": ("Rejected", "The push service rejected the message (4xx). It is not retried."),
    "timeout": (
        "Timed out",
        "The push service did not answer within 5 seconds.",
    ),
    "network": ("Network error", "The push service could not be reached."),
    "bad_keys": (
        "Unusable device keys",
        "The device's stored keys could not encrypt the message. The member turns notifications off and on again.",
    ),
    "push_off": (
        "Push is off",
        "Push notifications are switched off on this server (no key is configured), so nothing was sent.",
    ),
    "device_off": (
        "Device turned off",
        "The device had already been turned off when this push was due, so nothing was sent.",
    ),
    "old_key": (
        "Old server key",
        "The device subscribed with an earlier server key and has been turned off. The member turns "
        "notifications on again.",
    ),
    "not_member": (
        "No longer a member",
        "The recipient is no longer a live member of this organisation, so nothing was sent.",
    ),
    "expired": (
        "Expired",
        "The push is more than a day old. A notification that late is not worth showing, so it was not sent.",
    ),
    "blocked_endpoint": (
        "Address not allowed",
        "The device's push address is no longer on the allowlist of real push services; the device has been "
        "turned off.",
    ),
    "preference_off": (
        "Turned off by the member",
        "The member has since turned this kind of notification off, so nothing was sent.",
    ),
    "cancelled": ("Cancelled", "Cancelled by staff before it was sent. It will not be sent."),
}
#: Categories that mean a re-check refused the delivery (nothing was handed to a provider).
REFUSALS = frozenset(
    {
        "push_off",
        "device_off",
        "old_key",
        "not_member",
        "expired",
        "blocked_endpoint",
        "preference_off",
        "cancelled",
    }
)
#: Email stores a sentence for its own refusals and the exception class name for provider failures.
EMAIL_ERRORS = {
    notifications.NOT_MEMBER_ERROR: "not_member",
    notifications.PREFERENCE_OFF_ERROR: "preference_off",
    EmailDelivery.CANCELLED_ERROR: "cancelled",
}


def error_category(channel: str, last_error: str) -> str:
    if not last_error:
        return ""
    if channel == EMAIL:
        return EMAIL_ERRORS.get(last_error, "provider")
    return last_error


def error_text(channel: str, last_error: str) -> tuple[str, str]:
    """(short label, plain-English explanation) for a stored error; ('', '') when there is none."""
    category = error_category(channel, last_error)
    if not category:
        return "", ""
    if category == "provider":
        return f"Mail service error ({last_error})", f"The mail service raised {last_error} when we sent it."
    return ERRORS.get(
        category, (category.replace("_", " ").capitalize(), "No explanation is recorded for this.")
    )


def kind_label(kind: str) -> str:
    if kind == push.TEST_KIND:
        return TEST_KIND_LABEL
    try:
        return Notification.Kind(kind).label
    except ValueError:
        return kind.replace("_", " ").capitalize()


def kind_choices() -> list[tuple[str, str]]:
    return [*Notification.Kind.choices, (push.TEST_KIND, TEST_KIND_LABEL)]


# --- States -----------------------------------------------------------------------------------------------------------


def state_of(delivery) -> str:
    model = type(delivery)
    if delivery.status == model.Status.SENT:
        return SENT
    if delivery.status == model.Status.QUEUED:
        return QUEUED
    if delivery.last_error == model.CANCELLED_ERROR:
        return CANCELLED
    return RETRYING if delivery.attempts < model.MAX_ATTEMPTS else FAILED


def state_q(model, state: str) -> Q:
    status = model.Status
    cancelled = Q(status=status.FAILED, last_error=model.CANCELLED_ERROR)
    return {
        QUEUED: Q(status=status.QUEUED),
        RETRYING: Q(status=status.FAILED, attempts__lt=model.MAX_ATTEMPTS) & ~cancelled,
        SENT: Q(status=status.SENT),
        FAILED: Q(status=status.FAILED, attempts__gte=model.MAX_ATTEMPTS) & ~cancelled,
        CANCELLED: cancelled,
    }[state]


def _states_q(model, states) -> Q:
    combined = Q(pk__in=[])
    for state in states:
        combined |= state_q(model, state)
    return combined


# --- View models ------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class DeliveryRow:
    """What a template may show about one delivery. Nothing else reaches it."""

    channel: str
    pk: int
    queued_at: datetime
    organisation_id: int | None
    organisation_name: str
    member_name: str
    kind: str
    state: str
    attempts: int
    max_attempts: int
    next_attempt_at: datetime | None
    last_error: str
    sent_at: datetime | None
    notification_id: int | None
    email: str = ""  # email channel only
    subject: str = ""  # email channel only
    device: str = ""  # push channel only: a coarse label such as "Chrome on Android"

    @property
    def key(self) -> str:
        return f"{self.channel}-{self.pk}"

    @property
    def channel_label(self) -> str:
        return CHANNELS[self.channel]

    @property
    def kind_label(self) -> str:
        return kind_label(self.kind)

    @property
    def state_label(self) -> str:
        return STATES[self.state][0]

    @property
    def state_tone(self) -> str:
        return STATES[self.state][1]

    @property
    def error_label(self) -> str:
        return error_text(self.channel, self.last_error)[0]

    @property
    def error_help(self) -> str:
        return error_text(self.channel, self.last_error)[1]

    @property
    def is_refusal(self) -> bool:
        return error_category(self.channel, self.last_error) in REFUSALS

    @property
    def due_at(self) -> datetime | None:
        """When an automatic attempt is next due (only while one remains)."""
        return self.next_attempt_at if self.state in (QUEUED, RETRYING) else None

    @property
    def can_retry(self) -> bool:
        return self.state in (QUEUED, RETRYING, FAILED)

    @property
    def can_cancel(self) -> bool:
        return self.state in (QUEUED, RETRYING)

    @property
    def detail_url(self) -> str:
        return reverse("portaladmin:delivery", args=[self.channel, self.pk])


EMAIL_FIELDS = (
    "id",
    "created_at",
    "kind",
    "status",
    "attempts",
    "last_error",
    "next_attempt_at",
    "sent_at",
    "to_email",
    "subject",
    "notification_id",
    "organisation__id",
    "organisation__name",
    "recipient__id",
    "recipient__full_name",
    "recipient__email",
)
# Never the subscription's endpoint, p256dh or auth: they are not even loaded.
PUSH_FIELDS = (
    "id",
    "created_at",
    "kind",
    "status",
    "attempts",
    "last_error",
    "next_attempt_at",
    "sent_at",
    "notification__id",
    "notification__organisation__id",
    "notification__organisation__name",
    "subscription__id",
    "subscription__label",
    "subscription__member__id",
    "subscription__member__user__id",
    "subscription__member__user__full_name",
    "subscription__member__user__email",
    "subscription__member__organisation__id",
    "subscription__member__organisation__name",
)


#: The detail page also needs where the notification points (its route name and arguments).
NOTE_FIELDS = ("notification__id", "notification__url_name", "notification__url_kwargs")


def _emails(*extra: str):
    related = ["organisation", "recipient"] + (["notification"] if extra else [])
    return EmailDelivery.objects.select_related(*related).only(*EMAIL_FIELDS, *extra)


def _pushes(*extra: str):
    return PushDelivery.objects.select_related(
        "notification__organisation", "subscription__member__user", "subscription__member__organisation"
    ).only(*PUSH_FIELDS, *extra)


def email_row(d: EmailDelivery) -> DeliveryRow:
    return DeliveryRow(
        channel=EMAIL,
        pk=d.pk,
        queued_at=d.created_at,
        organisation_id=d.organisation_id,
        organisation_name=d.organisation.name,
        member_name=d.recipient.full_name or d.recipient.email,
        kind=d.kind,
        state=state_of(d),
        attempts=d.attempts,
        max_attempts=EmailDelivery.MAX_ATTEMPTS,
        next_attempt_at=d.next_attempt_at,
        last_error=d.last_error,
        sent_at=d.sent_at,
        notification_id=d.notification_id,
        email=d.to_email,
        subject=d.subject,
    )


def push_row(d: PushDelivery) -> DeliveryRow:
    member = d.subscription.member
    # The notification's organisation; a member's own test push has none, so their membership's.
    organisation = d.notification.organisation if d.notification_id else member.organisation
    return DeliveryRow(
        channel=PUSH,
        pk=d.pk,
        queued_at=d.created_at,
        organisation_id=organisation.pk,
        organisation_name=organisation.name,
        member_name=member.user.full_name or member.user.email,
        kind=d.kind,
        state=state_of(d),
        attempts=d.attempts,
        max_attempts=PushDelivery.MAX_ATTEMPTS,
        next_attempt_at=d.next_attempt_at,
        last_error=d.last_error,
        sent_at=d.sent_at,
        notification_id=d.notification_id,
        device=d.subscription.label,
    )


# --- Filters ----------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Filters:
    channel: str = ""
    status: str = ""
    organisation: int | None = None
    kind: str = ""
    days: str = ""

    @classmethod
    def from_query(cls, data) -> Filters:
        """Read the query string; anything unknown is ignored (shows everything for that filter)."""
        channel = data.get("channel", "")
        status = data.get("status", "")
        kind = data.get("kind", "")
        days = data.get("days", "")
        try:
            organisation = int(data.get("org", "") or 0) or None
        except (TypeError, ValueError):
            organisation = None
        return cls(
            channel=channel if channel in CHANNELS else "",
            status=status if status in STATUS_FILTERS else "",
            organisation=organisation,
            kind=kind if kind in dict(kind_choices()) else "",
            days=days if days in DAY_FILTERS else "",
        )

    @property
    def active(self) -> bool:
        return bool(self.channel or self.status or self.organisation or self.kind or self.days)

    def query(self, **overrides) -> str:
        """The query string for these filters (with ``overrides``), for links and redirects."""
        values = {
            "channel": self.channel,
            "status": self.status,
            "org": self.organisation or "",
            "kind": self.kind,
            "days": self.days,
            **overrides,
        }
        return urlencode({k: v for k, v in values.items() if v not in ("", None)})

    def channels(self) -> tuple[str, ...]:
        return (self.channel,) if self.channel else (EMAIL, PUSH)

    def apply(self, channel: str, qs, now=None):
        model = MODELS[channel]
        if self.status:
            qs = qs.filter(_states_q(model, STATUS_FILTERS[self.status][1]))
        if self.kind:
            qs = qs.filter(kind=self.kind)
        if self.days:
            qs = qs.filter(created_at__gte=(now or timezone.now()) - timedelta(days=int(self.days)))
        if self.organisation:
            if channel == EMAIL:
                qs = qs.filter(organisation_id=self.organisation)
            else:
                qs = qs.filter(
                    Q(notification__organisation_id=self.organisation)
                    | Q(notification__isnull=True, subscription__member__organisation_id=self.organisation)
                )
        return qs


def _keys(filters: Filters, *, states=None, now=None):
    """(channel, id, created_at) of every matching row in both channels, newest first: one UNION ALL query."""
    parts = []
    for channel in filters.channels():
        qs = filters.apply(channel, MODELS[channel].objects.all(), now)
        if states is not None:
            qs = qs.filter(_states_q(MODELS[channel], states))
        parts.append(
            qs.annotate(channel=Value(channel, output_field=CharField())).values(
                "channel", "id", "created_at"
            )
        )
    combined = parts[0] if len(parts) == 1 else parts[0].union(parts[1], all=True)
    return combined.order_by("-created_at", "-id")


def load_rows(keys) -> list[DeliveryRow]:
    """View models for ``keys`` (dicts with channel and id), in the same order: two queries at most."""
    ids = {EMAIL: [], PUSH: []}
    for key in keys:
        ids[key["channel"]].append(key["id"])
    emails = _emails().in_bulk(ids[EMAIL]) if ids[EMAIL] else {}
    pushes = _pushes().in_bulk(ids[PUSH]) if ids[PUSH] else {}
    rows = []
    for key in keys:
        if key["channel"] == EMAIL and key["id"] in emails:
            rows.append(email_row(emails[key["id"]]))
        elif key["channel"] == PUSH and key["id"] in pushes:
            rows.append(push_row(pushes[key["id"]]))
    return rows


@dataclass
class Listing:
    rows: list[DeliveryRow]
    page: object
    total: int
    retryable: int  # rows in this filter whose last attempt failed (the bulk retry's candidates)

    @property
    def bulk_count(self) -> int:
        return min(self.retryable, BULK_RETRY_CAP)


def listing(filters: Filters, page=1) -> Listing:
    """One page of deliveries, newest first. A fixed number of queries, however many rows."""
    paginator = Paginator(_keys(filters), PAGE_SIZE)
    try:
        current = paginator.page(page or 1)
    except PageNotAnInteger:
        current = paginator.page(1)
    except EmptyPage:
        current = paginator.page(paginator.num_pages)
    keys = list(current.object_list)
    retryable = _keys(filters, states=(RETRYING, FAILED)).count()
    return Listing(rows=load_rows(keys), page=current, total=paginator.count, retryable=retryable)


def organisations():
    return Organisation.objects.only("id", "name").order_by("name")


# --- Summary ----------------------------------------------------------------------------------------------------------


@dataclass
class ChannelSummary:
    channel: str
    day: dict
    week: dict

    @property
    def label(self) -> str:
        return CHANNELS[self.channel]

    @property
    def rows(self) -> list[tuple[str, str, dict]]:
        """(window, the matching ``days`` filter, counts) for the summary table."""
        return [("Last 24 hours", "1", self.day), ("Last 7 days", "7", self.week)]


def summary(now=None) -> dict:
    """Per channel, for rows queued in the last 24 hours and 7 days: sent, pending or retrying, failed for good
    (and cancelled). Push devices: active, and turned off in the last 7 days by reason. Four queries."""
    now = now or timezone.now()
    day_ago, week_ago = now - timedelta(days=1), now - timedelta(days=7)
    channels = []
    for channel, model in MODELS.items():
        buckets = {
            "sent": state_q(model, SENT),
            "pending": state_q(model, QUEUED) | state_q(model, RETRYING),
            "failed": state_q(model, FAILED),
            "cancelled": state_q(model, CANCELLED),
        }
        aggregates = {}
        for name, condition in buckets.items():
            aggregates[f"day_{name}"] = Count("pk", filter=condition & Q(created_at__gte=day_ago))
            aggregates[f"week_{name}"] = Count("pk", filter=condition)
        counts = model.objects.filter(created_at__gte=week_ago).aggregate(**aggregates)
        channels.append(
            ChannelSummary(
                channel=channel,
                day={name: counts[f"day_{name}"] for name in buckets},
                week={name: counts[f"week_{name}"] for name in buckets},
            )
        )
    labels = dict(PushSubscription.Reason.choices)
    disabled = [
        {
            "reason": item["disabled_reason"],
            "label": labels.get(item["disabled_reason"], "Other"),
            "count": item["n"],
        }
        for item in PushSubscription.objects.filter(disabled_at__gte=week_ago)
        .values("disabled_reason")
        .annotate(n=Count("id"))
        .order_by("-n", "disabled_reason")
    ]
    return {
        "channels": channels,
        "devices_active": PushSubscription.objects.filter(disabled_at__isnull=True).count(),
        "devices_disabled": disabled,
        "devices_disabled_total": sum(item["count"] for item in disabled),
        "push_enabled": push.enabled(),
    }


# --- Detail -----------------------------------------------------------------------------------------------------------


@dataclass
class Detail:
    row: DeliveryRow
    history: list = field(default_factory=list)
    device: dict | None = None
    record_url: str = ""
    record_label: str = ""
    record_note: str = ""
    organisation_url: str = ""


def _record_link(note: Notification | None, kind: str) -> tuple[str, str, str]:
    """(url, label, note) of the staff page for what the notification is about."""
    if kind == push.TEST_KIND:
        return "", "", "A test the member sent to their own device; it is not about a record."
    if note is None:
        return "", "", "The notification this delivery belonged to has been deleted."
    pk = (note.url_kwargs or {}).get("pk")
    target = None
    if note.url_name == "challenge":
        target = ("portaladmin:challenge", pk, "Open the challenge")
    elif note.url_name == "project":
        target = ("portaladmin:project", pk, "Open the project")
    elif note.url_name == "deliverable":
        target = ("portaladmin:deliverable", pk, "Open the deliverable")
    elif note.url_name == "change":
        target = ("portaladmin:change_review", pk, "Open the change request")
    elif note.url_name == "question":
        challenge = InformationRequest.objects.filter(pk=pk).values_list("challenge_id", flat=True).first()
        target = ("portaladmin:challenge", challenge, "Open the question's challenge")
    elif note.url_name == "update":
        challenge = Update.objects.filter(pk=pk).values_list("challenge_id", flat=True).first()
        target = ("portaladmin:challenge", challenge, "Open the update's challenge")
    if target is None or not target[1]:
        return "", "", "The record this notification pointed to no longer exists."
    return reverse(target[0], args=[target[1]]), target[2], ""


def _history(entity_type: str, entity_id) -> list:
    from apps.audit.models import AuditEvent
    from apps.audit.services import ACTIONS

    events = AuditEvent.objects.filter(entity_type=entity_type, entity_id=str(entity_id)).only(
        "created_at", "action", "summary", "actor_email"
    )[:25]
    return [
        {
            "at": e.created_at,
            "action": ACTIONS.get(e.action, e.action),
            "summary": e.summary,
            "by": e.actor_email,
        }
        for e in events
    ]


def detail(channel: str, pk: int) -> Detail | None:
    if channel == EMAIL:
        d = _emails(*NOTE_FIELDS).filter(pk=pk).first()
        if d is None:
            return None
        row = email_row(d)
        note = d.notification if d.notification_id else None
        result = Detail(row=row, history=_history("portal.emaildelivery", pk))
    elif channel == PUSH:
        d = _pushes(*NOTE_FIELDS[1:]).filter(pk=pk).first()
        if d is None:
            return None
        row = push_row(d)
        note = d.notification if d.notification_id else None
        sub = PushSubscription.objects.only(
            "id", "label", "created_at", "disabled_at", "disabled_reason"
        ).get(pk=d.subscription_id)
        result = Detail(
            row=row,
            history=_history("portal.pushdelivery", pk),
            device={
                "label": sub.label,
                "added": sub.created_at,
                "active": sub.disabled_at is None,
                "disabled_at": sub.disabled_at,
                "reason": sub.get_disabled_reason_display() if sub.disabled_reason else "",
                "history": _history("portal.pushsubscription", sub.pk),
            },
        )
    else:
        return None
    result.record_url, result.record_label, result.record_note = _record_link(note, row.kind)
    if row.organisation_id:
        result.organisation_url = reverse("portaladmin:org", args=[row.organisation_id])
    return result


# --- Actions ----------------------------------------------------------------------------------------------------------


@dataclass(frozen=True)
class Outcome:
    ok: bool
    message: str
    state: str = ""
    category: str = ""


def _load(channel: str, pk: int):
    model = MODELS.get(channel)
    if model is None:
        return None
    return model.objects.only("id", "status", "attempts", "last_error").filter(pk=pk).first()


def _deliver(channel: str, pk: int):
    """One manual attempt through the channel's own ``deliver`` (which re-checks everything first)."""
    if channel == EMAIL:
        return notifications.deliver(pk, manual=True)
    return push.deliver(pk, manual=True)


def _attempt(channel: str, pk: int) -> tuple[str, str]:
    """``_deliver``, then (state, last_error) afterwards; ('', '') when it could not even be attempted."""
    result = _deliver(channel, pk)
    if result is None:
        return "", ""
    return state_of(result), result.last_error


def _explain(channel: str, state: str, last_error: str, due_at=None) -> Outcome:
    if state == SENT:
        return Outcome(True, "Sent.", state)
    if not state:
        return Outcome(
            False, "It could not be attempted: an internal error was logged. Try again later.", state
        )
    label, explanation = error_text(channel, last_error)
    category = error_category(channel, last_error)
    if category in REFUSALS:
        return Outcome(False, f"Not sent: {explanation}", state, category)
    if state == RETRYING and due_at is not None:
        then = f"The next automatic attempt is at {timezone.localtime(due_at):%H:%M}."
    else:
        then = "No automatic attempts are left."
    return Outcome(False, f"Still failing ({label}). {explanation} {then}", state, category)


def retry(channel: str, pk: int, *, actor, request=None) -> Outcome | None:
    """Staff "Retry now" on a queued, retrying or failed delivery. None when there is no such delivery."""
    d = _load(channel, pk)
    if d is None:
        return None
    before = state_of(d)
    if before == SENT:
        return Outcome(False, "Already sent. A sent delivery is never sent again.", SENT)
    if before == CANCELLED:
        return Outcome(False, "This delivery was cancelled, so it will not be sent.", CANCELLED, "cancelled")
    result = _deliver(channel, pk)
    state, last_error = (state_of(result), result.last_error) if result is not None else ("", "")
    outcome = _explain(channel, state, last_error, result.next_attempt_at if result is not None else None)
    result = "sent" if outcome.ok else f"{state or 'not attempted'} ({outcome.category or 'no category'})"
    record(
        "portal.delivery_retried",
        request=request,
        actor=actor,
        entity=d,
        summary=f"Retried {CHANNELS[channel].lower()} delivery {pk}: {result}",
        channel=channel,
        result=state,
        category=outcome.category,
    )
    return outcome


def cancel(channel: str, pk: int, *, actor, request=None) -> Outcome | None:
    """Staff "Cancel" on a queued or retrying delivery: it is never sent. None when there is no such delivery."""
    model = MODELS.get(channel)
    if model is None:
        return None
    with transaction.atomic():
        # Waits for a send in progress (deliver holds the same row lock), then decides on the final state.
        d = (
            model.objects.select_for_update()
            .only("id", "status", "attempts", "last_error")
            .filter(pk=pk)
            .first()
        )
        if d is None:
            return None
        state = state_of(d)
        if state not in (QUEUED, RETRYING):
            return Outcome(
                False, f"Only a queued or retrying delivery can be cancelled; this one is {state}.", state
            )
        d.status = model.Status.FAILED
        d.last_error = model.CANCELLED_ERROR
        d.attempts = max(d.attempts, model.MAX_ATTEMPTS)
        d.save(update_fields=["status", "last_error", "attempts"])
    record(
        "portal.delivery_cancelled",
        request=request,
        actor=actor,
        entity=d,
        summary=f"Cancelled {CHANNELS[channel].lower()} delivery {pk} (was {state})",
        channel=channel,
    )
    return Outcome(True, "Cancelled. It will not be sent.", CANCELLED, "cancelled")


@dataclass
class BulkResult:
    attempted: int = 0
    sent: int = 0
    failing: int = 0
    refused: int = 0
    left: int = 0  # matched but not attempted (over the cap or the time budget)

    @property
    def message(self) -> str:
        if not self.attempted and not self.left:
            return "Nothing to retry: no delivery in this filter has failed."
        parts = [f"Retried {self.attempted}: {self.sent} sent"]
        if self.failing:
            parts.append(f"{self.failing} still failing")
        if self.refused:
            parts.append(f"{self.refused} not sent (a re-check refused them)")
        text = ", ".join(parts) + "."
        if self.left:
            text += f" {self.left} more not tried yet; press Retry again to continue."
        return text


def bulk_retry(
    filters: Filters,
    *,
    actor,
    request=None,
    cap: int | None = None,
    budget: float | None = None,
) -> BulkResult:
    """Retry every delivery in ``filters`` whose last attempt failed, newest first, at most ``cap`` of them
    (``BULK_RETRY_CAP``) and no new attempt after ``budget`` seconds (``BULK_RETRY_BUDGET_SECONDS``). One audit
    event for the batch."""
    cap = BULK_RETRY_CAP if cap is None else cap
    budget = BULK_RETRY_BUDGET_SECONDS if budget is None else budget
    matching = _keys(filters, states=(RETRYING, FAILED))
    keys = list(matching[: max(cap, 0)])
    result = BulkResult(left=max(0, matching.count() - len(keys)))
    started = time.monotonic()
    tried: list[str] = []
    for index, key in enumerate(keys):
        if time.monotonic() - started > budget:
            result.left += len(keys) - index
            break
        state, last_error = _attempt(key["channel"], key["id"])
        result.attempted += 1
        tried.append(f"{key['channel']}-{key['id']}")
        if state == SENT:
            result.sent += 1
        elif error_category(key["channel"], last_error) in REFUSALS:
            result.refused += 1
        else:
            result.failing += 1
    if result.attempted:
        record(
            "portal.delivery_bulk_retried",
            request=request,
            actor=actor,
            entity_type="portal.delivery",
            summary=result.message,
            filters=filters.query(),
            deliveries=tried,
            sent=result.sent,
            failing=result.failing,
            refused=result.refused,
            left=result.left,
        )
    return result
