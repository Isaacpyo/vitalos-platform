"""Display helpers for AI & Data pages: stage and band badges, and GBP amounts."""

from decimal import Decimal

from django import template
from django.utils.html import format_html
from django.utils.safestring import mark_safe

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


# --- Monoline icons for the AI workspace --------------------------------------------------------------
# Mirrors packages/ui/src/primitives/Icon.tsx: 24px grid, 1.5px stroke, square caps, no fills. Paths
# marked "admin" are drawn on the same grid for admin-only needs; no icon library is added.
_AID_ICONS = {
    "arrow-right": "M4 12h15m-6-6 6 6-6 6",
    "arrow-left": "M20 12H5m6-6-6 6 6 6",
    "arrow-up-right": "M7 17 17 7m0 0H8m9 0v9",
    "chevron-down": "m6 9 6 6 6-6",
    "chevron-right": "m9 6 6 6-6 6",
    "plus": "M12 5v14M5 12h14",
    "minus": "M5 12h14",
    "check": "m5 12.5 4.5 4.5L19 7.5",
    "close": "m6 6 12 12M18 6 6 18",
    "external": "M14 4h6v6m0-6-9 9M18 14v5H5V6h5",
    "info": '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-9.5v.01"/>',
    "warning": '<path d="M12 4 3 20h18L12 4Z"/><path d="M12 10v5m0 2.5v.01"/>',
    "error": '<circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 3.5v.01"/>',
    "success": '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    "search": '<circle cx="11" cy="11" r="6"/><path d="m20 20-4.5-4.5"/>',
    "shield": "M12 3 5 6v5c0 4.5 3 8.3 7 10 4-1.7 7-5.5 7-10V6l-7-3Zm-3 9 2 2 4-4",
    "document": "M6 3h8l4 4v14H6V3Zm8 0v4h4M9 12h6m-6 4h6",
    "mail": "M3 5h18v14H3V5Zm0 0 9 7.5L21 5",
    "clock": '<circle cx="12" cy="12" r="8.25"/><path d="M12 7.5V12l3 2"/>',
    "lock": "M5 11h14v10H5V11Zm3 0V7.5a4 4 0 0 1 8 0V11m-4 4v2",
    "eye": '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="3"/>',
    "link": "M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66L11.5 6.8M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1.5-1.46",
    "users": '<circle cx="9" cy="8" r="3.25"/><path d="M3 20v-1.5A4.5 4.5 0 0 1 7.5 14h3a4.5 4.5 0 0 1 4.5 4.5V20M16 4.75a3.25 3.25 0 0 1 0 6.5M18 14a4.5 4.5 0 0 1 3 4.25V20"/>',
    "building": "M4 21V5l8-2v18m0-13h8v13M3 21h18M7.5 8h1m-1 4h1m-1 4h1m7-4h1m-1 4h1",
    "flask": "M9 3h6m-5 0v6l-5 9.5A1.5 1.5 0 0 0 6.3 21h11.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3M7.5 15h9",
    "chart": "M4 4v16h16M8 16v-4m4 4V8m4 8v-6",
    "workflow": '<rect x="3" y="4" width="7" height="6"/><rect x="14" y="14" width="7" height="6"/><path d="M6.5 10v4.5a2 2 0 0 0 2 2H14"/>',
    "layers": "m12 4 8 4-8 4-8-4 8-4Zm-8 8 8 4 8-4m-16 4 8 4 8-4",
    "chip": '<rect x="6" y="6" width="12" height="12"/><rect x="9.5" y="9.5" width="5" height="5"/><path d="M9 3v3m6-3v3M9 18v3m6-3v3M3 9h3m-3 6h3m12-6h3m-3 6h3"/>',
    "target": '<circle cx="12" cy="12" r="8.25"/><circle cx="12" cy="12" r="4.25"/><path d="M12 12h.01"/>',
    # admin: drawn on the same grid
    "pencil": "m4 20 1-4L16 5l3 3L8 19l-4 1Zm9-13 3 3",
    "refresh": "M20 12a8 8 0 1 1-2.5-5.8M20 4v4h-4",
    "paperclip": "m20 11-8.5 8.5a5 5 0 0 1-7-7L13 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L14 7",
    "spark": "m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 13v4m-2-2h4",
    "history": "M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4M12 8v4l3 2",
    "inbox": "M3 13h5l1 3h6l1-3h5M3 13l3-8h12l3 8v6H3v-6Z",
    "split": "M3 5h18v14H3V5Zm9 0v14",
    "flag": "M5 21V4m0 0h12l-2 4 2 4H5",
    "stop": '<rect x="6" y="6" width="12" height="12"/>',
    "question": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7m0 3v.01"/>',
    "list": "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
    "download": "M12 4v11m-5-5 5 5 5-5M5 20h14",
    "print": "M7 8V3h10v5M7 17H4v-7h16v7h-3M7 14h10v7H7v-7Z",
}


@register.simple_tag
def aid_icon(name, classes="h-4 w-4", title=""):
    shape = _AID_ICONS.get(name, _AID_ICONS["info"])
    inner = shape if shape.lstrip().startswith("<") else f'<path d="{shape}"/>'
    # Static, trusted SVG markup defined above; never built from user input.
    markup = mark_safe(inner)  # noqa: S308  # nosec B308 B703
    a11y = (
        format_html('role="img" aria-label="{}"', title)
        if title
        else mark_safe('aria-hidden="true" focusable="false"')
    )  # noqa: S308  # nosec B308 B703
    return format_html(
        '<svg class="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" '
        'stroke-linecap="square" stroke-linejoin="miter" {}>{}</svg>',
        classes,
        a11y,
        markup,
    )


AID_ICON_NAMES = tuple(_AID_ICONS)

CHIP_TONES = {
    "queued": ("info", "clock", "Queued"),
    "running": ("info", "refresh", "Running"),
    "draft": ("warn", "pencil", "Draft: needs review"),
    "reviewed": ("info", "eye", "Reviewed: needs approval"),
    "approved": ("ok", "success", "Approved"),
    "rejected": ("error", "close", "Rejected"),
    "superseded": ("neutral", "history", "Superseded"),
    "failed": ("error", "error", "Failed"),
    "cancelled": ("neutral", "stop", "Cancelled"),
}


@register.inclusion_tag("aidata/components/_state_chip.html")
def state_chip(state):
    tone, icon_name, label = CHIP_TONES.get(str(state), ("neutral", "info", str(state).title()))
    return {"tone": tone, "icon": icon_name, "label": label, "state": state}


@register.filter
def field_label(name):
    from ..extraction import FIELD_LABELS

    return FIELD_LABELS.get(name, str(name).replace("_", " ").capitalize())


@register.filter
def get_item(mapping, key):
    try:
        return (mapping or {}).get(key, "")
    except AttributeError:
        return ""


@register.filter
def offer_name(key):
    from ..models import Offer

    return dict(Offer.choices).get(key, "")


@register.filter
def get_attr(obj, name):
    return getattr(obj, str(name), "")


@register.filter
def lines(values):
    """A list of strings as one text, one item per line (for the textareas that edit lists)."""
    return "\n".join(str(v) for v in values or [])
