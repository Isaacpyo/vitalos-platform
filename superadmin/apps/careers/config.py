"""Careers settings (brief 4.2): defaults, validation and loading of the single ``CareersSettings`` row.

Seeded with the approved copy only (brief section 2). Benefits, hiring process, salary policy and the
equal-opportunities statement are empty, and their sections stay hidden until someone fills them in.
The associates line and speculative applications stay off until CAR-01 is confirmed.
"""

from django.conf import settings
from django.core.exceptions import ValidationError

from apps.content_sync import copy

from .models import CareersSettings

DEFAULTS = {
    "heading": copy.CAREERS_HEADING,
    "intro": copy.CAREERS_INTRO,
    "values": list(copy.CAREERS_VALUES),
    "statements": list(copy.CAREERS_STATEMENTS),
    "empty_state": copy.CAREERS_EMPTY_STATE,
    "associates_line": copy.ASSOCIATES_LINE,
    "associates_line_enabled": False,
    "benefits": "",
    "process": "",
    "salary_policy": "",
    "equal_opportunities": "",
    "speculative_applications_enabled": False,
    # Empty means every active super admin.
    "notification_recipients": [],
    "retention_months": 6,
    # The candidate privacy notice is on the approval list; empty until the owner approves it.
    "privacy_notice_url": "",
    "privacy_notice_version": "",
}
TEXT_LIMITS = {
    "heading": 200,
    "intro": 1000,
    "empty_state": 500,
    "associates_line": 500,
    "benefits": 20000,
    "process": 20000,
    "salary_policy": 20000,
    "equal_opportunities": 20000,
    "privacy_notice_url": 300,
    "privacy_notice_version": 40,
}
REQUIRED_TEXT = ("heading", "intro", "empty_state")
BOOLEANS = ("associates_line_enabled", "speculative_applications_enabled")


def _as_list(value, *, limit: int, item_limit: int, name: str, errors: dict) -> list[str]:
    if isinstance(value, str):
        value = [line for line in value.splitlines()]
    items = [str(item).strip() for item in (value or []) if str(item).strip()]
    if len(items) > limit:
        errors[name] = f"At most {limit} entries."
    elif any(len(item) > item_limit for item in items):
        errors[name] = f"Each entry must be {item_limit} characters or fewer."
    return items


def clean(data: dict) -> dict:
    merged = {**DEFAULTS, **{key: value for key, value in (data or {}).items() if key in DEFAULTS}}
    errors: dict[str, str] = {}
    cleaned = {}
    for key, limit in TEXT_LIMITS.items():
        text = str(merged[key] if merged[key] is not None else "").strip()
        if key in REQUIRED_TEXT and not text:
            errors[key] = "Enter a value."
        elif len(text) > limit:
            errors[key] = f"Must be {limit} characters or fewer."
        cleaned[key] = text
    url = cleaned["privacy_notice_url"]
    if url and not (url.startswith("/") or url.startswith("https://")):
        errors["privacy_notice_url"] = "Use a path on the website (/...) or an https:// address."
    cleaned["values"] = _as_list(merged["values"], limit=20, item_limit=80, name="values", errors=errors)
    cleaned["statements"] = _as_list(
        merged["statements"], limit=10, item_limit=500, name="statements", errors=errors
    )
    for key in BOOLEANS:
        cleaned[key] = merged[key] in (True, "true", "on", "1", 1)
    recipients = merged["notification_recipients"] or []
    cleaned["notification_recipients"] = [int(pk) for pk in recipients if str(pk).isdigit()]
    try:
        months = int(merged["retention_months"])
    except (TypeError, ValueError):
        months = 0
    if not 1 <= months <= 36:
        errors["retention_months"] = "Choose a number of months from 1 to 36."
    cleaned["retention_months"] = months
    if errors:
        raise ValidationError(errors)
    return cleaned


def load() -> dict:
    """The stored config merged over the defaults (invalid stored values fall back to the defaults)."""
    row = CareersSettings.objects.filter(pk=1).first()
    try:
        config = clean(row.config if row else {})
    except ValidationError:
        config = dict(DEFAULTS)
    # Mirrors the environment flag; never stored (brief 4.2).
    config["candidate_emails_enabled"] = bool(settings.CAREERS_CANDIDATE_EMAILS_ENABLED)
    return config
