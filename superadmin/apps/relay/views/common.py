"""Shared view plumbing for the Relay tab: access guard, the shell context, CSP and HTMX replies."""

from __future__ import annotations

import json
from functools import wraps

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponse
from django.shortcuts import render
from django.urls import reverse

from apps.accounts.roles import SUPERADMIN, role_required

from .. import selectors, services
from ..client import RelayError, get_client, is_configured

SESSION_AVAILABLE = "relay_available"
SECTIONS = (
    ("inbox", "Inbox", "relay:inbox"),
    ("knowledge", "Knowledge", "relay:knowledge"),
    ("insights", "Insights", "relay:insights"),
    ("settings", "Settings", "relay:settings"),
)


def relay_view(*, manage: bool = False):
    """Anonymous users go to sign-in (with ``next``); no role or no Relay access gets 403; settings and
    knowledge management need SuperAdmin. When Relay is not configured, every page is a 404."""

    def decorator(view):
        guard = role_required(SUPERADMIN) if manage else role_required()

        @guard
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not is_configured():
                raise Http404
            if not selectors.can_access(request.user):
                raise PermissionDenied
            if manage and not selectors.can_manage(request.user):
                raise PermissionDenied
            return view(request, *args, **kwargs)

        return wrapped

    return decorator


def htmx_target(request) -> str:
    htmx = getattr(request, "htmx", None)
    if not htmx or htmx.history_restore_request:
        return ""
    return htmx.target or ""


def is_htmx(request) -> bool:
    return bool(getattr(request, "htmx", False))


def availability(request) -> bool:
    """The admin's Available switch: kept in the session, first read from GET /presence."""
    if SESSION_AVAILABLE not in request.session:
        available = False
        try:
            admins = (get_client(request.user).presence() or {}).get("admins") or []
            me = f"sa:{request.user.pk}"
            available = any(a.get("id") == me and a.get("available") for a in admins if isinstance(a, dict))
        except RelayError:
            pass
        request.session[SESSION_AVAILABLE] = available
    return bool(request.session[SESSION_AVAILABLE])


def realtime() -> dict | None:
    return services.realtime_config() if settings.RELAY_REALTIME_ENABLED else None


def shell_context(request, section: str) -> dict:
    socket = realtime()
    config = {
        "realtime": {"socket": socket["socket"], "topic": socket["topic"]} if socket else None,
        "availabilityUrl": reverse("relay:availability"),
        "pollSeconds": 10,
        "heartbeatSeconds": 60,
    }
    return {
        "relay_section": section,
        "relay_sections": [(key, label, reverse(name)) for key, label, name in SECTIONS],
        "relay_unread": selectors.unread_count(request.user),
        "relay_available": availability(request),
        "relay_can_manage": selectors.can_manage(request.user),
        "relay_config": config,
    }


def render_page(request, template: str, context: dict, section: str, status: int = 200) -> HttpResponse:
    """A full Relay page: the shell, plus ``connect-src`` widened to the realtime socket on this page only."""
    response = render(request, template, {**shell_context(request, section), **context}, status=status)
    socket = realtime()
    if socket:
        response._csp_update = {"connect-src": [socket["origin"]]}
    return response


def toast(response: HttpResponse, message: str, **events) -> HttpResponse:
    triggers = {"vsa-toast": {"message": message}} if message else {}
    triggers.update(events)
    if triggers:
        response["HX-Trigger"] = json.dumps(triggers)
    return response


def error_response(request, error: RelayError) -> HttpResponse:
    """HTMX: keep the page as it is and say what went wrong. Otherwise a small error page."""
    if is_htmx(request):
        response = HttpResponse(status=200)
        response["HX-Reswap"] = "none"
        return toast(response, error.user_message)
    status = 403 if error.code == "forbidden" else 404 if error.code == "not_found" else 502
    return render(request, "relay/error.html", {"message": error.user_message}, status=status)
