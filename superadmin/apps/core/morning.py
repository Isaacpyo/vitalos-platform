"""The morning Overview (findings E4, F1, F2; ADR-049): what needs doing today, across every module.

Each section is a list of counts, and every count links to the filtered list it counts. Sections the
user may not see are left out. Business rules stay here; the view only renders. Relay numbers come
from the website through the existing Relay client and degrade to "Relay not reachable" when the
client fails, is not configured or answers late.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from django.core.cache import cache
from django.db.models import Min
from django.urls import reverse
from django.utils import timezone

logger = logging.getLogger(__name__)

RELAY_TIMEOUT_SECONDS = 3
RELAY_CACHE_SECONDS = 60
RELAY_STALE = timedelta(hours=24)


@dataclass
class Count:
    label: str
    value: int | str
    url: str
    tone: str = "neutral"  # neutral | attention | good
    note: str = ""
    key: str = ""


@dataclass
class Section:
    key: str
    title: str
    url: str
    counts: list[Count] = field(default_factory=list)
    note: str = ""
    error: str = ""
    status: str = ""


def _url(name: str, query: str = "", *args) -> str:
    url = reverse(name, args=args or None)
    return f"{url}?{query}" if query else url


def _tone(value: int, attention_when_positive: bool = True) -> str:
    return "attention" if attention_when_positive and value else "neutral"


# --- Enquiries ------------------------------------------------------------------------------------


def enquiries_section(now: datetime) -> Section:
    from apps.enquiries import overdue
    from apps.enquiries.models import Enquiry
    from apps.enquiries.selectors import OPEN_STATUSES

    late = overdue.overdue_count(now)
    unassigned = Enquiry.objects.filter(status__in=OPEN_STATUSES, assignee__isnull=True).count()
    open_now = Enquiry.objects.filter(status__in=OPEN_STATUSES).count()
    return Section(
        "enquiries",
        "Enquiries",
        _url("enquiries:inbox"),
        [
            Count("Overdue", late, _url("enquiries:inbox", "f=overdue"), _tone(late), key="overdue"),
            Count(
                "Unassigned",
                unassigned,
                _url("enquiries:inbox", "f=unassigned"),
                _tone(unassigned),
                key="unassigned",
            ),
            Count("Open", open_now, _url("enquiries:inbox", "f=open"), key="open"),
        ],
    )


# --- Relay --------------------------------------------------------------------------------------


def _parse(value) -> datetime | None:
    from apps.relay.presenters import parse_time

    return parse_time(value) if value else None


def _age(moment: datetime | None, now: datetime) -> str:
    if moment is None:
        return "Never"
    minutes = max(int((now - moment).total_seconds() // 60), 0)
    if minutes < 60:
        return f"{minutes} min ago"
    if minutes < 48 * 60:
        return f"{minutes // 60} h ago"
    return f"{minutes // 1440} days ago"


def relay_numbers(user) -> dict:
    """Waiting conversations, open gaps (7 days), FAQ entries awaiting confirmation and the oldest
    source sync, from the website's Relay admin API. Raises ``RelayError``."""
    from apps.relay.client import HttpRelayClient, get_client

    client = get_client(user)
    if isinstance(client, HttpRelayClient):
        client.timeout = RELAY_TIMEOUT_SECONDS  # the Overview must not wait 8 s for one card
    inbox = client.inbox("needs") or {}
    gaps = (client.gaps(7) or {}).get("gaps") or []
    sources = (client.knowledge(source="faq") or {}).get("sources") or {}
    synced = [_parse((sources.get(key) or {}).get("syncedAt")) for key in ("cms", "repo", "faq")]
    synced = [moment for moment in synced if moment is not None]
    return {
        "waiting": int((inbox.get("counts") or {}).get("needs") or 0),
        "gaps": sum(1 for gap in gaps if (gap.get("status") or "open") == "open"),
        "awaiting": int((sources.get("faq") or {}).get("awaiting") or 0),
        "oldest_sync": min(synced).isoformat() if synced else None,
    }


def relay_section(user, now: datetime) -> Section | None:
    from apps.relay.client import RelayError
    from apps.relay.selectors import nav_visible

    if not nav_visible(user):
        return None
    section = Section("relay", "Relay", _url("relay:inbox"))
    key = f"overview:relay:{user.pk}"
    numbers = cache.get(key)
    if numbers is None:
        try:
            numbers = relay_numbers(user)
        except RelayError as error:
            section.error = f"Relay not reachable. {error.user_message}"
            return section
        except Exception:  # noqa: BLE001 - one card must never break the Overview
            logger.warning("Overview: Relay numbers failed", exc_info=True)
            section.error = "Relay not reachable."
            return section
        cache.set(key, numbers, RELAY_CACHE_SECONDS)
    oldest = datetime.fromisoformat(numbers["oldest_sync"]) if numbers["oldest_sync"] else None
    stale = oldest is None or now - oldest > RELAY_STALE
    section.counts = [
        Count(
            "Waiting now",
            numbers["waiting"],
            _url("relay:inbox", "tab=needs"),
            _tone(numbers["waiting"]),
            key="waiting",
        ),
        Count("Gaps this week", numbers["gaps"], _url("relay:knowledge") + "#gaps", key="gaps"),
        Count(
            "Awaiting confirmation",
            numbers["awaiting"],
            _url("relay:knowledge", "view=confirm"),
            _tone(numbers["awaiting"]),
            key="awaiting",
        ),
        Count(
            "Oldest knowledge sync",
            _age(oldest, now),
            _url("relay:knowledge"),
            "attention" if stale else "neutral",
            note="Over 24 hours old" if stale else "",
            key="sync",
        ),
    ]
    return section


