"""Enquiry write rules. Every write is authorised here and recorded in the audit trail.

Views and API handlers call these functions; they never change enquiry models directly.
"""

import email.utils
import html
import logging
import re
import uuid
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.storage import storages
from django.core.mail import EmailMultiAlternatives
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from apps.accounts.roles import is_superadmin
from apps.audit.services import record

from . import attachments, selectors, sla
from .models import Attachment, CannedResponse, Enquiry, EnquiryNote, InboxSettings, Message, Tag
from .sanitise import sanitise_html

logger = logging.getLogger(__name__)

REMOVED = "[removed]"
MAX_TAGS = 10
MAX_TAG_LENGTH = 40
MAX_REFERENCES = 20
MAX_NOTE_LENGTH = 10_000
MAX_REPLY_LENGTH = 50_000
WEB_FORM_LIMIT_PER_HOUR = 5
WEB_FORM_MAX_MESSAGE = 5000
# Local parts that never read replies (RFC 3834: do not answer automated mail).
AUTOMATED_LOCAL_PARTS = ("mailer-daemon", "postmaster", "noreply", "no-reply", "donotreply", "do-not-reply")
REPLY_PREFIX = re.compile(r"^(\s*re\s*:\s*)+", re.IGNORECASE)


class SendError(Exception):
    """The reply could not be handed to the mail transport. It is stored with delivery_status "failed"."""


def _require_access(actor) -> None:
    if not selectors.can_access(actor):
        raise PermissionDenied


def _require_superadmin(actor) -> None:
    if not (selectors.can_access(actor) and is_superadmin(actor)):
        raise PermissionDenied


# --- Creation and inbound -----------------------------------------------------------------------


@transaction.atomic
def create_enquiry(
    *, subject, from_name, from_email, to_email, source, snippet, status=Enquiry.Status.NEW
) -> Enquiry:
    """Allocate the next VIT- number and create the enquiry. Spam gets no SLA target."""
    InboxSettings.load()
    inbox = InboxSettings.objects.select_for_update().get(pk=1)
    highest = Enquiry.objects.aggregate(highest=Max("number"))["highest"] or 0
    number = max(inbox.next_number, highest + 1)
    inbox.next_number = number + 1
    inbox.save(update_fields=["next_number"])
    now = timezone.now()
    return Enquiry.objects.create(
        number=number,
        subject=(subject or "")[:300],
        from_name=(from_name or "")[:200],
        from_email=(from_email or "").strip().lower(),
        to_email=(to_email or "")[:254],
        source=source,
        status=status,
        snippet=(snippet or "")[:300],
        created_at=now,
        last_message_at=now,
        sla_due_at=None if status == Enquiry.Status.SPAM else sla.due_at(now, inbox.sla_first_response_hours),
    )


def create_web_form_enquiry(*, name, email, company, message, ip="") -> Enquiry | None:
    """File a website contact-form submission. Returns None when the sender is over the hourly limit."""
    from . import notifications

    name = " ".join((name or "").split())[:200]
    company = " ".join((company or "").split())[:200]
    email_address = (email or "").strip().lower()
    message = (message or "").strip()
    validate_email(email_address)
    if not message:
        raise ValidationError({"message": "Enter a message."})
    if len(message) > WEB_FORM_MAX_MESSAGE:
        raise ValidationError({"message": f"Keep the message under {WEB_FORM_MAX_MESSAGE} characters."})
    since = timezone.now() - timedelta(hours=1)
    recent = Enquiry.objects.filter(
        source=Enquiry.Source.WEB_FORM, from_email__iexact=email_address, created_at__gte=since
    ).count()
    if recent >= WEB_FORM_LIMIT_PER_HOUR:
        logger.warning("Web form rate limit reached; submission not stored")
        return None
    subject = f"Website enquiry from {name or email_address}" + (f" ({company})" if company else "")
    with transaction.atomic():
        enquiry = create_enquiry(
            subject=subject,
            from_name=name,
            from_email=email_address,
            to_email=settings.SUPPORT_MAILBOX,
            source=Enquiry.Source.WEB_FORM,
            snippet=" ".join(message.split())[:300],
        )
        Message.objects.create(
            enquiry=enquiry,
            direction=Message.Direction.INBOUND,
            message_id_header=f"<webform-{uuid.uuid4()}@vitalos.co.uk>",
            from_name=name,
            from_email=email_address,
            to_emails=[settings.SUPPORT_MAILBOX],
            subject=subject[:300],
            text_body=message,
            headers_json={"Company": company} if company else {},
            provider=Message.Provider.WEB_FORM,
            created_at=enquiry.created_at,
        )
        record(
            "enquiries.received",
            entity=enquiry,
            entity_id=enquiry.ref,
            summary=f"Website form enquiry from {email_address}",
            actor_email=email_address,
            provider="web_form",
            source_ip=ip or "",
        )
    InboxSettings.objects.filter(pk=1).update(last_inbound_at=timezone.now())
    notifications.queue("new_enquiry", enquiry)
    return enquiry


