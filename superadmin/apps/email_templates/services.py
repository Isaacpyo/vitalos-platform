"""Business rules for the email template library. Views call these; they re-check the role."""

from __future__ import annotations

import json
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import PermissionDenied, ValidationError
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.roles import is_superadmin
from apps.audit.services import record
from apps.mailer.messages import build_message

from .models import (
    CONTENT_FIELDS,
    Category,
    EmailSuppression,
    EmailTemplate,
    EmailTemplateVersion,
    Kind,
    ManagedBy,
    Status,
)
from .rendering import render_content, sample_values, unsubscribe_url
from .variables import VARIABLES, names_in

SEED_DIR = Path(__file__).resolve().parent / "seed"
BLOCK_TYPES = ("heading", "section", "text", "button", "badge", "quote", "details", "divider", "signature")
TEST_DOMAIN = "@vitalos.co.uk"
TEST_SENDS_PER_HOUR = 10


def require_superadmin(user) -> None:
    if not is_superadmin(user):
        raise PermissionDenied


def content_errors(content: dict) -> list[str]:
    """Problems that stop a save. Unknown variables are warnings (shown in the editor), not errors."""
    errors = []
    if content.get("category") not in Category.values:
        errors.append("Choose a category.")
    if content.get("kind") not in Kind.values:
        errors.append("Choose a kind.")
    if content.get("kind") in (Kind.OUTREACH, Kind.MARKETING) and not (content.get("reason") or "").strip():
        errors.append("Outreach and marketing email needs a reason for contact (UK GDPR and PECR).")
    for index, block in enumerate(content.get("blocks") or [], start=1):
        kind = block.get("type") if isinstance(block, dict) else None
        if kind not in BLOCK_TYPES:
            errors.append(f"Block {index} has an unknown type.")
        elif kind == "button" and not (block.get("label") and block.get("url")):
            errors.append(f"Block {index} (button) needs a label and a link.")
    return errors


def _snapshot(template: EmailTemplate, *, user, note: str) -> None:
    EmailTemplateVersion.objects.create(
        template=template, number=template.version, content=template.content(), note=note, created_by=user
    )


def _unique_key(base: str) -> str:
    base = (slugify(base) or "template")[:90]
    key, n = base, 2
    while EmailTemplate.objects.filter(key=key).exists():
        key = f"{base}-{n}"
        n += 1
    return key


@transaction.atomic
def create_template(
    *, content: dict, status: str, user, request=None, note: str = "Created"
) -> EmailTemplate:
    require_superadmin(user)
    errors = content_errors(content)
    if errors:
        raise ValidationError(errors)
    template = EmailTemplate(key=_unique_key(content["name"]), status=status, updated_by=user)
    for name in CONTENT_FIELDS:
        setattr(template, name, content.get(name, getattr(template, name)))
    template.save()
    _snapshot(template, user=user, note=note)
    record("email_templates.created", request=request, actor=user, entity=template, summary=template.name)
    return template


@transaction.atomic
def update_template(
    template: EmailTemplate,
    *,
    content: dict,
    status: str,
    user,
    request=None,
    note: str = "Edited",
    action: str = "email_templates.updated",
) -> bool:
    """Saves edits. A content change bumps the version and writes a snapshot. Returns False if unchanged."""
    require_superadmin(user)
    errors = content_errors(content)
    if errors:
        raise ValidationError(errors)
    content = {name: content.get(name, getattr(template, name)) for name in CONTENT_FIELDS}
    content_changed = template.content() != content
    if not content_changed and template.status == status:
        return False
    for name, value in content.items():
        setattr(template, name, value)
    template.status = status
    template.updated_by = user
    if content_changed:
        template.version += 1
    template.save()
    if content_changed:
        _snapshot(template, user=user, note=note)
    record(
        action, request=request, actor=user, entity=template, summary=f"{template.name} (v{template.version})"
    )
    return True


def duplicate_template(template: EmailTemplate, *, user, request=None) -> EmailTemplate:
    require_superadmin(user)
    content = template.content()
    content["name"] = f"Copy of {template.name}"[:120]
    copy = create_template(
        content=content,
        status=Status.DRAFT,
        user=user,
        request=request,
        note=f"Duplicated from {template.key} v{template.version}",
    )
    record("email_templates.duplicated", request=request, actor=user, entity=copy, summary=template.name)
    return copy


