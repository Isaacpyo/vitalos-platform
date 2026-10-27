"""Overview page numbers: enquiry KPIs, the needs-attention list and system status.

Pure business logic, kept out of views and templates. All week maths is in Europe/London so a
"week" matches the team's working week regardless of the server time zone.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import median

from django.db.models import F
from django.utils import timezone

from apps.enquiries import sla
from apps.enquiries.models import Enquiry
from apps.enquiries.selectors import OPEN_STATUSES

WEEK = timedelta(days=7)
ATTENTION_LIMIT = 10
UNASSIGNED_WORKING_HOURS = 8  # one working day


@dataclass(frozen=True)
class Delta:
    """Change against the previous equivalent period.

    ``direction`` is up, down or flat (shown as text and an icon). ``tone`` is better or neutral;
    "worse" is deliberately drawn in neutral slate, never red.
    """

    text: str
    direction: str = "flat"
    tone: str = "neutral"


@dataclass(frozen=True)
class Kpi:
    key: str
    label: str
    value: str
    timeframe: str
    delta: Delta | None = None
    note: str = ""


def week_start(now: datetime | None = None) -> datetime:
    """Monday 00:00 Europe/London of the week containing ``now``."""
    local = (now or timezone.now()).astimezone(sla.LONDON)
    monday = (local - timedelta(days=local.weekday())).date()
    return datetime(monday.year, monday.month, monday.day, tzinfo=sla.LONDON)


def format_duration(delta: timedelta) -> str:
    """Format as "3 h 20 min", "45 min" or "1 d 4 h"."""
    minutes = max(int(delta.total_seconds() // 60), 0)
    days, rest = divmod(minutes, 1440)
    hours, mins = divmod(rest, 60)
    if days:
        return f"{days} d {hours} h" if hours else f"{days} d"
    if hours:
        return f"{hours} h {mins} min" if mins else f"{hours} h"
    return f"{mins} min"


def median_first_response(start: datetime, end: datetime) -> timedelta | None:
    """Median first-response time for enquiries created in [start, end) that have a response."""
    rows = Enquiry.objects.filter(
        created_at__gte=start, created_at__lt=end, first_response_at__isnull=False
    ).values_list("created_at", "first_response_at")
    durations = [max((responded - created).total_seconds(), 0) for created, responded in rows]
    if not durations:
        return None
    return timedelta(seconds=median(durations))


def open_count_at(moment: datetime) -> int:
    """Approximate open backlog at ``moment`` from creation and resolution times (spam excluded)."""
    return (
        Enquiry.objects.filter(created_at__lte=moment)
        .exclude(status__in=(Enquiry.Status.SPAM, Enquiry.Status.AUTOMATED))
        .exclude(resolved_at__lte=moment)
        .exclude(status=Enquiry.Status.RESOLVED, resolved_at__isnull=True)
        .count()
    )


def _count_delta(current: int, previous: int, *, lower_is_better: bool | None, noun: str) -> Delta:
    diff = current - previous
    if diff == 0:
        return Delta(f"No change vs {noun}", "flat", "neutral")
    direction = "up" if diff > 0 else "down"
    if lower_is_better is None:
        tone = "neutral"
    else:
        improved = diff < 0 if lower_is_better else diff > 0
        tone = "better" if improved else "neutral"
    return Delta(f"{'Up' if diff > 0 else 'Down'} {abs(diff)} vs {noun}", direction, tone)


def _duration_delta(current: timedelta | None, previous: timedelta | None) -> Delta | None:
    if current is None or previous is None:
        return None
    diff = current - previous
    if abs(diff) < timedelta(minutes=1):
        return Delta("No change vs previous 7 days", "flat", "neutral")
    faster = diff < timedelta(0)
    return Delta(
        f"{'Faster' if faster else 'Slower'} by {format_duration(abs(diff))} vs previous 7 days",
        "down" if faster else "up",
        "better" if faster else "neutral",
    )


def enquiry_kpis(now: datetime | None = None) -> list[Kpi]:
    now = now or timezone.now()
    this_week = week_start(now)
    elapsed = now - this_week
    last_week = this_week - WEEK

    open_now = Enquiry.objects.filter(status__in=OPEN_STATUSES).count()
    open_before = open_count_at(now - WEEK)
    unassigned = Enquiry.objects.filter(status__in=OPEN_STATUSES, assignee__isnull=True).count()

    current_median = median_first_response(now - WEEK, now)
    previous_median = median_first_response(now - 2 * WEEK, now - WEEK)

    new_now = Enquiry.objects.filter(created_at__gte=this_week, created_at__lte=now).count()
    new_before = Enquiry.objects.filter(
        created_at__gte=last_week, created_at__lte=last_week + elapsed
    ).count()

    return [
        Kpi(
            "open",
            "Open enquiries",
            str(open_now),
            "Now: new, open and pending",
            _count_delta(open_now, open_before, lower_is_better=True, noun="7 days ago"),
        ),
        Kpi(
            "first_response",
            "Median first response (7 days)",
            format_duration(current_median) if current_median is not None else "No responses yet",
            "Enquiries created in the last 7 days",
            _duration_delta(current_median, previous_median),
        ),
        Kpi(
            "new_week",
            "New this week",
            str(new_now),
            "Since Monday 00:00 (Europe/London)",
            _count_delta(new_now, new_before, lower_is_better=None, noun="the same point last week"),
        ),
        Kpi(
            "unassigned",
            "Unassigned",
            str(unassigned),
            "Now: open with no assignee",
            None,
            note="No comparison: assignment history is not kept.",
        ),
    ]


def needs_attention(now: datetime | None = None, limit: int = ATTENTION_LIMIT) -> list[dict]:
    """Open enquiries that are overdue, due soon, or unassigned for over a working day."""
    now = now or timezone.now()
    candidates = (
        Enquiry.objects.filter(status__in=OPEN_STATUSES)
        .select_related("assignee")
        .order_by(F("sla_due_at").asc(nulls_last=True), "created_at")
    )
    items = []
    for enquiry in candidates:
        state, label = sla.state(enquiry, now)
        stale = (
            enquiry.assignee_id is None and sla.due_at(enquiry.created_at, UNASSIGNED_WORKING_HOURS) <= now
        )
        if state in ("overdue", "due_soon") or stale:
            items.append(
                {
                    "enquiry": enquiry,
                    "state": state if state in ("overdue", "due_soon") else "unassigned",
                    "label": label
                    if state in ("overdue", "due_soon")
                    else "Unassigned for over a working day",
                    "unassigned": enquiry.assignee_id is None,
                }
            )
    rank = {"overdue": 0, "due_soon": 1, "unassigned": 2}
    items.sort(key=lambda item: rank[item["state"]])
    return items[:limit]
