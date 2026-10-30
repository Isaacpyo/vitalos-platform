"""Client portal member management (staff): cancel an invitation, remove a member, and what then happens to the
person's account. ADR-056, "Member management".

* **Suspend access** is ``services.revoke_member`` (the membership stays, access ends at once) and **Restore
  access** is ``services.restore_member``.
* **Cancel invitation** (not yet accepted) and **Remove from organisation** delete the membership and its
  invitations and devices. The person's account is then settled:

  - it stays as it is while it has another membership or holds a staff role;
  - otherwise it is **deleted** when it left no trace in any project;
  - or **erased** when it did (messages, answers, reviews, approvals, change requests, uploads, activity):
    the record keeps every row, the author shows as "Former member", the account can never sign in again
    and its name and email are gone from the account and from the activity feed. Approval rows keep the
    name and email captured at the moment of the decision: that is contractual evidence (ADR-056 §10).

The audit trail is append-only and is never edited: it keeps its own actor email snapshot.
"""

from __future__ import annotations

from django.apps import apps
from django.core.exceptions import PermissionDenied
from django.db import transaction

from apps.accounts.erasure import FORMER_MEMBER, erase_account, is_erased
from apps.accounts.roles import holds_staff_role
from apps.audit.services import record

from . import services
from .access import staff_can_manage
from .models import EmailDelivery, Event, Membership, Notification, NotificationPreference

# Rows that tie a customer to a project. Any one of them means the account is erased, never deleted, so the
# record keeps its author ("Former member"). The first five are on_delete=PROTECT in the schema anyway.
FOOTPRINT = (
    ("portal.Message", "author"),
    ("portal.Approval", "user"),
    ("portal.BriefReview", "user"),
    ("portal.ChangeRequest", "raised_by"),
    ("portal.InformationResponse", "user"),
    ("portal.File", "created_by"),
    ("portal.FileVersion", "uploaded_by"),
    ("portal.ChangeReview", "actor"),
    ("portal.BriefVersion", "agreed_by"),
    ("portal.Event", "actor_user"),
)

KEPT, ERASED, DELETED = "kept", "erased", "deleted"


def _require_staff(actor) -> None:
    if actor is None or not staff_can_manage(actor):
        raise PermissionDenied


def footprint(user) -> dict[str, int]:
    """How many project rows ``user`` is the author of, by model (only non-zero counts)."""
    counts = {}
    for label, field in FOOTPRINT:
        model = apps.get_model(label)
        count = model._base_manager.filter(**{field: user}).count()
        if count:
            counts[model._meta.model_name] = count
    return counts


def account_outcome(user, *, leaving: Membership | None = None) -> str:
    """What removing ``leaving`` (or every membership, when None) would do to the account."""
    others = Membership.objects.filter(user=user)
    if leaving is not None:
        others = others.exclude(pk=leaving.pk)
        if others.exists():
            return KEPT
    if holds_staff_role(user):
        return KEPT
    return ERASED if footprint(user) else DELETED


def _scrub_activity(user) -> int:
    """Replace the person's name and email in the activity feed rows they caused."""
    names = [text for text in {(user.full_name or "").strip(), user.email} if text]
    changed = 0
    for event in Event.objects.filter(actor_user=user):
        summary = event.summary
        for text in names:
            summary = summary.replace(text, FORMER_MEMBER)
        if summary != event.summary:
            event.summary = summary
            event.save(update_fields=["summary"])
            changed += 1
    return changed


def _settle_account(user, *, actor, request=None) -> str:
    """After a membership is deleted: keep, erase or delete the account (see the module docstring)."""
    if Membership.objects.filter(user=user).exists() or holds_staff_role(user) or is_erased(user):
        return KEPT
    pk = user.pk
    counts = footprint(user)
    activity = _scrub_activity(user)
    Notification.objects.filter(user=user).delete()
    NotificationPreference.objects.filter(user=user).delete()
    deliveries, _ = EmailDelivery.objects.filter(recipient=user).delete()
    if counts:
        erase_account(user)
        record(
            "portal.account_erased",
            request=request,
            actor=actor,
            entity_type="accounts.user",
            entity_id=pk,
            summary=f"Erased portal user #{pk}; their project records now show Former member",
            kept=counts,
            activity_rewritten=activity,
            deliveries_deleted=deliveries,
        )
        return ERASED
    user.delete()
    record(
        "portal.account_deleted",
        request=request,
        actor=actor,
        entity_type="accounts.user",
        entity_id=pk,
        summary=f"Deleted portal user #{pk}",
        deliveries_deleted=deliveries,
    )
    return DELETED


@transaction.atomic
def cancel_invitation(member: Membership, *, actor, request=None) -> str:
    """Withdraw an invitation nobody accepted: the membership and its links go; the account is settled."""
    _require_staff(actor)
    if member.accepted_at:
        raise services.PortalError(
            "This person already accepted their invitation. Use Remove from organisation instead."
        )
    user, org, pk = member.user, member.organisation, member.pk
    member.delete()
    record(
        "portal.invitation_cancelled",
        request=request,
        actor=actor,
        entity_type="portal.membership",
        entity_id=pk,
        summary=f"Cancelled invitation #{pk} to {org.name}",
        organisation=org.pk,
        user=user.pk,
    )
    return _settle_account(user, actor=actor, request=request)


@transaction.atomic
def remove_member(member: Membership, *, actor, request=None) -> str:
    """Take the person out of the organisation for good (Suspend keeps them; this does not)."""
    _require_staff(actor)
    user, org, pk = member.user, member.organisation, member.pk
    member.delete()
    record(
        "portal.member_removed",
        request=request,
        actor=actor,
        entity_type="portal.membership",
        entity_id=pk,
        summary=f"Removed member #{pk} from {org.name}",
        organisation=org.pk,
        user=user.pk,
    )
    return _settle_account(user, actor=actor, request=request)


# --- Account level (Settings > Users & roles > Client portal users) -------------------------------------------


def _customer(user) -> None:
    if holds_staff_role(user):
        raise services.PortalError("That is a Vitalos staff account. Manage it under Staff.")


@transaction.atomic
def suspend_customer(user, *, actor, request=None) -> int:
    """Suspend every live membership (invited or active). Returns how many."""
    _require_staff(actor)
    _customer(user)
    live = list(Membership.objects.select_related("user", "organisation").filter(user=user, revoked_at=None))
    for member in live:
        services.revoke_member(member, actor=actor, request=request)
    return len(live)


@transaction.atomic
def restore_customer(user, *, actor, request=None) -> int:
    _require_staff(actor)
    _customer(user)
    revoked = list(
        Membership.objects.select_related("user", "organisation").filter(user=user, revoked_at__isnull=False)
    )
    for member in revoked:
        services.restore_member(member, actor=actor, request=request)
    return len(revoked)


@transaction.atomic
def remove_customer(user, *, actor, request=None) -> str:
    """Remove the person from every organisation, then settle the account."""
    _require_staff(actor)
    _customer(user)
    members = list(Membership.objects.select_related("user", "organisation").filter(user=user))
    if not members:
        return _settle_account(user, actor=actor, request=request)
    outcome = KEPT
    for member in members:
        outcome = remove_member(member, actor=actor, request=request)
    return outcome