def on_inbound_reply(enquiry, message, *, bounce: bool) -> None:
    """A message joined an existing thread: surface it, and reopen unless it is automated."""
    enquiry.last_message_at = message.created_at
    enquiry.unread = True
    fields = ["last_message_at", "unread", "updated_at"]
    if bounce:
        failed = message.subject or "(no subject)"
        EnquiryNote.objects.create(
            enquiry=enquiry,
            body=f"Delivery failure: {message.from_email} returned a message ({failed[:200]}). "
            "Check the customer's address before replying again.",
            is_system=True,
        )
        enquiry.save(update_fields=fields)
        return
    snippet = " ".join((message.text_body or "").split())[:300]
    if snippet:
        enquiry.snippet = snippet
        fields.append("snippet")
    previous = enquiry.status
    # Out-of-office and other automated replies do not reopen a thread either (RFC 3834).
    if not message.is_auto and previous in (Enquiry.Status.RESOLVED, Enquiry.Status.PENDING):
        enquiry.status = Enquiry.Status.OPEN
        enquiry.resolved_at = None
        fields += ["status", "resolved_at"]
    enquiry.save(update_fields=fields)
    if enquiry.status != previous:
        record(
            "enquiries.status_changed",
            entity=enquiry,
            entity_id=enquiry.ref,
            summary=f"{enquiry.ref} reopened by a customer reply",
            previous=previous,
            status=enquiry.status,
        )


# --- Triage -------------------------------------------------------------------------------------


def _set_unread(enquiry, value: bool) -> bool:
    if enquiry.unread == value:
        return False
    enquiry.unread = value
    Enquiry.objects.filter(pk=enquiry.pk).update(unread=value)
    return True


def mark_read(enquiry, actor, request=None) -> None:
    _require_access(actor)
    if _set_unread(enquiry, False):
        record(
            "enquiries.updated",
            request=request,
            actor=actor,
            entity=enquiry,
            entity_id=enquiry.ref,
            summary=f"Marked {enquiry.ref} as read",
        )


def mark_unread(enquiry, actor, request=None) -> None:
    _require_access(actor)
    if _set_unread(enquiry, True):
        record(
            "enquiries.updated",
            request=request,
            actor=actor,
            entity=enquiry,
            entity_id=enquiry.ref,
            summary=f"Marked {enquiry.ref} as unread",
        )


def record_view(enquiry, actor, request) -> None:
    """UK GDPR accountability: every view of an enquiry is audited. Viewing marks it read."""
    _require_access(actor)
    record(
        "enquiries.viewed",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"Viewed {enquiry.ref}",
    )
    _set_unread(enquiry, False)


@transaction.atomic
def set_status(enquiry, status, actor, request=None) -> None:
    _require_access(actor)
    if status not in Enquiry.Status.values:
        raise ValidationError(f"Unknown status {status!r}.")
    previous = enquiry.status
    if previous == status:
        return
    enquiry.status = status
    if status == Enquiry.Status.RESOLVED:
        enquiry.resolved_at = timezone.now()
    elif previous == Enquiry.Status.RESOLVED:
        enquiry.resolved_at = None
    enquiry.save(update_fields=["status", "resolved_at", "updated_at"])
    record(
        "enquiries.status_changed",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"{enquiry.ref}: {Enquiry.Status(previous).label} → {Enquiry.Status(status).label}",
        previous=previous,
        status=status,
    )


