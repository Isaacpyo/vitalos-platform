"""Roles and access rules. Every server-side authorisation decision goes through this module."""

from functools import wraps

from django.contrib.auth.views import redirect_to_login
from django.core.exceptions import PermissionDenied

SUPERADMIN = "SuperAdmin"
SERVICE_LEAD = "ServiceLead"
VIEWER = "Viewer"
ROLES = (SUPERADMIN, SERVICE_LEAD, VIEWER)
ROLE_DESCRIPTIONS = {
    SUPERADMIN: "Full control of the company architecture, users, settings and imports.",
    SERVICE_LEAD: "Reads everything visible; edits the service lines they own or belong to.",
    VIEWER: "Read-only access to Public and Internal records.",
}


def user_roles(user) -> frozenset[str]:
    """Role names held by ``user``; Django superusers are always SuperAdmin."""
    if user is None or not user.is_authenticated or not user.is_active:
        return frozenset()
    cached = getattr(user, "_vsa_roles", None)
    if cached is None:
        names = set(user.groups.filter(name__in=ROLES).values_list("name", flat=True))
        if user.is_superuser:
            names.add(SUPERADMIN)
        cached = frozenset(names)
        user._vsa_roles = cached
    return cached


def clear_role_cache(user) -> None:
    if hasattr(user, "_vsa_roles"):
        del user._vsa_roles


def primary_role(user) -> str | None:
    roles = user_roles(user)
    return next((role for role in ROLES if role in roles), None)


ROLE_LABELS = {SUPERADMIN: "Super admin", SERVICE_LEAD: "Service lead", VIEWER: "Viewer"}


def role_label(user) -> str:
    """Human label for the user menu, e.g. "Owner · Super admin" for the primary owner."""
    role = primary_role(user)
    label = ROLE_LABELS.get(role, "No role")
    return f"Owner · {label}" if getattr(user, "is_primary_owner", False) else label


def is_superadmin(user) -> bool:
    return SUPERADMIN in user_roles(user)


def has_role(user, *roles: str) -> bool:
    """True when the user holds any of ``roles``. SuperAdmin satisfies every role check."""
    held = user_roles(user)
    return bool(held) and (SUPERADMIN in held or bool(held.intersection(roles)))


def has_any_role(user) -> bool:
    return bool(user_roles(user))


def holds_staff_role(user) -> bool:
    """Whether the account holds a staff role, even while suspended (``user_roles`` is empty for inactive
    accounts, so it cannot answer this)."""
    return bool(user.is_superuser or user.groups.filter(name__in=ROLES).exists())


def accessible_service_line_ids(user) -> set[int] | None:
    """Service line IDs the user may change. ``None`` means every service line."""
    if is_superadmin(user):
        return None
    if SERVICE_LEAD not in user_roles(user):
        return set()
    cached = getattr(user, "_vsa_service_lines", None)
    if cached is None:
        from apps.architecture.models import ServiceLine

        cached = set(ServiceLine.objects.filter(owner=user).values_list("id", flat=True)) | set(
            ServiceLine.objects.filter(team_members__user=user).values_list("id", flat=True)
        )
        user._vsa_service_lines = cached
    return cached


def has_service_access(user, service_line) -> bool:
    """Whether ``user`` may change records belonging to ``service_line``.

    SuperAdmin: every service line. ServiceLead: lines they own or are a team member of.
    Viewer: none. A ``None`` service line means company-wide records, which only SuperAdmin edits.
    """
    if is_superadmin(user):
        return True
    if service_line is None:
        return False
    ids = accessible_service_line_ids(user)
    return ids is not None and service_line.pk in ids


def role_required(*roles: str):
    """View decorator: anonymous users go to login; authenticated users without a role get 403."""

    def decorator(view_func):
        @wraps(view_func)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path())
            allowed = has_role(request.user, *roles) if roles else has_any_role(request.user)
            if not allowed:
                raise PermissionDenied
            return view_func(request, *args, **kwargs)

        return wrapped

    return decorator
