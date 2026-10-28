"""Who is looking at the portal, and may they do this? Every customer view goes through ``portal_view``.

* A customer is a ``User`` with no staff role plus an active, accepted ``Membership``. Access follows the
  membership on every request, so revoking it (or deactivating the organisation or the user) takes effect
  immediately.
* Staff reach the customer UI only through "Preview as customer": the same views, bound to one member's
  membership, read-only, bannered and audited.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import wraps
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.utils import timezone

from apps.accounts.otp import confirmed_devices
from apps.accounts.roles import has_any_role, has_role
from apps.audit.services import record

from . import selectors
from .middleware import PORTAL_URLCONF, portal_host
from .models import Membership

IDLE_GAP_MINUTES = 30


@dataclass
class PortalContext:
    member: Membership
    preview: bool = False
    staff: object | None = None

    @property
    def user(self):
        return self.member.user

    @property
    def organisation(self):
        return self.member.organisation


def staff_can_manage(user) -> bool:
    """Staff who may run the portal admin tools: SuperAdmin and ServiceLead (the AI & Data pipeline roles)."""
    from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN

    return has_role(user, SUPERADMIN, SERVICE_LEAD)


def portal_base_url() -> str:
    host = portal_host()
    if host:
        return f"https://{host}"
    return settings.APP_BASE_URL.rstrip("/") + "/portal"


def portal_absolute(name: str, kwargs: dict | None = None) -> str:
    """Absolute customer address for a portal route (used in emails and notifications)."""
    path = reverse(f"portal:{name}", kwargs=kwargs or {}, urlconf=PORTAL_URLCONF)
    return portal_base_url() + path


def portal_path(request, name: str, kwargs: dict | None = None) -> str:
    """Relative address of a portal route for the surface the request is on (customer or preview)."""
    ns = getattr(request, "portal_ns", "portal")
    merged = {**getattr(request, "portal_kwargs", {}), **(kwargs or {})}
    return reverse(f"{ns}:{name}", kwargs=merged)


def touch_visit(member: Membership) -> None:
    """Start a new "visit" after 30 idle minutes; the previous visit's start is what "since last visit" uses."""
    now = timezone.now()
    last = member.last_seen_at
    changed = ["last_seen_at"]
    if last is None or (now - last).total_seconds() > IDLE_GAP_MINUTES * 60:
        member.previous_visit_at = last
        changed.append("previous_visit_at")
    member.last_seen_at = now
    member.save(update_fields=changed)


def _login_redirect(request):
    ns = getattr(request, "portal_ns", "portal")
    target = reverse("portal:login") if ns == "portal" else reverse("accounts:login")
    return redirect_to_login(request.get_full_path(), login_url=target)


def portal_view(*, min_role: str | None = None, write: bool = False):
    """Resolve the member for this request. ``min_role`` is an attribute name on Membership (can_comment,
    can_approve, can_accept_contract); ``write`` marks state-changing views (blocked in preview)."""

    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            preview_member = kwargs.pop("preview_member", None)
            if preview_member is not None:
                request.portal_ns = "portal_preview"
                request.portal_kwargs = {"preview_member": preview_member}
                user = request.user
                if not user.is_authenticated:
                    return redirect_to_login(request.get_full_path(), login_url=reverse("accounts:login"))
                if not has_any_role(user) or not staff_can_manage(user):
                    raise PermissionDenied
                member = (
                    Membership.objects.select_related("user", "organisation")
                    .filter(pk=preview_member)
                    .first()
                )
                if member is None:
                    raise Http404
                if write or request.method not in ("GET", "HEAD"):
                    raise PermissionDenied("Preview as customer is read-only.")
                request.portal = PortalContext(member=member, preview=True, staff=user)
                if request.method == "GET" and not request.headers.get("HX-Request"):
                    record(
                        "portal.preview",
                        request=request,
                        entity=member,
                        summary=f"Previewed {member.organisation.name} as {member.user.email}: {request.path}"[
                            :290
                        ],
                    )
                return view(request, request.portal, *args, **kwargs)

            request.portal_ns = "portal"
            request.portal_kwargs = {}
            user = request.user
            if not user.is_authenticated:
                return _login_redirect(request)
            if has_any_role(user):
                # Staff never use the customer UI directly; they preview.
                return render(request, "portal/errors/staff.html", status=403)
            member = selectors.get_membership(user)
            if member is None:
                return render(request, "portal/errors/no_access.html", status=403)
            if confirmed_devices(user).exists() and not user.is_verified():
                return HttpResponseRedirect(
                    f"{reverse('portal:otp_verify')}?{urlencode({'next': request.get_full_path()})}"
                )
            if min_role and not getattr(member, min_role):
                raise PermissionDenied
            request.portal = PortalContext(member=member)
            if request.method == "GET" and not request.headers.get("HX-Request"):
                touch_visit(member)
            return view(request, request.portal, *args, **kwargs)

        return wrapped

    return decorator


def staff_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path(), login_url=reverse("accounts:login"))
        if not staff_can_manage(request.user):
            raise PermissionDenied
        return view(request, *args, **kwargs)

    return wrapped
