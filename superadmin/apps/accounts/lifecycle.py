"""Staff account lifecycle: suspend, reactivate, reset two-step sign-in, send a set-password link, delete.

Rules (every one is checked here, never in a view or template):

* Only a SuperAdmin acts. Nobody suspends or deletes their own account, the primary owner, or the last
  active SuperAdmin. Deleting another SuperAdmin follows the role rule: once a primary owner exists, only
  they may remove a SuperAdmin.
* Suspending sets ``is_active=False``, revokes every usable API token and ends every session at once.
* Deleting removes the account and its personal data (profile, tokens, authenticators, preferences, inbox).
  The audit trail is append-only and keeps its own ``actor_email`` snapshot, so it stays readable; the
  deletion itself is recorded as "Deleted user #<id>". Deletion is refused, with what to do instead, while
  the account still owns live work (it must be reassigned first) or authored records that are part of a
  customer project (``PROTECT``ed rows, such as client portal messages). Suspending is always the safe
  alternative.

Erased client portal accounts (see ``erasure``) are tombstones, not staff: they never appear here.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import timedelta

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import models, transaction
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.audit.services import record

from .models import ApiToken
from .roles import ROLES, SUPERADMIN, clear_role_cache, is_superadmin

logger = logging.getLogger(__name__)

LINKS_PER_HOUR = 3


@dataclass(frozen=True)
class Blocker:
    """Why an account cannot be deleted yet, and what to do about it."""

    text: str
    action: str = ""


class DeletionBlocked(ValidationError):
    def __init__(self, blockers: list[Blocker]):
        self.blockers = blockers
        super().__init__([b.text for b in blockers])


# Live work that must have an owner: (model label, field, filter of rows that still need one, noun, plural,
# where to reassign). Rows outside the filter (closed, archived) simply lose the link, like any SET_NULL.
OWNERSHIP = (
    (
        "architecture.ServiceLine",
        "owner",
        {"is_archived": False},
        "service line",
        "service lines",
        "Choose a new owner in Service lines.",
    ),
    (
        "aidata.Opportunity",
        "owner",
        {"stage__in": ["new", "reviewing", "discovery", "qualified", "proposal", "won", "on_hold"]},
        "AI & Data opportunity",
        "AI & Data opportunities",
        "Change the owner on each opportunity.",
    ),
    (
        "enquiries.Enquiry",
        "assignee",
        {"status__in": ["new", "open", "pending"]},
        "open enquiry",
        "open enquiries",
        "Reassign them in Enquiries.",
    ),
    (
        "careers.Application",
        "assigned_admin",
        {"stage__in": ["new", "reviewing", "interview", "offer"]},
        "open job application",
        "open job applications",
        "Reassign them in Careers.",
    ),
    (
        "careers.Role",
        "hiring_manager",
        {"status__in": ["draft", "open", "paused"]},
        "careers role as hiring manager",
        "careers roles as hiring manager",
        "Choose a new hiring manager in Careers.",
    ),
    (
        "portal.InformationRequest",
        "owner",
        {"status": "open"},
        "open client portal question",
        "open client portal questions",
        "Close or reassign them on the challenge.",
    ),
)

# Records whose author must stay: the database refuses to delete the account (on_delete=PROTECT).
PROTECTED_NOUNS = {
    "portal.message": ("client portal message", "client portal messages"),
    "portal.approval": ("deliverable decision", "deliverable decisions"),
    "portal.briefreview": ("brief review", "brief reviews"),
    "portal.changerequest": ("change request", "change requests"),
    "portal.informationresponse": ("answer to a customer question", "answers to customer questions"),
}


def _plural(count: int, one: str, many: str) -> str:
    return f"{count} {one if count == 1 else many}"


def _sample(queryset, limit: int = 3) -> str:
    names = [str(obj) for obj in queryset[: limit + 1]]
    if not names:
        return ""
    shown = ", ".join(names[:limit])
    return f" ({shown}{', …' if len(names) > limit else ''})"


# --- Who holds SuperAdmin ------------------------------------------------------------------------------------


def _superadmin_q() -> models.Q:
    return models.Q(is_superuser=True) | models.Q(groups__name=SUPERADMIN)


def holds_superadmin(user) -> bool:
    """SuperAdmin by group or Django superuser flag, whether or not the account is active."""
    return user.is_superuser or user.groups.filter(name=SUPERADMIN).exists()


def is_last_active_superadmin(user) -> bool:
    if not user.is_active or not holds_superadmin(user):
        return False
    others = get_user_model().objects.filter(is_active=True).filter(_superadmin_q()).exclude(pk=user.pk)
    return not others.exists()


# --- Sessions --------------------------------------------------------------------------------------------------


def end_sessions(user) -> int:
    """Delete every unexpired database session that belongs to ``user``. Returns how many were ended.

    Inactive accounts are already refused by the authentication backend on their next request; this also
    removes the session rows so nothing lingers until expiry."""
    ended = 0
    for session in Session.objects.filter(expire_date__gt=timezone.now()).iterator():
        try:
            data = session.get_decoded()
        except Exception:  # noqa: BLE001, S112 - a corrupt session is skipped, never fatal  # nosec B112
            continue
        if str(data.get("_auth_user_id", "")) == str(user.pk):
            session.delete()
            ended += 1
    return ended


# --- Checks ----------------------------------------------------------------------------------------------------


def _require_superadmin(actor) -> None:
    if actor is None or not is_superadmin(actor):
        raise PermissionDenied


def check_can_suspend(target, actor) -> None:
    _require_superadmin(actor)
    if target.pk == actor.pk:
        raise ValidationError("You cannot suspend or deactivate your own account. Ask another SuperAdmin.")
    if target.is_primary_owner:
        raise ValidationError("The primary owner cannot be deactivated or suspended.")
    if is_last_active_superadmin(target):
        raise ValidationError(
            f"{target.email} is the last active SuperAdmin. Give someone else the role before suspending them."
        )


def deletion_blockers(target) -> list[Blocker]:
    """Everything that stops ``target`` being deleted now (empty when deletion is safe)."""
    blockers: list[Blocker] = []
    for label, field, live, one, many, action in OWNERSHIP:
        model = apps.get_model(label)
        rows = model._base_manager.filter(**{field: target}, **live)
        count = rows.count()
        if count:
            blockers.append(Blocker(f"Owns {_plural(count, one, many)}{_sample(rows)}.", action))
    User = get_user_model()
    for relation in User._meta.get_fields(include_hidden=True):
        if not (relation.auto_created and not relation.concrete and relation.is_relation):
            continue
        if getattr(relation, "on_delete", None) is not models.PROTECT:
            continue
        count = relation.related_model._base_manager.filter(**{relation.field.name: target}).count()
        if count:
            meta = relation.related_model._meta
            one, many = PROTECTED_NOUNS.get(
                meta.label_lower, (str(meta.verbose_name), str(meta.verbose_name_plural))
            )
            blockers.append(
                Blocker(
                    f"Wrote {_plural(count, one, many)}, which are part of a customer's project record.",
                    "These keep their author, so the account has to stay. Suspend it instead.",
                )
            )
    if apps.is_installed("django.contrib.admin"):
        from django.contrib.admin.models import LogEntry

        count = LogEntry.objects.filter(user=target).count()
        if count:
            blockers.append(
                Blocker(
                    f"Has {_plural(count, 'Django admin history entry', 'Django admin history entries')}, "
                    "which would be deleted with the account.",
                    "Suspend the account instead to keep that history.",
                )
            )
    return blockers


def check_can_delete(target, actor) -> None:
    """Raise ``ValidationError`` for a rule, or ``DeletionBlocked`` listing what still needs the account."""
    _require_superadmin(actor)
    if target.pk == actor.pk:
        raise ValidationError("You cannot delete your own account. Ask another SuperAdmin.")
    if target.is_primary_owner:
        raise ValidationError("The primary owner cannot be deleted.")
    if is_last_active_superadmin(target):
        raise ValidationError(f"{target.email} is the last active SuperAdmin and cannot be deleted.")
    if target.is_superuser:
        raise ValidationError(
            "This account is a Django superuser. Remove that flag in Django admin before deleting it."
        )
    if holds_superadmin(target):
        from .services import primary_owner

        owner = primary_owner()
        if owner is not None and actor.pk != owner.pk:
            raise ValidationError("Only the primary owner can delete another SuperAdmin.")
    blockers = deletion_blockers(target)
    if blockers:
        raise DeletionBlocked(blockers)


def refusal(target, actor, action: str) -> list[Blocker]:
    """Why ``action`` ("suspend" or "delete") is refused for ``target`` now; empty when it would go ahead."""
    check = check_can_delete if action == "delete" else check_can_suspend
    try:
        check(target, actor)
    except DeletionBlocked as exc:
        return exc.blockers
    except ValidationError as exc:
        return [Blocker(message) for message in exc.messages]
    return []


def can_suspend(target, actor) -> bool:
    try:
        check_can_suspend(target, actor)
    except (ValidationError, PermissionDenied):
        return False
    return True


# --- Actions ---------------------------------------------------------------------------------------------------


@transaction.atomic
def suspend_user(target, actor, request=None) -> bool:
    """Deactivate the account: sign-in, sessions and API tokens stop working immediately."""
    check_can_suspend(target, actor)
    if not target.is_active:
        return False
    target.is_active = False
    target.save(update_fields=["is_active"])
    clear_role_cache(target)
    tokens = ApiToken.objects.usable().filter(user=target).update(revoked_at=timezone.now())
    sessions = end_sessions(target)
    record(
        "users.deactivated",
        request=request,
        actor=actor,
        entity=target,
        summary=target.email,
        tokens_revoked=tokens,
        sessions_ended=sessions,
    )
    return True


@transaction.atomic
def reactivate_user(target, actor, request=None) -> bool:
    _require_superadmin(actor)
    if target.is_active:
        return False
    target.is_active = True
    target.save(update_fields=["is_active"])
    clear_role_cache(target)
    record("users.activated", request=request, actor=actor, entity=target, summary=target.email)
    return True


@transaction.atomic
def reset_two_step(target, actor, request=None) -> int:
    """Remove the account's authenticators and sessions, so the next sign-in enrols a new one."""
    _require_superadmin(actor)
    if target.pk == actor.pk:
        raise ValidationError(
            "Reset your own authenticator from Account & security, which asks for your password."
        )
    removed, _ = TOTPDevice.objects.filter(user=target).delete()
    if not removed:
        raise ValidationError(f"{target.email} has no authenticator to reset.")
    sessions = end_sessions(target)
    record(
        "users.mfa_reset",
        request=request,
        actor=actor,
        entity=target,
        summary=target.email,
        devices_removed=removed,
        sessions_ended=sessions,
    )
    return removed


