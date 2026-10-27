"""Business rules for the email template library. Views call these; they re-check the role."""

from __future__ import annotations

import hashlib
import json
import logging
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from email.utils import formataddr, make_msgid
from pathlib import Path

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.text import slugify

from apps.accounts.roles import is_superadmin
from apps.audit.services import record
from apps.mailer.layout import clean_line
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
    content_hash,
)
from .rendering import RenderedTemplate, preview_html, render_content, sample_values, unsubscribe_url
from .variables import VARIABLES, Variable, names_in

logger = logging.getLogger("superadmin.mail")

SEED_DIR = Path(__file__).resolve().parent / "seed"
BLOCK_TYPES = (
    "heading",
    "section",
    "text",
    "button",
    "badge",
    "quote",
    "details",
    "divider",
    "signature",
    "code",
    "steps",
    "items",
    "stats",
)
TEST_DOMAIN = "@vitalos.co.uk"
TEST_SENDS_PER_HOUR = 10
SEEDED_NOTE = "Seeded from the repository"
UPDATED_NOTE = "Updated from the repository (email review, Oct 2026)"


def require_superadmin(user) -> None:
    if not is_superadmin(user):
        raise PermissionDenied


def normalise_newlines(value):
    """Browsers post textarea line breaks as CRLF; store LF so unchanged text compares equal."""
    if isinstance(value, str):
        return value.replace("\r\n", "\n").replace("\r", "\n")
    if isinstance(value, list):
        return [normalise_newlines(item) for item in value]
    if isinstance(value, dict):
        return {key: normalise_newlines(item) for key, item in value.items()}
    return value


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
        else:
            errors += _new_block_errors(index, kind, block, content)
    return errors


def _new_block_errors(index: int, kind: str, block: dict, content: dict) -> list[str]:
    """Rules for the code, steps, items and stats blocks (ADR-030 status note, October 2026)."""
    items = block.get("items") or []
    if kind == "code":
        code = (block.get("code") or "").strip()
        if not code:
            return [f"Block {index} (code) needs a code or a variable."]
        visible = f"{content.get('subject') or ''}\n{content.get('preheader') or ''}"
        if code in visible:
            return [f"Block {index} (code): the code must not appear in the subject or preheader."]
    elif kind == "steps" and not 1 <= len([i for i in items if str(i).strip()]) <= 4:
        return [f"Block {index} (steps) needs 1 to 4 steps."]
    elif kind == "items" and (not items or any(not (i.get("title") or "").strip() for i in items)):
        return [f"Block {index} (item list) needs at least one item, each with a title."]
    elif kind == "stats" and (
        not 2 <= len(items) <= 4 or any(not (i.get("value") and i.get("label")) for i in items)
    ):
        return [f"Block {index} (figures) needs 2 to 4 figures, each with a value and a label."]
    return []


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
    content = normalise_newlines(content)
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
    content = normalise_newlines(content)
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
        .exclude(status__in=("spam", "automated"))
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


# --- Use a template ----------------------------------------------------------------------------------

VALUE_MAX_LENGTH = 1000
RECENT_ENQUIRIES = 25
USE_ACTIONS = ("copy_subject", "copy_email", "copy_text", "download_eml")
USE_SENDS_PER_HOUR = 60
#: A second send of the same template to the same recipient within this window is refused (double click).
RESEND_GUARD_SECONDS = 120
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_USE_FIELDS = ("subject", "preheader", "reason", "footer_notice", "blocks")


@dataclass
class UsePackage:
    """A template rendered for one recipient, with what the Use page needs to show and send."""

    rendered: RenderedTemplate
    recipient: str
    values: dict[str, str]
    #: Variables still empty, so their fallback is in the email: (name, fallback).
    empty: list[tuple[str, str]] = field(default_factory=list)
    needs_recipient: bool = False

    @property
    def ready(self) -> bool:
        """Every detail is optional: an empty one shows its fallback. Only a missing recipient blocks."""
        return not self.needs_recipient

    @property
    def subject(self) -> str:
        return self.rendered.subject

    @property
    def text(self) -> str:
        return self.rendered.email.text

    @property
    def html(self) -> str:
        """HTML for pasting: inline images as data URIs, light theme (mail clients apply their own)."""
        return preview_html(self.rendered, "light")


def can_use(template: EmailTemplate) -> bool:
    return template.status != Status.ARCHIVED


def use_variables(template: EmailTemplate) -> list[Variable]:
    """The known merge variables the template uses, in order of first use. The footer unsubscribe link
    is added for the recipient, so it is not a field."""
    content = template.content()
    names = names_in({key: content[key] for key in _USE_FIELDS})
    return [VARIABLES[name] for name in names if name in VARIABLES and name != "unsubscribe_link"]


