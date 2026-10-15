"""Builders for the Careers read API (contract: contracts/content-api/v1/openapi.yaml).

Query-time filters on every request (ADR-036): an open role whose published closing date has passed
counts as closed; paused, draft and archived roles are 404. The role's own hiring process falls back
to the careers default, and the equal-opportunities statement and privacy notice come from the live
careers settings (a settings change emits ``careers``).
"""

from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from apps.content_sync import formatting, sections, shapes
from apps.content_sync.choices import PRACTICE_ORDER
from apps.content_sync.models import SiteSettings, SlugRedirect

from . import config as careers_config
from .models import EmploymentType, Level, Role, RoleStatus, Sponsorship, WorkModel

SUMMARY_KEYS = (
    "id",
    "slug",
    "title",
    "practice",
    "level",
    "location",
    "workModel",
    "employmentType",
    "salary",
    "closesAt",
    "showOnHome",
)


def salary(role: Role) -> dict | None:
    if not role.show_salary or role.salary_min is None or role.salary_max is None:
        return None
    return {
        "min": role.salary_min,
        "max": role.salary_max,
        "currency": role.salary_currency,
        "period": role.salary_period,
        "label": formatting.salary_label(
            role.salary_min, role.salary_max, role.salary_currency, role.salary_period
        ),
    }


def shapeable(role: Role) -> bool:
    """Whether the working copy has the enum values every role shape needs."""
    return (
        role.practice in PRACTICE_ORDER
        and role.work_model in WorkModel.values
        and role.employment_type in EmploymentType.values
        and formatting.is_slug(role.slug)
    )


def build_detail(role: Role, *, date_posted: datetime, last_modified: datetime) -> dict:
    """RoleDetail from the working copy: the JSON stored as ``published_snapshot``."""
    level = shapes.choice(role.level, Level(role.level).label) if role.show_level and role.level else None
    sponsorship = (
        shapes.choice(role.sponsorship, Sponsorship(role.sponsorship).label)
        if role.sponsorship in (Sponsorship.AVAILABLE, Sponsorship.NOT_AVAILABLE)
        else None
    )
    return {
        "id": str(role.id),
        "slug": role.slug,
        "title": role.title,
        "practice": shapes.practice_choice(role.practice),
        "level": level,
        "location": role.location_text,
        "workModel": shapes.choice(role.work_model, WorkModel(role.work_model).label),
        "employmentType": shapes.choice(role.employment_type, EmploymentType(role.employment_type).label),
        "salary": salary(role),
        "closesAt": formatting.date_value(role.closes_at),
        "showOnHome": bool(role.show_on_home),
        "state": "open",
        "summary": role.summary,
        "sections": {
            "about": role.about_md,
            "responsibilities": role.responsibilities_md,
            "requirements": role.requirements_md,
            "niceToHave": role.nice_to_have_md,
            "process": role.process_md,
            "equalOpportunities": "",
        },
        "sponsorship": sponsorship,
        "apply": {
            "mode": role.apply_mode,
            "externalUrl": (role.external_apply_url or None) if role.apply_mode == "external" else None,
        },
        "datePosted": formatting.date_value(date_posted),
        "lastModified": formatting.iso(last_modified),
        "privacy": {"noticeUrl": None, "noticeVersion": None},
    }


def with_settings(detail: dict, config: dict) -> dict:
    """Fill the parts that come from the live careers settings."""
    data = {**detail, "sections": dict(detail["sections"])}
    data["sections"]["process"] = detail["sections"].get("process") or config["process"]
    data["sections"]["equalOpportunities"] = config["equal_opportunities"]
    data["privacy"] = {
        "noticeUrl": config["privacy_notice_url"] or None,
        "noticeVersion": config["privacy_notice_version"] or None,
    }
    return data


def summary(detail: dict) -> dict:
    return {key: detail[key] for key in SUMMARY_KEYS}


# --- Visibility ----------------------------------------------------------------------------------


def open_roles(now: datetime | None = None):
    now = now or timezone.now()
    return Role.objects.filter(status=RoleStatus.OPEN, published_snapshot__isnull=False).filter(
        Q(published_closes_at__isnull=True) | Q(published_closes_at__gt=now)
    )


def closed_roles(now: datetime | None = None):
    """Closed, or open with a published closing date that has passed (the query-time filter)."""
    now = now or timezone.now()
    return Role.objects.filter(published_snapshot__isnull=False).filter(
        Q(status=RoleStatus.CLOSED) | Q(status=RoleStatus.OPEN, published_closes_at__lte=now)
    )


