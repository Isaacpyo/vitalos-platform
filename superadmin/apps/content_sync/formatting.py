"""Display values the admin computes for the website (A2: the two apps must never disagree).

Dates are shown in Europe/London ("12 October 2026", "12 Oct 2026"); ISO values are UTC with a Z.
Salaries use an en dash ("£55,000–£65,000 a year"). Reading time is words ÷ 220 rounded up, minimum 1.
"""

import math
import re
import unicodedata
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

LONDON = ZoneInfo("Europe/London")
MONTHS = (
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
)
SLUG_MAX = 80
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
WORD_RE = re.compile(r"[0-9A-Za-zÀ-ɏ]+(?:['’-][0-9A-Za-zÀ-ɏ]+)*")
CURRENCY_SYMBOLS = {"GBP": "£", "EUR": "€", "USD": "$"}
SALARY_PERIODS = {"year": "a year", "day": "a day"}


def iso(value: datetime | None) -> str | None:
    """UTC ISO 8601 with a Z, to the second: 2026-10-12T09:00:00Z."""
    if value is None:
        return None
    return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def london(value: datetime) -> datetime:
    return value.astimezone(LONDON)


def date_long(value: datetime) -> str:
    local = london(value)
    return f"{local.day} {MONTHS[local.month - 1]} {local.year}"


def date_short(value: datetime) -> str:
    local = london(value)
    return f"{local.day} {MONTHS[local.month - 1][:3]} {local.year}"


def date_value(value: datetime | None) -> dict | None:
    """The contract's DateValue: {iso, long, short}."""
    if value is None:
        return None
    return {"iso": iso(value), "long": date_long(value), "short": date_short(value)}


def clock(value: datetime | None) -> str:
    """ "14:21" in Europe/London, for sync and autosave annotations."""
    return london(value).strftime("%H:%M") if value else ""


def reading_minutes(markdown: str) -> int:
    words = len(WORD_RE.findall(markdown or ""))
    return max(1, math.ceil(words / 220))


def money(amount: int, currency: str) -> str:
    symbol = CURRENCY_SYMBOLS.get(currency)
    figure = f"{amount:,}"
    return f"{symbol}{figure}" if symbol else f"{currency} {figure}"


def salary_label(minimum: int, maximum: int, currency: str, period: str) -> str:
    """'£55,000–£65,000 a year' (en dash), or '£600 a day' when the bounds are equal."""
    span = (
        money(minimum, currency)
        if minimum == maximum
        else f"{money(minimum, currency)}–{money(maximum, currency)}"
    )
    return f"{span} {SALARY_PERIODS.get(period, period)}"


def slugify(text: str) -> str:
    """Lowercase ASCII words joined by hyphens, at most 80 characters ('Health & Care' -> health-and-care)."""
    text = (text or "").replace("&", " and ").replace("_", " ")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    if len(slug) > SLUG_MAX:
        slug = slug[:SLUG_MAX].rstrip("-")
    return slug


def is_slug(value: str) -> bool:
    return bool(value) and len(value) <= SLUG_MAX and bool(SLUG_RE.match(value))


def initials(name: str) -> str:
    parts = [part for part in re.split(r"[\s.-]+", name or "") if part[:1].isalpha()]
    return "".join(part[0] for part in parts[:2]).upper()[:3] or "?"


def first_name(name: str) -> str:
    return (name or "").strip().split(" ")[0][:60]