def recent_enquiries(limit: int = RECENT_ENQUIRIES) -> list:
    """Recent real enquiries (not spam, not anonymised) to prefill from."""
    from apps.enquiries.models import Enquiry

    return list(
        Enquiry.objects.filter(anonymised_at__isnull=True)
        .exclude(status__in=("spam", "automated"))
        .order_by("-created_at")[:limit]
    )


def enquiry_for_prefill(pk):
    from apps.enquiries.models import Enquiry

    if not str(pk or "").isdigit():
        return None
    return (
        Enquiry.objects.filter(pk=int(pk), anonymised_at__isnull=True)
        .exclude(status__in=("spam", "automated"))
        .first()
    )


def use_defaults(user) -> dict[str, str]:
    """Starting values: the sender is the signed-in admin. The rest is for the user to fill."""
    return {key: value for key, value in sample_values(user, None).items() if value}


def prefill_values(enquiry, current: Mapping[str, str]) -> dict[str, str]:
    """Current values with the enquiry's details laid over them."""
    values = dict(current)
    for name, value in sample_values(None, enquiry).items():
        if value:
            values[name] = value
    return values


def clean_values(template: EmailTemplate, posted: Mapping[str, str], prefix: str = "var-") -> dict[str, str]:
    """Values for the template's variables from a form post: single-line, trimmed, length-limited."""
    values: dict[str, str] = {}
    for variable in use_variables(template):
        raw = posted.get(f"{prefix}{variable.name}", "") or ""
        values[variable.name] = clean_line(_CONTROL_CHARS.sub("", raw))[:VALUE_MAX_LENGTH].strip()
    return values


def clean_recipient(raw: str) -> str:
    recipient = (raw or "").strip().lower()
    if not recipient:
        return ""
    try:
        validate_email(recipient)
    except ValidationError:
        raise ValidationError("Enter a valid recipient email address.") from None
    return recipient


def _use_render(template: EmailTemplate, values: Mapping[str, str], recipient: str) -> UsePackage:
    merged = {name: value for name, value in values.items() if value}
    if recipient and not merged.get("email"):
        merged["email"] = recipient
    rendered = render_content(template.content(), merged, key=template.key, recipient=recipient)
    empty = [
        (variable.name, variable.fallback)
        for variable in use_variables(template)
        if not merged.get(variable.name) and variable.fallback
    ]
    return UsePackage(
        rendered=rendered,
        recipient=recipient,
        values=merged,
        empty=empty,
        needs_recipient=template.needs_opt_out and not recipient,
    )


def preview_use(
    template: EmailTemplate, *, user, values: Mapping[str, str], recipient: str = ""
) -> UsePackage:
    """Renders for the Use page preview. Never refuses on compliance: the page shows what is missing."""
    require_superadmin(user)
    if not can_use(template):
        raise ValidationError("Archived templates cannot be used. Unarchive it first.")
    return _use_render(template, values, recipient)


def prepare_use(
    template: EmailTemplate,
    *,
    user,
    values: Mapping[str, str],
    recipient: str,
    action: str,
    request=None,
) -> UsePackage:
    """Renders for copying or downloading, enforcing the compliance rules, and audits the use.

    Outreach and marketing email needs a recipient (its unsubscribe link is signed for them) and the
    recipient must not have unsubscribed. The audit event never holds the recipient's address.
    """
    require_superadmin(user)
    if action not in USE_ACTIONS:
        raise ValidationError("Unknown action.")
    _check_use(template, recipient)
    package = _use_render(template, values, recipient)
    record(
        "email_templates.used",
        request=request,
        actor=user,
        entity=template,
        summary=f"{template.name} (v{template.version}): {action}",
    )
    return package


def _check_use(template: EmailTemplate, recipient: str) -> None:
    if not can_use(template):
        raise ValidationError("Archived templates cannot be used. Unarchive it first.")
    if template.needs_opt_out:
        if not recipient:
            raise ValidationError(
                "Outreach and marketing email needs a recipient address, because its unsubscribe link is "
                "signed for them."
            )
        if is_suppressed(recipient):
            raise ValidationError(
                "This recipient has unsubscribed from outreach and marketing email. Do not send it to them."
            )


def _message(template: EmailTemplate, package: UsePackage, *, user, headers: dict[str, str], **kwargs):
    """The email from the signed-in user, to the recipient if given."""
    name = clean_line(user.get_full_name() or "")
    sender = formataddr(("" if name == user.email else name, user.email))
    headers = dict(headers)
    if template.needs_opt_out:
        headers["List-Unsubscribe"] = f"<{unsubscribe_url(package.recipient, template.key)}>"
        headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click"
    return build_message(
        package.rendered.email,
        subject=package.subject,
        to=[package.recipient] if package.recipient else [],
        from_email=sender,
        headers=headers,
        **kwargs,
    )


def eml_message(template: EmailTemplate, package: UsePackage, *, user):
    """An unsent draft for Outlook or Apple Mail: from the signed-in user, to the recipient if given."""
    return _message(template, package, user=user, headers={"X-Unsent": "1"})


