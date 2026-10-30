"""Reads for Settings > Users & roles. Staff and client portal customers are listed separately; erased
tombstones (``erasure``) appear in neither list."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.db.models import Prefetch, Q
from django_otp.plugins.otp_totp.models import TOTPDevice

from .erasure import erased_q
from .roles import ROLES, SUPERADMIN


def customer_ids():
    """Accounts that are only client portal members: a membership, no staff role, not a superuser."""
    User = get_user_model()
    return (
        User.objects.filter(portal_memberships__isnull=False, is_superuser=False)
        .exclude(groups__name__in=ROLES)
        .values("pk")
    )


def staff_accounts():
    User = get_user_model()
    return User.objects.exclude(erased_q()).exclude(pk__in=customer_ids())


def customer_count() -> int:
    return get_user_model().objects.filter(pk__in=customer_ids()).count()


def staff_rows(actor) -> list[dict]:
    """Each staff account with its role, two-step state and which row actions apply.

    The cheap rules (yourself, the primary owner, the last active SuperAdmin, Django superusers) disable a
    button with the reason as its tooltip. Work that still needs the account is checked when Delete is
    pressed (``lifecycle.check_can_delete``), because it costs a query per related table."""
    from .services import primary_owner

    users = list(
        staff_accounts().prefetch_related(Prefetch("groups", queryset=Group.objects.filter(name__in=ROLES)))
    )
    with_device = set(
        TOTPDevice.objects.filter(confirmed=True, user__in=users).values_list("user_id", flat=True)
    )
    User = get_user_model()
    active_superadmins = set(
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name=SUPERADMIN))
        .values_list("pk", flat=True)
    )
    owner = primary_owner()
    actor_is_owner = owner is None or owner.pk == actor.pk
    rows = []
    for user in users:
        role = _held_role(user)
        is_self = user.pk == actor.pk
        last_superadmin = user.is_active and active_superadmins == {user.pk}
        holds_superadmin = role == SUPERADMIN or user.is_superuser
        if is_self:
            suspend_block = delete_block = "This is your account"
        elif user.is_primary_owner:
            suspend_block = "The primary owner can't be suspended"
            delete_block = "The primary owner can't be deleted"
        elif last_superadmin:
            suspend_block = delete_block = "The last active SuperAdmin"
        else:
            suspend_block = ""
            if user.is_superuser:
                delete_block = "Django superuser: remove the flag in Django admin first"
            elif holds_superadmin and not actor_is_owner:
                delete_block = "Only the primary owner can delete a SuperAdmin"
            else:
                delete_block = ""
        rows.append(
            {
                "user": user,
                "role": role,
                "is_self": is_self,
                "has_device": user.pk in with_device,
                "can_send_link": user.is_active,
                "can_reset_two_step": user.pk in with_device and not is_self,
                "suspend_block": suspend_block,
                "delete_block": delete_block,
            }
        )
    return rows


def _held_role(user) -> str | None:
    """The account's role from the prefetched groups, also while suspended (``primary_role`` is empty then)."""
    names = {group.name for group in user.groups.all()}
    if user.is_superuser:
        names.add(SUPERADMIN)
    return next((role for role in ROLES if role in names), None)