def set_priority(enquiry, priority, actor, request=None) -> None:
    _require_access(actor)
    if priority not in Enquiry.Priority.values:
        raise ValidationError(f"Unknown priority {priority!r}.")
    previous = enquiry.priority
    if previous == priority:
        return
    enquiry.priority = priority
    enquiry.save(update_fields=["priority", "updated_at"])
    record(
        "enquiries.updated",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"{enquiry.ref}: priority {previous} → {priority}",
        previous=previous,
        priority=priority,
    )


def assign(enquiry, assignee, actor, request=None) -> None:
    """Assign to ``assignee`` (or unassign with None). The assignee hears about it unless self-assigned."""
    from . import notifications

    _require_access(actor)
    if assignee is not None and not (assignee.is_active and selectors.can_access(assignee)):
        raise ValidationError("Enquiries can only be assigned to active SuperAdmins and ServiceLeads.")
    previous = enquiry.assignee
    if (previous.pk if previous else None) == (assignee.pk if assignee else None):
        return
    with transaction.atomic():
        enquiry.assignee = assignee
        enquiry.save(update_fields=["assignee", "updated_at"])
        record(
            "enquiries.assigned",
            request=request,
            actor=actor,
            entity=enquiry,
            entity_id=enquiry.ref,
            summary=f"{enquiry.ref} assigned to {assignee.display_label if assignee else 'nobody'}",
            previous=getattr(previous, "email", None),
            assignee=getattr(assignee, "email", None),
        )
    if assignee is not None and assignee.pk != actor.pk:
        notifications.queue("assigned_to_me", enquiry, actor=actor)


def normalise_tags(names) -> list[str]:
    cleaned: list[str] = []
    for name in names or []:
        tag = " ".join(str(name).split()).lower()
        if not tag:
            continue
        if len(tag) > MAX_TAG_LENGTH:
            raise ValidationError(f"Tags must be {MAX_TAG_LENGTH} characters or fewer.")
        if tag not in cleaned:
            cleaned.append(tag)
    if len(cleaned) > MAX_TAGS:
        raise ValidationError(f"An enquiry can have at most {MAX_TAGS} tags.")
    return cleaned


@transaction.atomic
def set_tags(enquiry, names: list[str], actor, request=None) -> list[str]:
    _require_access(actor)
    cleaned = normalise_tags(names)
    previous = sorted(enquiry.tags.values_list("name", flat=True))
    if previous == sorted(cleaned):
        return cleaned
    tags = [Tag.objects.get_or_create(name=name)[0] for name in cleaned]
    enquiry.tags.set(tags)
    record(
        "enquiries.updated",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"{enquiry.ref}: tags {', '.join(cleaned) or 'none'}",
        previous=previous,
        tags=cleaned,
    )
    return cleaned


def add_note(enquiry, body, actor, request=None) -> EnquiryNote:
    _require_access(actor)
    body = (body or "").strip()
    if not body:
        raise ValidationError("Write a note first.")
    if len(body) > MAX_NOTE_LENGTH:
        raise ValidationError(f"Keep notes under {MAX_NOTE_LENGTH} characters.")
    note = EnquiryNote.objects.create(enquiry=enquiry, author=actor, body=body)
    record(
        "enquiries.noted",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"Internal note on {enquiry.ref}",
    )
    return note


# --- Replies ------------------------------------------------------------------------------------


def is_automated_address(address: str) -> bool:
    local = (address or "").split("@")[0].strip().lower()
    return local.startswith(AUTOMATED_LOCAL_PARTS)


def is_automated_sender(enquiry) -> bool:
    """True when replying would answer a machine: a null/noreply address, or only automated mail."""
    if is_automated_address(enquiry.from_email):
        return True
    inbound = enquiry.messages.filter(direction=Message.Direction.INBOUND)
    return inbound.exists() and not inbound.filter(is_auto=False).exists()


def reply_subject(enquiry) -> str:
    """``Re: <subject> [VIT-0001]`` without doubling "Re:" or the reference token."""
    base = REPLY_PREFIX.sub("", (enquiry.subject or "").strip()).strip() or "Your enquiry"
    token = f"[{enquiry.ref}]"
    if token.lower() not in base.lower():
        base = f"{base} {token}"
    return f"Re: {base}"[:300]


def _references(parent) -> list[str]:
    if parent is None:
        return []
    ids: list[str] = []
    for value in [*(parent.references or "").split(), parent.message_id_header]:
        if value and value not in ids:
            ids.append(value)
    if len(ids) > MAX_REFERENCES:
        # Keep the thread root and the most recent ids (RFC 5322 section 3.6.4).
        ids = [ids[0], *ids[-(MAX_REFERENCES - 1) :]]
    return ids