def send_use(
    template: EmailTemplate, *, user, values: Mapping[str, str], recipient: str, request=None
) -> bool:
    """Sends the filled-in template to one recipient, from the signed-in admin's own address.

    The rules for copying apply (archived, outreach recipient, unsubscribed), plus: a recipient is always
    needed, the sender's address must be on the Vitalos sending domain, sends are limited per hour and a
    repeat of the same send within two minutes is refused. A person sends it, so it carries no
    Auto-Submitted header (ADR-046 is for automated mail); replies go to the sender. The audit event
    never holds the recipient's address. Returns True if it left the platform (EMAIL_TRANSPORT=resend).
    """
    require_superadmin(user)
    if not recipient:
        raise ValidationError("Add the recipient's email address to send.")
    sender = (user.email or "").strip().lower()
    if not sender.endswith(TEST_DOMAIN):
        raise ValidationError(f"Email is sent from your own address, which must be a {TEST_DOMAIN} address.")
    _check_use(template, recipient)
    counter = f"email-templates:sends:{user.pk}"
    cache.add(counter, 0, timeout=3600)
    if cache.incr(counter) > USE_SENDS_PER_HOUR:
        raise ValidationError(
            f"You can send {USE_SENDS_PER_HOUR} emails an hour from templates. Try again later."
        )
    digest = hashlib.sha256(recipient.encode()).hexdigest()[:24]
    guard = f"email-templates:sent:{user.pk}:{template.pk}:{digest}"
    if not cache.add(guard, 1, timeout=RESEND_GUARD_SECONDS):
        raise ValidationError("You sent this email to this recipient a moment ago. It was not sent again.")
    package = _use_render(template, values, recipient)
    message = _message(
        template,
        package,
        user=user,
        headers={"Message-ID": make_msgid(domain="vitalos.co.uk")},
        reply_to=[user.email],
    )
    try:
        message.send(fail_silently=False)
    except Exception:  # noqa: BLE001 - any transport failure is reported to the sender
        cache.delete(guard)
        logger.warning("Template send failed", extra={"template": template.key}, exc_info=True)
        raise ValidationError(
            "The email could not be sent. Try again, or download the .eml and send it yourself."
        ) from None
    record(
        "email_templates.sent",
        request=request,
        actor=user,
        entity=template,
        summary=f"{template.name} (v{template.version})",
    )
    return settings.EMAIL_TRANSPORT == "resend"


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
        template.seed_hash = content_hash(template.content())
        template.save()
        _snapshot(template, user=user, note=SEEDED_NOTE)
        created += 1
    if created:
        record("email_templates.seeded", actor=user, summary=f"{created} templates")
    return created


def _seed_content(item: dict) -> dict:
    """A seed item's content fields as ``seed_library`` stores them."""
    content = {name: item.get(name) if item.get(name) is not None else "" for name in CONTENT_FIELDS}
    content["blocks"] = item.get("blocks", [])
    return content


@dataclass
class SeedUpdate:
    created: int = 0
    updated: list[str] = field(default_factory=list)
    unchanged: int = 0
    #: Edited in the admin (or not from the seed): never overwritten.
    skipped: list[str] = field(default_factory=list)


@transaction.atomic
def update_seeded_templates(*, dry_run: bool = False, user=None) -> SeedUpdate:
    """Bring unedited seeded templates up to date with the seed files, and create missing ones.

    A template is updated only while its content hash equals its ``seed_hash``, so nobody has changed it
    in the admin. Each update writes a version snapshot and moves ``seed_hash``; ``status`` is unchanged.
    """
    items = load_seed()
    problems = seed_problems(items)
    if problems:
        raise ValidationError(problems)
    result = SeedUpdate()
    existing = {template.key: template for template in EmailTemplate.objects.select_for_update()}
    for item in items:
        template = existing.get(item["key"])
        if template is None:
            result.created += 1
            continue
        new = _seed_content(item)
        new_hash = content_hash(new)
        if (
            not template.seeded
            or not template.seed_hash
            or content_hash(template.content()) != template.seed_hash
        ):
            if content_hash(template.content()) != new_hash:
                result.skipped.append(template.key)
            else:
                result.unchanged += 1
            continue
        if new_hash == template.seed_hash:
            result.unchanged += 1
            continue
        result.updated.append(template.key)
        if dry_run:
            continue
        for name, value in new.items():
            setattr(template, name, value)
        template.version += 1
        template.seed_hash = new_hash
        template.updated_by = user
        template.save()
        _snapshot(template, user=user, note=UPDATED_NOTE)
    if not dry_run:
        result.created = seed_library(user)
        if result.updated:
            record(
                "email_templates.seed_updated",
                actor=user,
                summary=f"{len(result.updated)} templates updated from the repository",
            )
    return result