def set_archived(template: EmailTemplate, archived: bool, *, user, request=None) -> None:
    """Archive instead of delete. Unarchiving returns the template to Draft."""
    require_superadmin(user)
    template.status = Status.ARCHIVED if archived else Status.DRAFT
    template.updated_by = user
    template.save(update_fields=["status", "updated_by", "updated_at"])
    action = "email_templates.archived" if archived else "email_templates.unarchived"
    record(action, request=request, actor=user, entity=template, summary=template.name)


def restore_version(template: EmailTemplate, number: int, *, user, request=None) -> None:
    require_superadmin(user)
    version = template.versions.get(number=number)
    status = template.status if template.status != Status.ARCHIVED else Status.DRAFT
    update_template(
        template,
        content=version.content,
        status=status,
        user=user,
        request=request,
        note=f"Restored from v{number}",
        action="email_templates.version_restored",
    )


def latest_enquiry():
    """The newest real enquiry, used as preview and test data."""
    from apps.enquiries.models import Enquiry

    return (
        Enquiry.objects.filter(anonymised_at__isnull=True)
        .exclude(status="spam")
        .order_by("-created_at")
        .first()
    )


def send_test(template: EmailTemplate, *, user, request=None) -> str:
    """Sends the saved template, with sample data, to the signed-in admin's own Vitalos address only."""
    require_superadmin(user)
    recipient = (user.email or "").strip().lower()
    if not recipient.endswith(TEST_DOMAIN):
        raise ValidationError(
            f"Test emails go only to your own {TEST_DOMAIN} address, and you are signed in as {recipient}."
        )
    counter = f"email-templates:test-sends:{user.pk}"
    cache.add(counter, 0, timeout=3600)
    if cache.incr(counter) > TEST_SENDS_PER_HOUR:
        raise ValidationError(f"You can send {TEST_SENDS_PER_HOUR} test emails an hour. Try again later.")
    values = sample_values(user, latest_enquiry())
    rendered = render_content(template.content(), values, key=template.key, recipient=recipient)
    headers = {"Auto-Submitted": "auto-generated", "X-Auto-Response-Suppress": "All"}
    if template.needs_opt_out:
        headers["List-Unsubscribe"] = f"<{unsubscribe_url(recipient, template.key)}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    message = build_message(
        rendered.email,
        subject=f"[Test] {rendered.subject}",
        to=[recipient],
        from_email=settings.NOTIFY_FROM_HEADER,
        headers=headers,
    )
    message.send()
    record(
        "email_templates.test_sent",
        request=request,
        actor=user,
        entity=template,
        summary=f"{template.name} (v{template.version})",
    )
    return recipient


def unsubscribe(email: str, template_key: str, request=None) -> None:
    EmailSuppression.objects.get_or_create(
        email=email.strip().lower(), defaults={"template_key": template_key}
    )
    # The address is not written to the audit trail; the suppression list holds it.
    record("email_templates.unsubscribed", request=request, summary=f"From {template_key or 'Vitalos email'}")


def is_suppressed(email: str) -> bool:
    return EmailSuppression.objects.filter(email=email.strip().lower()).exists()


# --- Seed data ---------------------------------------------------------------------------------


def load_seed() -> list[dict]:
    """The library's seed templates, from the JSON files in ``seed/`` (kept in the repository)."""
    items = []
    for path in sorted(SEED_DIR.glob("*.json")):
        items.extend(json.loads(path.read_text(encoding="utf-8")))
    return items


def seed_problems(items: list[dict]) -> list[str]:
    problems, keys = [], set()
    for item in items:
        key = item.get("key", "?")
        if key in keys:
            problems.append(f"{key}: duplicate key")
        keys.add(key)
        problems += [f"{key}: {error}" for error in content_errors(item)]
        unknown = [name for name in names_in(item) if name not in VARIABLES]
        if unknown:
            problems.append(f"{key}: unknown variables {unknown}")
    return problems


@transaction.atomic
def seed_library(user=None) -> int:
    """Creates seed templates that do not exist yet (as Draft). Never changes an existing template."""
    items = load_seed()
    problems = seed_problems(items)
    if problems:
        raise ValidationError(problems)
    created = 0
    for item in items:
        if EmailTemplate.objects.filter(key=item["key"]).exists():
            continue
        template = EmailTemplate(
            key=item["key"],
            status=Status.DRAFT,
            managed_by=item.get("managed_by", ManagedBy.LIBRARY),
            seeded=True,
            updated_by=user,
        )
        for name in CONTENT_FIELDS:
            value = item.get(name)
            setattr(template, name, value if value is not None else "")
        template.blocks = item.get("blocks", [])
        template.save()
        _snapshot(template, user=user, note="Seeded from the repository")
        created += 1
    if created:
        record("email_templates.seeded", actor=user, summary=f"{created} templates")
    return created
