"""Careers write rules: the role working copy and its lifecycle (brief 7.4).

Same model as posts: the editor changes the working copy; Open and Publish changes build the published
snapshot and an immutable revision. Each mutation runs in one transaction with its audit row and sync
event. Authorisation is checked by the views (``access.py``).

Lifecycle: draft -> open -> paused or closed -> open again (Reopen); anything -> archived.
"""

import hashlib
import json

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.content_sync import formatting, render, sync
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
WORKING_FIELDS = (
    *HASH_FIELDS,
    "sort",
    "hiring_manager",
)
MARKDOWN_SECTIONS = (
    ("about_md", "About the role"),
    ("responsibilities_md", "What you'll do"),
    ("requirements_md", "What you'll bring"),
    ("nice_to_have_md", "Nice to have"),
    ("process_md", "How we hire"),
)
PUBLIC_STATES = (RoleStatus.OPEN, RoleStatus.CLOSED)
CURRENCIES = ("GBP", "EUR", "USD")


class Conflict(Exception):
    def __init__(self, role: Role):
        super().__init__("This role changed since you opened it.")
        self.role = role


def revision_hash(role: Role) -> str:
    data = {name: getattr(role, name) for name in HASH_FIELDS}
    data["closes_at"] = formatting.iso(role.closes_at)
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _unchanged(role: Role) -> bool:
    return bool(role.published_hash) and revision_hash(role) == role.published_hash


def is_live(role: Role, now=None) -> bool:
    """Public on the website: open, or showing its closed notice. (Snapshot fields may be deferred.)"""
    return role.status in PUBLIC_STATES and bool(role.published_hash)


# --- Validation ----------------------------------------------------------------------------------


def slug_problem(role: Role, slug: str) -> str:
    if not formatting.is_slug(slug):
        return "Use lowercase letters, numbers and hyphens (at most 80 characters)."
    if Role.objects.filter(slug=slug).exclude(pk=role.pk).exists():
        return "Another role already uses this slug."
    if Role.objects.filter(published_slug=slug, status__in=PUBLIC_STATES).exclude(pk=role.pk).exists():
        return "Another role is published under this slug."
    return ""


def unique_slug(base: str, *, exclude_pk=None) -> str:
    base = formatting.slugify(base) or "role"
    candidate, counter = base, 2
    while (
        Role.objects.filter(slug=candidate).exclude(pk=exclude_pk).exists()
        or Role.objects.filter(published_slug=candidate, status__in=PUBLIC_STATES)
        .exclude(pk=exclude_pk)
        .exists()
    ):
        suffix = f"-{counter}"
        candidate = base[: formatting.SLUG_MAX - len(suffix)].rstrip("-") + suffix
        counter += 1
    return candidate


def validate_working(role: Role, data: dict) -> dict[str, str]:
    errors = {}
    if not (data.get("title") or "").strip():
        errors["title"] = "Enter a title."
    if problem := slug_problem(role, data.get("slug") or ""):
        errors["slug"] = problem
    if len(data.get("summary") or "") > 220:
        errors["summary"] = "The summary must be 220 characters or fewer."
    url = data.get("external_apply_url") or ""
    if url and not url.startswith("https://"):
        errors["external_apply_url"] = "Use an https:// address."
    if data.get("salary_currency") and data["salary_currency"] not in CURRENCIES:
        errors["salary_currency"] = "Choose a currency."
    low, high = data.get("salary_min"), data.get("salary_max")
    if low is not None and high is not None and high < low:
        errors["salary_max"] = "The maximum must be at least the minimum."
    return errors


def render_problems(role: Role) -> list[str]:
    """Blocking warnings from the website renderer for each description section (A7)."""
    problems = []
    for field, label in MARKDOWN_SECTIONS:
        text = getattr(role, field)
        if not text.strip():
            continue
        result = render.render(text, "role")
        if not result.available:
            return [
                "The description could not be checked because the preview renderer is unavailable. Try again shortly."
            ]
        problems += [f"{label}: {warning['message']}" for warning in result.blocking_warnings]
    return problems


def open_problems(role: Role, *, check_render: bool = False) -> list[str]:
    """What stops a role from opening or publishing changes (brief 7.4)."""
    problems = []
    if not role.title.strip():
        problems.append("Enter a title.")
    if problem := slug_problem(role, role.slug):
        problems.append(f"Slug: {problem}")
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
    if role.closes_at is not None and role.closes_at <= timezone.now():
        problems.append("Choose a closing date in the future, or clear it.")
    if check_render:
        problems += render_problems(role)
    return problems


# --- Working copy --------------------------------------------------------------------------------


def create_role(*, title: str, actor, request=None) -> Role:
    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "Enter a title."})
    with transaction.atomic():
        role = Role.objects.create(
            title=title[:200], slug=unique_slug(title), created_by=actor, updated_by=actor
        )
        record("careers.role_created", request=request, actor=actor, entity=role, summary=role.title)
    return role


def save_working_copy(role: Role, data: dict, *, actor=None, expected_updated_at=None, request=None) -> Role:
    errors = validate_working(role, data)
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        current = Role.objects.select_for_update().get(pk=role.pk)
        if expected_updated_at is not None and current.updated_at != expected_updated_at:
            raise Conflict(current)
        for name in WORKING_FIELDS:
            if name in data:
                setattr(current, name, data[name])
        current.title = current.title.strip()[:200]
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.has_unpublished_changes = bool(current.published_hash) and not _unchanged(current)
        current.save()
        record("careers.role_edited", request=request, actor=actor, entity=current, summary=current.title)
    return current