def careers_open() -> bool:
    return SiteSettings.load().careers_open


def _ordered(roles) -> list[Role]:
    return sorted(
        roles,
        key=lambda role: (
            role.sort,
            -(role.first_opened_at or role.last_published_at or timezone.now()).timestamp(),
        ),
    )


def copy_block(config: dict) -> dict:
    return {
        "heading": config["heading"],
        "intro": config["intro"],
        "values": config["values"],
        "statements": config["statements"],
        "emptyState": config["empty_state"],
        "associatesLine": config["associates_line"] if config["associates_line_enabled"] else None,
        "benefits": config["benefits"],
        "process": config["process"],
        "salaryPolicy": config["salary_policy"],
        "equalOpportunities": config["equal_opportunities"],
        "privacyNoticeUrl": config["privacy_notice_url"] or None,
        "privacyNoticeVersion": config["privacy_notice_version"] or None,
        "speculativeApplications": config["speculative_applications_enabled"],
    }


def careers_page(now: datetime | None = None) -> dict:
    config = careers_config.load()
    roles = _ordered(open_roles(now))
    groups = []
    for practice in PRACTICE_ORDER:
        members = [
            summary(role.published_snapshot)
            for role in roles
            if (role.published_snapshot.get("practice") or {}).get("key") == practice
        ]
        if members:
            groups.append({"practice": shapes.practice_choice(practice), "roles": members})
    return {"copy": copy_block(config), "groups": groups, "total": sum(len(g["roles"]) for g in groups)}


def role_detail(slug: str, now: datetime | None = None) -> dict | None:
    """RoleDetail, ClosedRole, ``{"redirect": slug}``, or None (404)."""
    now = now or timezone.now()
    role = open_roles(now).filter(published_slug=slug).first()
    if role is not None:
        return with_settings(role.published_snapshot, careers_config.load())
    closed = closed_roles(now).filter(published_slug=slug).first()
    if closed is not None:
        snapshot = closed.published_snapshot
        closed_at = closed.closed_at or closed.published_closes_at or now
        return {
            "state": "closed",
            "slug": closed.published_slug,
            "title": snapshot["title"],
            "practice": snapshot["practice"],
            "closedAt": formatting.date_value(closed_at),
        }
    redirect = SlugRedirect.objects.filter(entity="role", from_slug=slug).first()
    if redirect is not None:
        target = (open_roles(now) | closed_roles(now)).filter(pk=redirect.to_id).first()
        if target is not None and target.published_slug and target.published_slug != slug:
            return {"redirect": target.published_slug}
    return None


def home_section(now: datetime | None = None) -> dict | None:
    config = sections.load(sections.HOME_CAREERS)
    if not config["enabled"]:
        return None
    careers = careers_config.load()
    roles = _ordered(open_roles(now))
    roles = [r for r in roles if r.published_snapshot.get("showOnHome")] + [
        r for r in roles if not r.published_snapshot.get("showOnHome")
    ]
    chosen = [summary(role.published_snapshot) for role in roles[: config["count"]]]
    if not chosen and config["when_no_roles"] == "hide":
        return None
    show_message = not chosen and config["when_no_roles"] == "show_message"
    return {
        "heading": config["heading"],
        "intro": config["intro"],
        "roles": chosen,
        "message": careers["empty_state"] if show_message else None,
        "associatesLine": careers["associates_line"]
        if show_message and careers["associates_line_enabled"]
        else None,
    }


def sitemap_entries(now: datetime | None = None) -> list[dict]:
    from .models import CareersSettings

    roles = list(open_roles(now))
    settings_row = CareersSettings.objects.filter(pk=1).first()
    stamps = [role.last_published_at for role in roles if role.last_published_at]
    if settings_row is not None:
        stamps.append(settings_row.updated_at)
    newest = max(stamps, default=None) or timezone.now()
    entries = [{"path": "/careers", "lastModified": formatting.iso(newest)}]
    for role in _ordered(roles):
        modified = role.last_published_at or role.first_opened_at or newest
        entries.append({"path": f"/careers/{role.published_slug}", "lastModified": formatting.iso(modified)})
    return entries


def preview_detail(role: Role, now: datetime | None = None) -> dict | None:
    now = now or timezone.now()
    if not shapeable(role):
        return None
    detail = build_detail(role, date_posted=role.first_opened_at or now, last_modified=now)
    return with_settings(detail, careers_config.load())
