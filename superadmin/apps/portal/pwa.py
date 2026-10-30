"""The installable client portal (ADR-056, Phase 1): manifest values, the service worker's precache list, and the
links the customer pages carry.

Privacy rule: the service worker caches public static files and the public offline page, nothing else. No page,
HTMX partial, download, export or POST response from the workspace is ever stored on the device, so a shared or
lost device holds nothing private and signing out needs no cache purge.

The PWA routes live only in the portal URL configuration (the portal host, or ``/portal/`` in local preview).
Staff "Preview as customer" mounts only the workspace routes, so it has no manifest and registers no worker.
"""

from __future__ import annotations

import hashlib
from urllib.parse import urlsplit

from django.conf import settings
from django.templatetags.static import static
from django.urls import reverse

NAME = "Vitalos Client Portal"
SHORT_NAME = "Vitalos"
DESCRIPTION = (
    "Follow your challenges and projects with Vitalos: updates, questions, files and approvals in one place."
)
# Portal tokens (static/portal/portal.css): the header is --aid-ink-950 in light and --aid-ink-900 in dark; the
# page background is --aid-bg (--aid-grey-50 in light). A test keeps these in step with the stylesheet.
THEME_COLOR = "#0a0c0f"
THEME_COLOR_DARK = "#111418"
BACKGROUND_COLOR = "#f4f6f8"

ICON_192 = "portal/icons/icon-192.png"
ICON_512 = "portal/icons/icon-512.png"
ICON_MASKABLE = "portal/icons/maskable-512.png"
APPLE_TOUCH_ICON = "portal/icons/apple-touch-icon-180.png"

# Public, versioned static files only. Never a workspace URL: the worker would otherwise store customer data.
PRECACHE = (
    "portal/portal.css",
    "portal/portal.js",
    "django_htmx/htmx-2.min.js",
    "fonts/inter.woff2",
    "fonts/manrope.woff2",
    "brand/vitalos-wordmark-reversed.png",
    "brand/favicon-32.png",
    "favicon.ico",
    ICON_192,
    ICON_512,
    ICON_MASKABLE,
    APPLE_TOUCH_ICON,
)

# Bump when the worker's caching rules change without any precached file changing.
SW_REVISION = "1"


def portal_root() -> str:
    """The portal's root path on the surface being served: ``/`` on the portal host, ``/portal/`` locally."""
    return reverse("portal:home")


def static_prefix() -> str:
    return urlsplit(settings.STATIC_URL).path or "/static/"


def precache_urls() -> list[str]:
    # static() is what {% static %} calls, so production gets the hashed manifest names.
    return [static(path) for path in PRECACHE]


def cache_version(urls: list[str], offline_url: str) -> str:
    digest = hashlib.sha256("\n".join([SW_REVISION, offline_url, *urls]).encode()).hexdigest()
    return digest[:12]


def links() -> dict:
    """Head tags and worker registration values for a customer page."""
    return {
        "manifest": reverse("portal:manifest"),
        "sw": reverse("portal:service_worker"),
        "scope": portal_root(),
        "apple_touch_icon": static(APPLE_TOUCH_ICON),
        "theme_color": THEME_COLOR,
        "theme_color_dark": THEME_COLOR_DARK,
        "title": SHORT_NAME,
    }


def manifest() -> dict:
    root = portal_root()

    def icon(path: str, size: int, purpose: str = "any") -> dict:
        return {"src": static(path), "sizes": f"{size}x{size}", "type": "image/png", "purpose": purpose}

    shortcut_icons = [icon(ICON_192, 192)]
    return {
        "id": root,
        "name": NAME,
        "short_name": SHORT_NAME,
        "description": DESCRIPTION,
        "lang": "en-GB",
        "dir": "ltr",
        "start_url": root,
        "scope": root,
        "display": "standalone",
        "orientation": "any",
        "background_color": BACKGROUND_COLOR,
        "theme_color": THEME_COLOR,
        "categories": ["business", "productivity"],
        "icons": [icon(ICON_192, 192), icon(ICON_512, 512), icon(ICON_MASKABLE, 512, "maskable")],
        "shortcuts": [
            {
                "name": "Questions",
                "short_name": "Questions",
                "description": "Questions Vitalos has asked you",
                "url": reverse("portal:questions"),
                "icons": shortcut_icons,
            },
            {
                "name": "Notifications",
                "short_name": "Notifications",
                "description": "What has changed in your portal",
                "url": reverse("portal:notifications"),
                "icons": shortcut_icons,
            },
        ],
    }