def _html_paragraphs(text: str) -> str:
    blocks = [block for block in re.split(r"\n\s*\n", text.strip()) if block.strip()]
    return "".join(f"<p>{html.escape(block).replace(chr(10), '<br>')}</p>" for block in blocks)


def _check_uploads(files) -> list[attachments.Checked]:
    checked: list[attachments.Checked] = []
    total = 0
    for upload in files or ():
        size = getattr(upload, "size", None) or 0
        name = getattr(upload, "name", "") or "attachment"
        content_type = getattr(upload, "content_type", "") or ""
        if size > attachments.MAX_ATTACHMENT_BYTES:
            item = attachments.Checked(name[:200], content_type, b"", "", "Larger than 15 MB")
        else:
            upload.seek(0)
            data = upload.read()
            item = attachments.check(name, content_type, data, total)
            if not item.refused_reason:
                total += len(data)
        checked.append(item)
    return checked


def send_reply(enquiry, *, body_text, actor, files=(), resolve=False, request=None) -> Message:
    """Email the customer from the support mailbox, threaded onto their latest message."""
    _require_access(actor)
    body_text = (body_text or "").strip()
    if not body_text:
        raise ValidationError("Write a reply first.")
    if len(body_text) > MAX_REPLY_LENGTH:
        raise ValidationError("This reply is too long to send.")
    if enquiry.status == Enquiry.Status.SPAM:
        raise ValidationError("This enquiry is marked as spam. Move it out of spam before replying.")
    if enquiry.anonymised_at is not None:
        raise ValidationError("This enquiry has been anonymised and cannot be replied to.")
    if is_automated_sender(enquiry):
        raise ValidationError("This sender is an automated address. Replies are not sent to automated mail.")

    inbox = InboxSettings.load()
    parent = (
        enquiry.messages.filter(direction=Message.Direction.INBOUND).order_by("-created_at", "-id").first()
    )
    references = _references(parent)
    message_id = email.utils.make_msgid(domain="vitalos.co.uk")
    headers = {"Message-ID": message_id}
    if parent is not None:
        headers["In-Reply-To"] = parent.message_id_header
        headers["References"] = " ".join(references)
    signature = (inbox.signature or "").strip()
    text = body_text + (f"\n\n{signature}" if signature else "")
    html_body = _html_paragraphs(body_text) + (_html_paragraphs(signature) if signature else "")
    subject = reply_subject(enquiry)
    checked = _check_uploads(files)

    outgoing = EmailMultiAlternatives(
        subject=subject,
        body=text,
        from_email=settings.SUPPORT_FROM_HEADER,
        to=[enquiry.from_email],
        reply_to=[settings.SUPPORT_MAILBOX],
        headers=headers,
    )
    outgoing.attach_alternative(html_body, "text/html")
    for item in checked:
        if not item.refused_reason:
            outgoing.attach(item.filename, item.data, item.content_type)

    resend = settings.EMAIL_TRANSPORT == "resend"
    failed = False
    try:
        outgoing.send(fail_silently=False)
    except Exception:  # noqa: BLE001 - any transport failure is stored and surfaced as SendError
        failed = True
        logger.warning("Reply send failed", extra={"ref": enquiry.ref}, exc_info=True)
    now = timezone.now()
    with transaction.atomic():
        message = Message.objects.create(
            enquiry=enquiry,
            direction=Message.Direction.OUTBOUND,
            message_id_header=message_id,
            in_reply_to=headers.get("In-Reply-To", ""),
            references=headers.get("References", ""),
            from_name="Vitalos Support",
            from_email=settings.SUPPORT_MAILBOX,
            to_emails=[enquiry.from_email],
            subject=subject,
            text_body=text,
            html_body_raw=html_body,
            html_body_sanitised=sanitise_html(html_body),
            headers_json=headers,
            provider=Message.Provider.RESEND if resend else Message.Provider.LOG,
            provider_message_id=str(getattr(outgoing, "provider_message_id", "") or "")[:200],
            sent_by=actor,
            delivery_status="failed" if failed else ("sent" if resend else "logged"),
            created_at=now,
        )
        for item in checked:
            Attachment.objects.create(
                message=message,
                filename=item.filename,
                content_type=item.content_type[:127],
                size_bytes=len(item.data),
                sha256=item.sha256,
                storage_key=attachments.store(item),
                refused_reason=item.refused_reason,
            )
        if failed:
            record(
                "enquiries.replied",
                request=request,
                actor=actor,
                entity=enquiry,
                entity_id=enquiry.ref,
                summary=f"Reply to {enquiry.ref} failed to send",
                delivery_status="failed",
            )
        else:
            enquiry.first_response_at = enquiry.first_response_at or now
            enquiry.unread = False
            enquiry.last_message_at = now
            previous = enquiry.status
            if resolve:
                enquiry.status = Enquiry.Status.RESOLVED
                enquiry.resolved_at = now
            else:
                enquiry.status = Enquiry.Status.PENDING
                enquiry.resolved_at = None
            enquiry.save(
                update_fields=[
                    "first_response_at",
                    "unread",
                    "last_message_at",
                    "status",
                    "resolved_at",
                    "updated_at",
                ]
            )
            record(
                "enquiries.replied",
                request=request,
                actor=actor,
                entity=enquiry,
                entity_id=enquiry.ref,
                summary=f"Replied to {enquiry.ref}" + (" and resolved it" if resolve else ""),
                message_id=message_id,
                attachments=sum(1 for item in checked if not item.refused_reason),
                previous_status=previous,
                status=enquiry.status,
            )
    if failed:
        raise SendError("The reply could not be sent. It has been saved as failed; please try again.")
    return message