# --- Careers and Insights -----------------------------------------------------------------------


def careers_section(user) -> Section | None:
    from apps.careers import access
    from apps.careers.models import Application, ApplicationStage, Role, RoleStatus

    if not access.can_view_roles(user):
        return None
    counts = []
    if access.can_view_applications(user):
        new = Application.objects.filter(stage=ApplicationStage.NEW).count()
        counts.append(
            Count("New applications", new, _url("careers:applications", "tab=new"), _tone(new), key="new")
        )
    opened = Role.objects.filter(status=RoleStatus.OPEN).count()
    drafts = Role.objects.filter(status=RoleStatus.DRAFT).count()
    counts += [
        Count("Roles open", opened, _url("careers:roles", "tab=open"), key="open"),
        Count("Draft roles", drafts, _url("careers:roles", "tab=drafts"), key="drafts"),
    ]
    return Section("careers", "Careers", _url("careers:roles"), counts)


def insights_section(user) -> Section | None:
    from apps.insights import access
    from apps.insights.models import Post, PostStatus

    if not access.can_view(user):
        return None
    drafts = Post.objects.filter(status=PostStatus.DRAFT).count()
    review = Post.objects.filter(status__in=(PostStatus.IN_REVIEW, PostStatus.APPROVED)).count()
    next_at = Post.objects.filter(status=PostStatus.SCHEDULED, publish_at__isnull=False).aggregate(
        at=Min("publish_at")
    )["at"]
    scheduled = (
        timezone.localtime(next_at).strftime("%d %b, %H:%M").lstrip("0") if next_at else "None scheduled"
    )
    return Section(
        "insights",
        "Insights",
        _url("insights:posts"),
        [
            Count("Drafts", drafts, _url("insights:posts", "tab=drafts"), key="drafts"),
            Count("In review", review, _url("insights:posts", "tab=review"), _tone(review), key="review"),
            Count("Next scheduled", scheduled, _url("insights:posts", "tab=scheduled"), key="scheduled"),
        ],
    )


# --- Website sync and system health -------------------------------------------------------------


def sync_section(now: datetime) -> Section:
    from apps.content_sync import status
    from apps.content_sync.models import TickState

    overall = status.overall()
    state = TickState.load()
    last = state.last_finished_at
    tick_stale = last is None or now - last > timedelta(days=1)
    return Section(
        "sync",
        "Website sync",
        _url("content_sync:sync"),
        [
            Count(
                "Status",
                overall.label.capitalize(),
                _url("content_sync:sync"),
                "attention" if overall.failed else "neutral",
                key="status",
            ),
            Count(
                "Failed deliveries",
                overall.failed,
                _url("content_sync:sync"),
                _tone(overall.failed),
                key="failed",
            ),
            Count(
                "Last tick",
                _age(last, now),
                _url("content_sync:sync"),
                "attention" if tick_stale else "neutral",
                note="Over a day ago" if tick_stale else "",
                key="tick",
            ),
        ],
    )


def health_section() -> Section:
    from apps.core import health

    results = health.checks()
    overall = health.overall(results)
    return Section(
        "health",
        "System health",
        _url("core:health"),
        [
            Count(check.label, check.summary, _url("core:health"), "attention", key=check.key)
            for check in overall["problems"]
        ],
        note=overall["summary"],
        status=overall["status"],
    )


# --- The page -----------------------------------------------------------------------------------


def build(user, now: datetime | None = None) -> dict:
    """Everything the Overview renders for ``user``."""
    from apps.enquiries.selectors import can_access as can_access_enquiries

    from . import analytics, overview

    now = now or timezone.now()
    sections = []
    attention = []
    if can_access_enquiries(user):
        sections.append(enquiries_section(now))
        attention = overview.needs_attention(now)
    for section in (
        relay_section(user, now),
        careers_section(user),
        insights_section(user),
        sync_section(now),
    ):
        if section is not None:
            sections.append(section)
    return {
        "sections": sections,
        "attention": attention,
        "health": health_section(),
        "analytics": analytics.card(),
        "today": timezone.localtime(now),
    }
