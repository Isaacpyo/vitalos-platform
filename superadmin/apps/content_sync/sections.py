"""Homepage section configuration (brief 5.6 and 6.5): defaults, validation and loading."""

from django.core.exceptions import ValidationError

from . import copy
from .models import SiteSection

HOME_INSIGHTS = SiteSection.Key.HOME_INSIGHTS
HOME_CAREERS = SiteSection.Key.HOME_CAREERS

DEFAULTS = {
    HOME_INSIGHTS: {
        "enabled": True,
        "heading": copy.INSIGHTS_HEADING,
        "intro": copy.INSIGHTS_INTRO,
        "count": 3,
        "mode": "latest",
    },
    HOME_CAREERS: {
        "enabled": True,
        "heading": copy.CAREERS_HEADING,
        "intro": copy.CAREERS_HOME_INTRO,
        "count": 3,
        "when_no_roles": "hide",
    },
}
LIMITS = {HOME_INSIGHTS: (2, 4), HOME_CAREERS: (1, 5)}
CHOICES = {
    HOME_INSIGHTS: ("mode", ("latest", "pinned")),
    HOME_CAREERS: ("when_no_roles", ("hide", "show_message")),
}


def _text(value, name: str, limit: int, errors: dict) -> str:
    text = str(value if value is not None else "").strip()
    if not text:
        errors[name] = "Enter a value."
    elif len(text) > limit:
        errors[name] = f"Must be {limit} characters or fewer."
    return text


def clean(key: str, data: dict) -> dict:
    """A complete, valid config for ``key`` from ``data``; raises ValidationError(dict) on bad input."""
    if key not in DEFAULTS:
        raise ValidationError({"key": "Unknown section."})
    merged = {
        **DEFAULTS[key],
        **{name: value for name, value in (data or {}).items() if name in DEFAULTS[key]},
    }
    errors: dict[str, str] = {}
    cleaned = {
        "enabled": merged["enabled"] in (True, "true", "on", "1", 1),
        "heading": _text(merged["heading"], "heading", 200, errors),
        "intro": _text(merged["intro"], "intro", 500, errors),
    }
    low, high = LIMITS[key]
    try:
        count = int(merged["count"])
    except (TypeError, ValueError):
        count = None
    if count is None or not low <= count <= high:
        errors["count"] = f"Choose a number from {low} to {high}."
    cleaned["count"] = count
    name, options = CHOICES[key]
    if merged[name] not in options:
        errors[name] = "Choose one of the options."
    cleaned[name] = merged[name]
    if errors:
        raise ValidationError(errors)
    return cleaned


def load(key: str) -> dict:
    """The stored config merged over the defaults; an invalid stored value falls back to the default."""
    row = SiteSection.objects.filter(key=key).first()
    try:
        return clean(key, row.config if row else {})
    except ValidationError:
        return dict(DEFAULTS[key])