# --- Export and settings ------------------------------------------------------------------------


def _iso(value):
    return value.isoformat() if value else None


def export_enquiry(enquiry, actor, request) -> dict:
    """Everything held about one enquiry, for a subject access request. Audited."""
    _require_access(actor)
    messages = []
    for message in enquiry.messages.prefetch_related("attachments"):
        messages.append(
            {
                "direction": message.direction,
                "message_id": message.message_id_header,
                "in_reply_to": message.in_reply_to,
                "references": message.references.split(),
                "from_name": message.from_name,
                "from_email": message.from_email,
                "to": list(message.to_emails or []),
                "cc": list(message.cc_emails or []),
                "subject": message.subject,
                "text": message.text_body,
                "html_sanitised": message.html_body_sanitised,
                "headers": dict(message.headers_json or {}),
                "provider": message.provider,
                "delivery_status": message.delivery_status,
                "is_auto": message.is_auto,
                "created_at": _iso(message.created_at),
                "attachments": [
                    {
                        "filename": item.filename,
                        "content_type": item.content_type,
                        "size_bytes": item.size_bytes,
                        "sha256": item.sha256,
                        "stored": bool(item.storage_key),
                        "refused_reason": item.refused_reason,
                    }
                    for item in message.attachments.all()
                ],
            }
        )
    data = {
        "ref": enquiry.ref,
        "subject": enquiry.subject,
        "from_name": enquiry.from_name,
        "from_email": enquiry.from_email,
        "to_email": enquiry.to_email,
        "source": enquiry.source,
        "status": enquiry.status,
        "priority": enquiry.priority,
        "assignee": getattr(enquiry.assignee, "email", None),
        "tags": sorted(enquiry.tags.values_list("name", flat=True)),
        "created_at": _iso(enquiry.created_at),
        "first_response_at": _iso(enquiry.first_response_at),
        "last_message_at": _iso(enquiry.last_message_at),
        "resolved_at": _iso(enquiry.resolved_at),
        "sla_due_at": _iso(enquiry.sla_due_at),
        "anonymised_at": _iso(enquiry.anonymised_at),
        "messages": messages,
        "notes": [
            {
                "author": getattr(note.author, "email", None),
                "body": note.body,
                "is_system": note.is_system,
                "created_at": _iso(note.created_at),
            }
            for note in enquiry.notes.select_related("author")
        ],
        "exported_at": _iso(timezone.now()),
    }
    record(
        "enquiries.exported",
        request=request,
        actor=actor,
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"Exported {enquiry.ref}",
    )
    return data


