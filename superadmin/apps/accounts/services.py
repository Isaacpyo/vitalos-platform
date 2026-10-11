"""User and role administration rules."""

from django.contrib.auth import get_user_model, password_validation
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.urls import reverse

from apps.notifications.models import Notification
from apps.notifications.services import notify

from .roles import ROLES, SUPERADMIN, clear_role_cache, is_superadmin


def ensure_roles() -> None:
    for name in ROLES:
        Group.objects.get_or_create(name=name)


@transaction.atomic
def set_role(user, role: str | None, actor) -> bool:
    """Give ``user`` exactly one role (or none). Notifies the user when the role changes."""
    if actor is not None and not is_superadmin(actor):
        raise PermissionDenied
    if role is not None and role not in ROLES:
        raise ValidationError(f"Unknown role {role!r}.")
    if actor is not None and actor.pk == user.pk and role != SUPERADMIN and is_superadmin(actor):
        raise ValidationError("You cannot remove your own SuperAdmin role.")
    if user.is_superuser and role != SUPERADMIN:
        # A Django superuser is always SuperAdmin; showing another role would be misleading.
        raise ValidationError("This account is a Django superuser. Remove that flag in Django admin first.")
    ensure_roles()
    previous = set(user.groups.filter(name__in=ROLES).values_list("name", flat=True))
    target = {role} if role else set()
    if previous == target:
        return False
    user.groups.remove(*Group.objects.filter(name__in=previous - target))
    if role:
        user.groups.add(Group.objects.get(name=role))
    clear_role_cache(user)
    if role:
        notify(
            [user],
            Notification.Kind.ROLE_ASSIGNED,
            title=f"You now have the {role} role",
            body=f"Assigned by {actor}." if actor else "Assigned during setup.",
            url=reverse("architecture:home"),
        )
    return True


@transaction.atomic
def create_user(*, email: str, full_name: str, role: str, password: str, actor):
    if not is_superadmin(actor):
        raise PermissionDenied
    User = get_user_model()
    email = User.objects.normalize_email(email).lower()
    if User.objects.filter(email__iexact=email).exists():
        raise ValidationError({"email": "A user with this email already exists."})
    candidate = User(email=email, full_name=full_name)
    password_validation.validate_password(password, candidate)
    user = User.objects.create_user(email=email, password=password, full_name=full_name)
    set_role(user, role, actor)
    return user


@transaction.atomic
def set_active(user, active: bool, actor) -> None:
    if not is_superadmin(actor):
        raise PermissionDenied
    if user.pk == actor.pk and not active:
        raise ValidationError("You cannot deactivate yourself.")
    if user.is_active != active:
        user.is_active = active
        user.save(update_fields=["is_active"])
