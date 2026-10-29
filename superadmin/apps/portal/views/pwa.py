"""Installable app routes (ADR-056, Phase 1): web app manifest, service worker, offline page.

All three are public and carry no personal data: they are rendered without a request context (no session, member,
organisation or context processor), so the same bytes go to everyone. They exist only in the portal URL
configuration; staff preview and the admin host do not serve them.
"""

from __future__ import annotations

import json

from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
from django.urls import reverse
from django.views.decorators.http import require_GET

from .. import pwa


@require_GET
def manifest(request):
    response = JsonResponse(
        pwa.manifest(), content_type="application/manifest+json", json_dumps_params={"indent": 2}
    )
    response["Cache-Control"] = "no-cache"
    return response


@require_GET
def service_worker(request):
    precache = pwa.precache_urls()
    offline_url = reverse("portal:offline")
    body = render_to_string(
        "portal/pwa/sw.js",
        {
            # JSON literals for the script (the values are our own static and route paths, never user input).
            "version": json.dumps(pwa.cache_version(precache, offline_url)),
            "static_prefix": json.dumps(pwa.static_prefix()),
            "offline_url": json.dumps(offline_url),
            "precache": json.dumps(precache, indent=2),
        },
    )
    response = HttpResponse(body, content_type="application/javascript; charset=utf-8")
    # Browsers check for a new worker on navigation; never let an intermediary hold an old one.
    response["Cache-Control"] = "no-cache"
    return response


@require_GET
def offline(request):
    body = render_to_string(
        "portal/pwa/offline.html",
        {
            "home_url": pwa.portal_root(),
            "theme_color": pwa.THEME_COLOR,
            "theme_color_dark": pwa.THEME_COLOR_DARK,
        },
    )
    response = HttpResponse(body)
    response["Cache-Control"] = "no-cache"
    return response