def update_inbox_settings(
    *, sla_first_response_hours, signature, retention_months, spam_retention_days, actor, request=None
) -> InboxSettings:
    _require_superadmin(actor)
    errors = {}
    if not 1 <= int(sla_first_response_hours) <= 80:
        errors["sla_first_response_hours"] = "Choose between 1 and 80 working hours."
    if not 1 <= int(retention_months) <= 120:
        errors["retention_months"] = "Choose between 1 and 120 months."
    if not 1 <= int(spam_retention_days) <= 365:
        errors["spam_retention_days"] = "Choose between 1 and 365 days."
    signature = (signature or "").strip()
    if len(signature) > 2000:
        errors["signature"] = "Keep the signature under 2000 characters."
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        InboxSettings.load()
        inbox = InboxSettings.objects.select_for_update().get(pk=1)
        inbox.sla_first_response_hours = int(sla_first_response_hours)
        inbox.signature = signature
        inbox.retention_months = int(retention_months)
        inbox.spam_retention_days = int(spam_retention_days)
        inbox.save()
        record(
            "enquiries.updated",
            request=request,
            actor=actor,
            entity=inbox,
            summary="Changed inbox settings",
            sla_first_response_hours=inbox.sla_first_response_hours,
            retention_months=inbox.retention_months,
            spam_retention_days=inbox.spam_retention_days,
        )
    return inbox


def save_canned_response(*, title, body_text, actor, pk=None) -> CannedResponse:
    _require_superadmin(actor)
    title = " ".join((title or "").split())
    body_text = (body_text or "").strip()
    if not title or not body_text:
        raise ValidationError("A canned response needs a title and a body.")
    if len(title) > 120:
        raise ValidationError({"title": "Keep the title under 120 characters."})
    if pk is None:
        canned = CannedResponse.objects.create(title=title, body_text=body_text, created_by=actor)
    else:
        canned = CannedResponse.objects.get(pk=pk)
        canned.title = title
        canned.body_text = body_text
        canned.save()
    record(
        "enquiries.updated",
        actor=actor,
        entity=canned,
        summary=f"{'Created' if pk is None else 'Updated'} canned response {title!r}",
    )
    return canned


def delete_canned_response(pk, actor) -> None:
    _require_superadmin(actor)
    canned = CannedResponse.objects.filter(pk=pk).first()
    if canned is None:
        return
    title = canned.title
    canned.delete()
    record(
        "enquiries.updated",
        actor=actor,
        entity_type="enquiries.cannedresponse",
        entity_id=pk,
        summary=f"Deleted canned response {title!r}",
    )


# --- Retention ----------------------------------------------------------------------------------


def _delete_files(enquiry) -> int:
    storage = storages["attachments"]
    deleted = 0
    for item in Attachment.objects.filter(message__enquiry=enquiry).exclude(storage_key=""):
        try:
            storage.delete(item.storage_key)
            deleted += 1
        except Exception:  # noqa: BLE001 - a missing object must not block retention
            logger.warning("Attachment delete failed", extra={"attachment": item.pk}, exc_info=True)
    return deleted


@transaction.atomic
def anonymise_enquiry(enquiry) -> None:
    """Retention: keep the record's shape and timings, remove every personal detail and file."""
    files = _delete_files(enquiry)
    Attachment.objects.filter(message__enquiry=enquiry).update(filename=REMOVED, storage_key="")
    enquiry.messages.update(
        from_name=REMOVED,
        from_email=REMOVED,
        to_emails=[],
        cc_emails=[],
        subject=REMOVED,
        text_body=REMOVED,
        html_body_raw="",
        html_body_sanitised="",
        headers_json={},
    )
    enquiry.notes.update(body=REMOVED)
    enquiry.from_name = REMOVED
    enquiry.from_email = REMOVED
    enquiry.to_email = ""
    enquiry.subject = REMOVED
    enquiry.snippet = REMOVED
    enquiry.anonymised_at = timezone.now()
    enquiry.save()
    record(
        "enquiries.anonymised",
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"Anonymised {enquiry.ref} under the retention policy",
        files_deleted=files,
    )


@transaction.atomic
def delete_spam_enquiry(enquiry) -> None:
    """Retention for spam: remove the enquiry and its files entirely."""
    ref = enquiry.ref
    files = _delete_files(enquiry)
    enquiry.delete()
    record(
        "enquiries.anonymised",
        entity_type="enquiries.enquiry",
        entity_id=ref,
        summary=f"Deleted spam {ref} under the retention policy",
        files_deleted=files,
    )
