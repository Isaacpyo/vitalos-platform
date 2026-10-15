"""Role publishing used by the read API, the tick and (in Phase 4) the Careers admin.

Each mutation runs in one transaction: change, revision (when publishing), audit row and sync event.
The roles and applications admin screens, intake and retention are Phase 4.
"""

import hashlib
import json

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.content_sync import formatting, sync
from apps.content_sync.models import SlugRedirect

from . import public
from .models import ApplyMode, Role, RoleRevision, RoleStatus

HASH_FIELDS = (
    "slug",
    "title",
    "practice",
    "level",
    "show_level",
    "location_text",
    "work_model",
    "employment_type",
    "salary_min",
    "salary_max",
    "salary_currency",
    "salary_period",
    "show_salary",
    "summary",
    "about_md",
    "responsibilities_md",
    "requirements_md",
    "nice_to_have_md",
    "process_md",
    "sponsorship",
    "closes_at",
    "apply_mode",
    "external_apply_url",
    "show_on_home",
)


def revision_hash(role: Role) -> str:
    data = {name: getattr(role, name) for name in HASH_FIELDS}
    data["closes_at"] = formatting.iso(role.closes_at)
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def open_problems(role: Role) -> list[str]:
    """What stops a role from opening (brief 7.4)."""
    problems = []
    if not role.title.strip():
        problems.append("Enter a title.")
    if not public.shapeable(role):
        problems.append("Choose a practice, a work model and an employment type.")
    if not role.location_text.strip():
        problems.append("Enter a location.")
    if not role.summary.strip():
        problems.append("Write a summary.")
    if not role.about_md.strip() or not role.requirements_md.strip():
        problems.append("Write the About the role and What you'll bring sections.")
    if role.show_salary and (
        role.salary_min is None or role.salary_max is None or role.salary_max < role.salary_min
    ):
        problems.append("Enter a salary range with a maximum at least the minimum, or hide the salary.")
    if role.apply_mode == ApplyMode.EXTERNAL and not role.external_apply_url.startswith("https://"):
        problems.append("Enter an https:// application URL.")
    return problems


def _publish(role: Role, actor, action: str, now) -> None:
    old_slug = role.published_slug
    detail = public.build_detail(role, date_posted=role.first_opened_at or now, last_modified=now)
    revision = RoleRevision.objects.create(
        role=role, snapshot=detail, revision_hash=revision_hash(role), published_by=actor, published_at=now
    )
    role.published_snapshot = detail
    role.published_slug = role.slug
    role.published_hash = revision.revision_hash
    role.published_closes_at = role.closes_at
    role.published_revision = revision
    role.has_unpublished_changes = False
    role.last_published_at = now
    role.save()
    if old_slug and old_slug != role.slug:
        SlugRedirect.objects.filter(entity="role", from_slug=role.slug).delete()
        SlugRedirect.objects.update_or_create(entity="role", from_slug=old_slug, defaults={"to_id": role.id})
        sync.emit("role", role.id, "role.slug_changed", role.title, slug=role.slug, old_slug=old_slug)
    sync.emit("role", role.id, action, role.title, slug=role.slug)


def open_role(role: Role, actor=None, *, request=None) -> Role:
    problems = open_problems(role)
    if problems:
        raise ValidationError(problems)
    if role.status not in (RoleStatus.DRAFT, RoleStatus.PAUSED, RoleStatus.CLOSED):
        raise ValidationError("Only a draft, paused or closed role can be opened.")
    now = timezone.now()
    with transaction.atomic():
        role = Role.objects.select_for_update().get(pk=role.pk)
        role.status = RoleStatus.OPEN
        role.first_opened_at = role.first_opened_at or now
        role.closed_at = None
        _publish(role, actor, "role.opened", now)
        record("careers.role_opened", request=request, actor=actor, entity=role, summary=role.title)
    return role


def close_role(role: Role, actor=None, *, request=None, at=None) -> bool:
    """Close an open role now (or at ``at``, its closing date). False when it was not open."""
    now = timezone.now()
    with transaction.atomic():
        updated = Role.objects.filter(pk=role.pk, status=RoleStatus.OPEN).update(
            status=RoleStatus.CLOSED, closed_at=at or now
        )
        if not updated:
            return False
        role = Role.objects.get(pk=role.pk)
        record("careers.role_closed", request=request, actor=actor, entity=role, summary=role.title)
        sync.emit("role", role.id, "role.closed", role.title, slug=role.published_slug or role.slug)
    return True


def close_due(now=None) -> int:
    """Close open roles whose published closing date has passed. Overlapping runs close each once:
    rows are claimed with ``skip_locked`` and the status change is conditional."""
    now = now or timezone.now()
    closed = 0
    due = Role.objects.filter(status=RoleStatus.OPEN, published_closes_at__lte=now).values_list(
        "pk", flat=True
    )
    for pk in list(due):
        with transaction.atomic():
            role = (
                Role.objects.select_for_update(skip_locked=True)
                .filter(pk=pk, status=RoleStatus.OPEN, published_closes_at__lte=now)
                .first()
            )
            if role is None:
                continue
            updated = Role.objects.filter(pk=pk, status=RoleStatus.OPEN).update(
                status=RoleStatus.CLOSED, closed_at=role.published_closes_at
            )
            if not updated:
                continue
            record("careers.role_closed", entity=role, summary=role.title, reason="closing date")
            sync.emit("role", role.id, "role.closed", role.title, slug=role.published_slug or role.slug)
            closed += 1
    return closed


def run_retention(now=None) -> int:
    """Placeholder: applications retention (brief section 9) is built with the Careers admin (Phase 4)."""
    return 0


def purge_orphan_uploads(now=None) -> int:
    """Placeholder: pending CV uploads older than 24 hours are purged in Phase 4."""
    return 0
