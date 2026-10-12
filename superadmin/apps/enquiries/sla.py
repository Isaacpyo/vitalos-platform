"""First-response SLA in working hours: Monday to Friday, 09:00 to 17:00 Europe/London.

Bank holidays are not modelled; the target is a guide for the team, not a contractual measure.
"""

from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from django.utils import timezone

LONDON = ZoneInfo("Europe/London")
DAY_START = time(9, 0)
DAY_END = time(17, 0)
DUE_SOON = timedelta(hours=2)


def _next_working_start(moment: datetime) -> datetime:
    moment = moment.astimezone(LONDON)
    while True:
        if moment.weekday() < 5:
            start = moment.replace(hour=9, minute=0, second=0, microsecond=0)
            end = moment.replace(hour=17, minute=0, second=0, microsecond=0)
            if moment < start:
                return start
            if moment < end:
                return moment
        moment = (moment + timedelta(days=1)).replace(hour=9, minute=0, second=0, microsecond=0)


def due_at(start: datetime, working_hours: int) -> datetime:
    """``start`` plus ``working_hours`` of working time."""
    remaining = timedelta(hours=working_hours)
    moment = _next_working_start(start)
    while True:
        end_of_day = moment.replace(hour=17, minute=0, second=0, microsecond=0)
        available = end_of_day - moment
        if remaining <= available:
            return (moment + remaining).astimezone(timezone.get_current_timezone())
        remaining -= available
        moment = _next_working_start(end_of_day)


def state(enquiry, now: datetime | None = None) -> tuple[str, str]:
    """(state, label) for display. States: met, overdue, due_soon, ok, none."""
    if enquiry.first_response_at:
        return "met", "Responded"
    if enquiry.sla_due_at is None or not enquiry.is_open:
        return "none", ""
    now = now or timezone.now()
    left = enquiry.sla_due_at - now
    if left <= timedelta(0):
        return "overdue", f"Overdue by {_human(-left)}"
    if left <= DUE_SOON:
        return "due_soon", f"Due in {_human(left)}"
    return "ok", f"Due in {_human(left)}"


def _human(delta: timedelta) -> str:
    minutes = int(delta.total_seconds() // 60)
    if minutes < 60:
        return f"{max(minutes, 1)} min"
    hours = minutes // 60
    if hours < 48:
        return f"{hours} h"
    return f"{hours // 24} days"