# --- Publishing ----------------------------------------------------------------------------------


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
    SlugRedirect.objects.filter(entity="role", from_slug=role.slug).delete()
    if old_slug and old_slug != role.slug:
        SlugRedirect.objects.update_or_create(entity="role", from_slug=old_slug, defaults={"to_id": role.id})
        sync.emit("role", role.id, "role.slug_changed", role.title, slug=role.slug, old_slug=old_slug)
    sync.emit("role", role.id, action, role.title, slug=role.slug)


def _require_openable(role: Role, *, check_render: bool) -> None:
    problems = open_problems(role, check_render=check_render)
    if problems:
        raise ValidationError(problems)


def open_role(role: Role, actor=None, *, request=None, check_render: bool = True) -> Role:
    """Open a draft, or reopen a paused or closed role, with a fresh snapshot."""
    role = Role.objects.get(pk=role.pk)
    _require_openable(role, check_render=check_render)  # renders outside the row lock
    now = timezone.now()
    with transaction.atomic():
        role = Role.objects.select_for_update().get(pk=role.pk)
        if role.status not in (RoleStatus.DRAFT, RoleStatus.PAUSED, RoleStatus.CLOSED):
            raise ValidationError("Only a draft, paused or closed role can be opened.")
        _require_openable(role, check_render=False)
        reopened = role.status != RoleStatus.DRAFT
        role.status = RoleStatus.OPEN
        role.first_opened_at = role.first_opened_at or now
        role.closed_at = None
        _publish(role, actor, "role.opened", now)
        record(
            "careers.role_reopened" if reopened else "careers.role_opened",
            request=request,
            actor=actor,
            entity=role,
            summary=role.title,
        )
    return role


def publish_changes(role: Role, actor=None, *, request=None) -> Role:
    role = Role.objects.get(pk=role.pk)
    _require_openable(role, check_render=True)
    now = timezone.now()
    with transaction.atomic():
        role = Role.objects.select_for_update().get(pk=role.pk)
        if role.status != RoleStatus.OPEN:
            raise ValidationError("Only an open role has changes to publish.")
        _require_openable(role, check_render=False)
        _publish(role, actor, "role.changes_published", now)
        record(
            "careers.role_changes_published", request=request, actor=actor, entity=role, summary=role.title
        )
    return role


def _status_change(role: Role, actor, *, allowed, target, action, audit, request=None, **fields) -> Role:
    with transaction.atomic():
        current = Role.objects.select_for_update().get(pk=role.pk)
        if current.status not in allowed:
            raise ValidationError(
                f"This role cannot be {target.label.lower()} from {current.get_status_display().lower()}."
            )
        was_public = current.published_snapshot is not None and current.status in PUBLIC_STATES
        current.status = target
        for name, value in fields.items():
            setattr(current, name, value)
        current.save()
        record(audit, request=request, actor=actor, entity=current, summary=current.title)
        if was_public and action:
            sync.emit("role", current.pk, action, current.title, slug=current.published_slug or current.slug)
    return current


def pause_role(role: Role, actor=None, *, request=None) -> Role:
    """Hide an open role and stop applications."""
    return _status_change(
        role,
        actor,
        allowed=(RoleStatus.OPEN,),
        target=RoleStatus.PAUSED,
        action="role.paused",
        audit="careers.role_paused",
        request=request,
    )


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


def archive_role(role: Role, actor=None, *, request=None) -> Role:
    return _status_change(
        role,
        actor,
        allowed=(RoleStatus.DRAFT, RoleStatus.OPEN, RoleStatus.PAUSED, RoleStatus.CLOSED),
        target=RoleStatus.ARCHIVED,
        action="role.archived",
        audit="careers.role_archived",
        request=request,
        closed_at=role.closed_at or timezone.now(),
    )


def duplicate_role(role: Role, actor=None, *, request=None) -> Role:
    title = f"{role.title} (copy)"[:200]
    with transaction.atomic():
        clone = Role.objects.create(
            title=title,
            slug=unique_slug(title),
            **{name: getattr(role, name) for name in WORKING_FIELDS if name not in ("slug", "title")},
            created_by=actor,
            updated_by=actor,
        )
        record(
            "careers.role_duplicated",
            request=request,
            actor=actor,
            entity=clone,
            summary=clone.title,
            source=str(role.pk),
        )
    return clone


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
    from . import retention

    return retention.run(now)


def purge_orphan_uploads(now=None) -> int:
    from . import retention

    return retention.purge_uploads(now)


def update_settings(changes: dict, *, actor, request=None) -> dict:
    """Validate and save careers settings (merged over the stored ones); emits careers_settings.updated."""
    from . import config as careers_config
    from .models import CareersSettings

    with transaction.atomic():
        row, _ = CareersSettings.objects.select_for_update().get_or_create(pk=1)
        current = careers_config.clean(row.config or {})
        cleaned = careers_config.clean({**current, **changes})
        row.config = cleaned
        row.updated_at = timezone.now()
        row.updated_by = actor
        row.save()
        record(
            "careers.settings_updated",
            request=request,
            actor=actor,
            entity=row,
            summary="Careers settings",
            fields=sorted(changes),
        )
        sync.emit("careers_settings", "1", "careers_settings.updated", "Careers settings")
    return cleaned
