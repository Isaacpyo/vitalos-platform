"""Command palette (Cmd/Ctrl+K). Pages come from the navigation; apps register record providers.

A provider is ``fn(user, query) -> list[PaletteResult]``. Apps register theirs in ``AppConfig.ready``
so this module never imports app code (keeps core free of dependency cycles).
"""

from collections.abc import Callable
from dataclasses import dataclass

from django.urls import reverse

from apps.accounts.roles import is_superadmin

from .navigation import crumb_label, is_visible, leaf_items


@dataclass(frozen=True)
class PaletteResult:
    group: str
    label: str
    url: str
    hint: str = ""
    icon: str = "arrow-right"


Provider = Callable[[object, str], list[PaletteResult]]
_PROVIDERS: list[Provider] = []
MAX_PER_GROUP = 6


def register(provider: Provider) -> Provider:
    if provider not in _PROVIDERS:
        _PROVIDERS.append(provider)
    return provider


def _static_entries(user) -> list[PaletteResult]:
    entries = [
        PaletteResult("Pages", item.palette_label or item.label, item.url, crumb_label(item), item.icon)
        for item in leaf_items()
        if is_visible(item, user)
    ]
    settings_sections = [
        ("API tokens", "accounts:settings_tokens"),
        ("CSV import and export", "architecture:settings_data"),
    ]
    if is_superadmin(user):
        settings_sections = [
            ("Company profile", "architecture:settings_company"),
            ("Users and roles", "accounts:settings_users"),
            ("Email and inbox", "enquiries_settings:email"),
            *settings_sections,
        ]
    entries += [
        PaletteResult("Settings", label, reverse(name), "Settings", "settings")
        for label, name in settings_sections
    ]
    entries += [
        PaletteResult(
            "Settings", "Account and security", reverse("accounts:account"), "Your account", "shield"
        ),
        PaletteResult("Settings", "Notifications", reverse("notifications:list"), "Your account", "bell"),
        PaletteResult("Settings", "Help and keyboard shortcuts", reverse("core:help"), "Help", "life-buoy"),
    ]
    if any(item.key == "enquiries" and is_visible(item, user) for item in leaf_items()):
        entries.append(
            PaletteResult(
                "Settings",
                "Enquiry notification preferences",
                reverse("enquiries_settings:notifications"),
                "Your account",
                "bell",
            )
        )
    return entries


def results(user, query: str) -> list[dict]:
    """Grouped results for ``query``; an empty query lists the pages."""
    query = (query or "").strip()[:100]
    needle = query.lower()
    found = [entry for entry in _static_entries(user) if not needle or needle in entry.label.lower()]
    if query:
        for provider in _PROVIDERS:
            found += provider(user, query)
    groups: dict[str, list[PaletteResult]] = {}
    for entry in found:
        bucket = groups.setdefault(entry.group, [])
        # An empty query lists every page (the sidebar grew past six with Insights and Careers).
        if len(bucket) < MAX_PER_GROUP or (not query and entry.group == "Pages"):
            bucket.append(entry)
    return [{"label": label, "results": items} for label, items in groups.items()]