def send_password_link(target, actor, request=None) -> None:
    """Email ``target`` a single-use, 30-minute link to set a password (through ``apps.mailer``)."""
    from apps.audit.models import AuditEvent
    from apps.mailer import system

    from .services import password_email, setup_link

    _require_superadmin(actor)
    if not target.is_active:
        raise ValidationError(f"{target.email} is suspended. Reactivate the account before sending a link.")
    since = timezone.now() - timedelta(hours=1)
    recent = AuditEvent.objects.filter(
        action="auth.setup_link_issued", entity_type="accounts.user", entity_id=str(target.pk)
    ).filter(created_at__gte=since)
    if recent.count() >= LINKS_PER_HOUR:
        raise ValidationError(
            f"{LINKS_PER_HOUR} links were issued for {target.email} in the last hour. Wait before sending another."
        )
    link = setup_link(target, settings.APP_BASE_URL, request=request, actor=actor)
    subject, doc = password_email(link, sent_by_admin=True)
    try:
        system.send(
            doc,
            kind="accounts.password-link",
            subject=subject,
            to=[target.email],
            from_email=settings.NOTIFY_FROM_HEADER,
        )
    except Exception as exc:  # noqa: BLE001 - the provider's failure becomes a message, never a 500
        logger.warning("Set-password link email failed", extra={"user_id": target.pk})
        raise ValidationError("The email could not be sent. Try again in a few minutes.") from exc


@transaction.atomic
def delete_user(target, actor, request=None) -> int:
    """Permanently delete a staff account and its personal data. Returns the deleted id."""
    check_can_delete(target, actor)
    pk = target.pk
    held = sorted(target.groups.filter(name__in=ROLES).values_list("name", flat=True))
    tokens = ApiToken.objects.filter(user=target).count()
    devices = TOTPDevice.objects.filter(user=target).count()
    sessions = end_sessions(target)
    record(
        "users.deleted",
        request=request,
        actor=actor,
        entity_type="accounts.user",
        entity_id=pk,
        summary=f"Deleted user #{pk}",
        roles=held,
        api_tokens=tokens,
        authenticators=devices,
        sessions_ended=sessions,
    )
    target.delete()
    return pk
