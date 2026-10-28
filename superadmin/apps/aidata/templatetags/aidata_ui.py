"""Display helpers for AI & Data pages: stage and band badges, and GBP amounts."""

from decimal import Decimal

from django import template

from apps.core.templatetags.ui import _BADGE, _STYLES

from .. import scoring

register = template.Library()

STAGE_TONES = {
    "new": "blue",
    "reviewing": "sky",
    "discovery": "violet",
    "qualified": "violet",
    "proposal": "amber",
    "won": "green",
    "lost": "slate",
    "on_hold": "amber",
}
BAND_TONES = {
    scoring.PROPOSAL: "green",
    scoring.DISCOVERY: "amber",
    scoring.DECLINE: "slate",
    scoring.NOT_SCORED: "slate",
    scoring.BLOCKED: "red",
}
BUDGET_TONES = {"ok": "green", "warn": "amber", "over": "red"}


@register.filter
def stage_badge(stage):
    return _BADGE + _STYLES[STAGE_TONES.get(str(stage), "slate")]


@register.filter
def band_badge(band):
    return _BADGE + _STYLES[BAND_TONES.get(str(band), "slate")]


@register.filter
def budget_badge(status):
    return _BADGE + _STYLES[BUDGET_TONES.get(str(status), "slate")]


@register.filter
def gbp(value):
    """£1,234.50, or £1,234 for whole pounds; an em dash for None."""
    if value is None or value == "":
        return "—"
    amount = Decimal(value)
    sign = "−" if amount < 0 else ""
    text = f"{abs(amount):,.2f}".removesuffix(".00")
    return f"{sign}£{text}"


@register.filter
def bar_width(percent):
    """A Tailwind width class for a 0–100 % meter, in steps of 5 (CSP blocks inline styles)."""
    try:
        value = max(0, min(100, int(percent)))
    except (TypeError, ValueError):
        value = 0
    return BAR_WIDTHS[round(value / 5)]


# Literal class names so Tailwind's scanner finds them.
BAR_WIDTHS = (
    "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]",
    "w-[50%]", "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]",
    "w-[95%]", "w-full",
)  # fmt: skip
