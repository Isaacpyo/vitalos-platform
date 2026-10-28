"""Host routing and the customer boundary for the client portal (ADR-056).

``PortalRoutingMiddleware`` runs early. When ``PORTAL_HOST`` is set, a request for that host is served by
``config.portal_urls`` (the portal URLs and nothing else: no Super Admin pages, no APIs) and answers 404 until
``PORTAL_ENABLED`` is on. Without ``PORTAL_HOST`` the portal is mounted at ``/portal/`` for local preview, and
only while ``PORTAL_ENABLED`` is on. With ``PORTAL_HOST`` set, ``/portal/`` on any other host is a 404.

``CustomerBoundaryMiddleware`` runs after authentication. A signed-in user with NO staff role (a portal
customer) may reach portal URLs and static files only; every other path answers 403 (or sends them home from
``/`` and ``/login/``). It is deny-by-default and independent of what each admin view checks.
"""

from __future__ import annotations

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.urls import reverse

from apps.accounts.roles import user_roles

PORTAL_PREFIX = "/portal/"
PORTAL_URLCONF = "config.portal_urls"
OPEN_PREFIXES = ("/static/", "/healthz/")


def portal_host() -> str:
    return (getattr(settings, "PORTAL_HOST", "") or "").strip().lower()


def on_portal_host(request) -> bool:
    host = portal_host()
    if not host:
        return False
    return request.get_host().split(":")[0].lower() == host


def portal_home_url() -> str:
    """Absolute address of the portal's front door (used to send customers home from admin URLs)."""
    host = portal_host()
    if host:
        return f"https://{host}/"
    return settings.APP_BASE_URL.rstrip("/") + PORTAL_PREFIX


class PortalRoutingMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.portal_surface = False
        if on_portal_host(request):
            request.portal_surface = True
            if not settings.PORTAL_ENABLED:
                from django.http import HttpResponseNotFound

                return HttpResponseNotFound("Not found", content_type="text/plain")
            request.urlconf = PORTAL_URLCONF
        elif request.path.startswith(PORTAL_PREFIX) or request.path == PORTAL_PREFIX.rstrip("/"):
            if portal_host() or not settings.PORTAL_ENABLED:
                from django.http import HttpResponseNotFound

                return HttpResponseNotFound("Not found", content_type="text/plain")
            request.portal_surface = True
        return self.get_response(request)


class CustomerBoundaryMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    @staticmethod
    def _is_member(user) -> bool:
        from . import selectors

        return selectors.get_membership(user) is not None

    def __call__(self, request):
        user = getattr(request, "user", None)
        if user is not None and user.is_authenticated and not user_roles(user):
            path = request.path
            if request.portal_surface:
                return self.get_response(request)
            if path.startswith(OPEN_PREFIXES):
                return self.get_response(request)
            if (
                path in ("/", "/login/")
                and request.method in ("GET", "HEAD")
                and settings.PORTAL_ENABLED
                and self._is_member(user)
            ):
                return HttpResponseRedirect(portal_home_url())
            raise PermissionDenied
        return self.get_response(request)


def admin_login_url() -> str:
    return reverse("accounts:login")
