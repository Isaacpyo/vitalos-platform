"""Inbound mail: parse raw MIME and file it into an enquiry.

Order of work: parse → dedupe on Message-ID → detect auto-replies and bounces (RFC 3834) → sanitise
→ thread (In-Reply-To/References, then a [VIT-0001] subject token from the same sender) → classify a
new thread (a person, a form relay, our own notification or automated mail: ``automated.py``, ADR-046)
→ store the message and attachments → audit → queue notifications (people and form relays only).
"""

import email
import email.policy
import email.utils
import hashlib
import logging
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.audit.services import record

from . import attachments, automated, notifications, services
from .models import Attachment, Enquiry, InboxSettings, Message
from .sanitise import sanitise_html

logger = logging.getLogger(__name__)

MAX_RAW_BYTES = 25 * 1024 * 1024  # Cloudflare Email Routing rejects anything larger.
REF_TOKEN = re.compile(r"\[VIT-(\d{4,})\]")
MESSAGE_ID = re.compile(r"<[^<>\s]+>")
# Headers kept for display and investigation; everything else stays only in the forwarded original.
KEPT_HEADERS = (
    "Date", "Message-ID", "In-Reply-To", "References", "Reply-To", "Auto-Submitted", "Precedence",
    "List-Id", "List-Unsubscribe", "X-Autoreply", "X-Autorespond", "Return-Path", "Content-Type",
    "Authentication-Results", automated.NOTIFICATION_HEADER, automated.REFERENCE_HEADER,
    automated.FORM_HEADER, automated.PIPELINE_HEADER, automated.OFFER_HEADER,
)  # fmt: skip
NULL_SENDERS = ("mailer-daemon@", "postmaster@")


@dataclass
class ParsedEmail:
    message_id: str
    from_name: str
    from_email: str
    to: list[str]
    cc: list[str]
    subject: str
    text: str
    html: str
    in_reply_to: str
    references: list[str]
    headers: dict[str, str]
    is_auto: bool
    is_bounce: bool
    date: datetime | None
    parts: list[tuple[str, str, bytes]] = field(default_factory=list)  # (filename, content type, data)


def _addresses(value) -> list[tuple[str, str]]:
    return [
        (name, addr.lower()) for name, addr in email.utils.getaddresses([str(value or "")]) if "@" in addr
    ]


def _ids(value) -> list[str]:
    return MESSAGE_ID.findall(str(value or ""))


def _text(part) -> str:
    try:
        return part.get_content()
    except (LookupError, UnicodeDecodeError, AssertionError):
        payload = part.get_payload(decode=True) or b""
        return payload.decode("utf-8", errors="replace")


def detect_auto(message, from_email: str) -> tuple[bool, bool]:
    """(is_auto, is_bounce) from RFC 3834 and common auto-responder headers."""
    auto_submitted = str(message.get("Auto-Submitted", "")).strip().lower()
    precedence = str(message.get("Precedence", "")).strip().lower()
    return_path = str(message.get("Return-Path", "")).strip()
    content_type = message.get_content_type()
    is_bounce = content_type == "multipart/report" or from_email.startswith(NULL_SENDERS)
    is_auto = (
        is_bounce
        or (auto_submitted not in ("", "no"))
        or precedence in ("bulk", "list", "junk", "auto_reply")
        or any(message.get(name) for name in ("X-Autoreply", "X-Autorespond", "List-Id", "List-Unsubscribe"))
        or return_path == "<>"
    )
    return is_auto, is_bounce


def parse(raw: bytes) -> ParsedEmail:
    message = email.message_from_bytes(raw, policy=email.policy.default)
    senders = _addresses(message.get("From"))
    from_name, from_email = senders[0] if senders else ("", "")
    message_id = (_ids(message.get("Message-ID")) or [""])[0]
    if not message_id:
        # No Message-ID: derive a stable one, so a re-delivery of the same bytes is still a duplicate.
        message_id = f"<{hashlib.sha256(raw).hexdigest()}@missing-id.vitalos.invalid>"
    text_part = message.get_body(preferencelist=("plain",))
    html_part = message.get_body(preferencelist=("html",))
    parts = []
    for part in message.iter_attachments():
        payload = part.get_payload(decode=True)
        if payload is None or part.get_content_maintype() == "multipart":
            continue
        parts.append((part.get_filename() or "attachment", part.get_content_type(), payload))
    is_auto, is_bounce = detect_auto(message, from_email)
    try:
        date = email.utils.parsedate_to_datetime(str(message.get("Date"))) if message.get("Date") else None
    except (TypeError, ValueError):
        date = None
    if date is not None and date.tzinfo is None:
        date = date.replace(tzinfo=UTC)
    return ParsedEmail(
        message_id=message_id[:998],
        from_name=str(from_name)[:200],
        from_email=from_email,
        to=[
            addr
            for _, addr in _addresses(message.get_all("To", []) and ",".join(map(str, message.get_all("To"))))
        ],
        cc=[
            addr
            for _, addr in _addresses(message.get_all("Cc", []) and ",".join(map(str, message.get_all("Cc"))))
        ],
        subject=str(message.get("Subject", ""))[:300],
        text=_text(text_part) if text_part is not None else "",
        html=_text(html_part) if html_part is not None else "",
        in_reply_to=(_ids(message.get("In-Reply-To")) or [""])[0],
        references=_ids(message.get("References")),
        headers={
            name: str(message.get(name))[:2000] for name in KEPT_HEADERS if message.get(name) is not None
        },
        is_auto=is_auto,
        is_bounce=is_bounce,
        date=date,
        parts=parts,
    )


def _thread(parsed: ParsedEmail) -> Enquiry | None:
    candidates = [parsed.in_reply_to, *reversed(parsed.references)]
    candidates = [value for value in candidates if value]
    if candidates:
        match = Message.objects.filter(message_id_header__in=candidates).select_related("enquiry").first()
        if match:
            return match.enquiry
    token = REF_TOKEN.search(parsed.subject)
    if token:
        # The subject token alone could be guessed, so it only threads mail from the same sender.
        return Enquiry.objects.filter(
            number=int(token.group(1)), from_email__iexact=parsed.from_email
        ).first()
    return None


def _snippet(text: str) -> str:
    return " ".join(text.split())[:300]


def ingest(raw: bytes, *, provider: str, envelope_to: str = "") -> tuple[Message | None, bool]:
    """File ``raw`` into an enquiry. Returns (message, created). Duplicates return (existing, False)."""
    if len(raw) > MAX_RAW_BYTES:
        raise ValueError("Message larger than 25 MiB")
    parsed = parse(raw)
    if not parsed.from_email:
        raise ValueError("Message has no sender address")
    existing = Message.objects.filter(message_id_header=parsed.message_id).first()
    if existing is not None:
        return existing, False
    try:
        with transaction.atomic():
            message, enquiry, event = _store(parsed, provider=provider, envelope_to=envelope_to)
    except IntegrityError:
        # A concurrent delivery of the same Message-ID won the race.
        return Message.objects.filter(message_id_header=parsed.message_id).first(), False
    inbox = InboxSettings.load()
    InboxSettings.objects.filter(pk=inbox.pk).update(last_inbound_at=timezone.now())
    if event:
        notifications.queue(event, enquiry)
    if event == "new_enquiry":
        _pipeline_intake(enquiry, parsed)
    return message, True


def _pipeline_intake(enquiry: Enquiry, parsed: ParsedEmail) -> None:
    """Open an AI & Data opportunity for a form relay marked ``X-Vitalos-Pipeline: ai-data``.

    Only our own form relays count (the header from anyone else is ignored). A failure here never
    fails the ingest: the enquiry is already filed, and "Create opportunity" on it does the same.
    """
    headers = parsed.headers
    if (headers.get(automated.PIPELINE_HEADER) or "").strip().lower() != "ai-data":
        return
    if not automated.is_own_address(parsed.from_email):
        return
    if not (headers.get(automated.FORM_HEADER) or headers.get(automated.NOTIFICATION_HEADER)):
        return
    try:
        from apps.aidata.services import create_from_enquiry

        create_from_enquiry(enquiry, offer=(headers.get(automated.OFFER_HEADER) or "").strip().lower())
    except Exception as exc:  # noqa: BLE001 - the enquiry must stay filed whatever happens here
        # Reference and error type only: the message or traceback could carry personal data.
        logger.error("AI & Data intake failed for %s (%s)", enquiry.ref, type(exc).__name__)


def _linked(classification: automated.Classification) -> Enquiry | None:
    """The enquiry an own notification or a repeated website notification describes, if filed already."""
    reference = classification.reference
    if not reference:
        return None
    if classification.kind == automated.OWN:
        number = reference.upper().removeprefix("VIT-")
        return Enquiry.objects.filter(number=int(number)).first() if number.isdigit() else None
    if classification.kind == automated.FORM:
        match = (
            Message.objects.filter(**{f"headers_json__{automated.REFERENCE_HEADER}": reference})
            .select_related("enquiry")
            .first()
        )
        return match.enquiry if match else None
    return None


def _store(parsed: ParsedEmail, *, provider: str, envelope_to: str):
    """Store the message. Returns (message, enquiry, event to notify or None)."""
    enquiry = _thread(parsed)
    is_new = enquiry is None
    now = timezone.now()
    text = parsed.text or ""
    is_auto = parsed.is_auto
    event = None if parsed.is_auto else "customer_reply"
    reason = "Reply on a thread"
    if is_new:
        classification = automated.classify(
            from_email=parsed.from_email,
            headers=parsed.headers,
            is_auto=parsed.is_auto,
            senders=InboxSettings.load().automated_sender_list(),
        )
        reason = classification.reason
        linked = _linked(classification)
        if linked is not None:
            # Already filed: keep this copy on that enquiry, quietly, without changing its state.
            enquiry, is_new, is_auto, event = linked, False, True, None
            reason = f"{classification.reason}, linked to {linked.ref}"
        else:
            person = classification.kind == automated.FORM
            web = person and parsed.headers.get(automated.NOTIFICATION_HEADER) == automated.WEB_NOTIFICATION
            set_aside = classification.kind in (automated.OWN, automated.AUTOMATED)
            enquiry = services.create_enquiry(
                subject=parsed.subject,
                from_name=classification.person_name if person else parsed.from_name,
                from_email=classification.person_email if person else parsed.from_email,
                to_email=(envelope_to or (parsed.to[0] if parsed.to else "")),
                source=Enquiry.Source.WEB_FORM if web else Enquiry.Source.EMAIL,
                snippet=_snippet(text) or _snippet(re.sub(r"<[^>]+>", " ", parsed.html)),
                status=Enquiry.Status.AUTOMATED if set_aside else Enquiry.Status.NEW,
            )
            is_auto = set_aside
            event = None if set_aside else "new_enquiry"
    message = Message.objects.create(
        enquiry=enquiry,
        direction=Message.Direction.INBOUND,
        message_id_header=parsed.message_id,
        in_reply_to=parsed.in_reply_to,
        references=" ".join(parsed.references),
        from_name=parsed.from_name,
        from_email=parsed.from_email,
        to_emails=parsed.to,
        cc_emails=parsed.cc,
        subject=parsed.subject,
        text_body=text,
        html_body_raw=parsed.html,
        html_body_sanitised=sanitise_html(parsed.html),
        headers_json=parsed.headers,
        provider=provider,
        is_auto=is_auto,
        created_at=now,
    )
    total = 0
    for filename, content_type, data in parsed.parts:
        checked = attachments.check(filename, content_type, data, total)
        if not checked.refused_reason:
            total += len(data)
        Attachment.objects.create(
            message=message,
            filename=checked.filename,
            content_type=checked.content_type[:127],
            size_bytes=len(data),
            sha256=checked.sha256,
            storage_key=attachments.store(checked),
            refused_reason=checked.refused_reason
            or ("" if attachments.storage_enabled() else "Not stored: object storage is not configured"),
        )
    if reason == "Reply on a thread":
        services.on_inbound_reply(enquiry, message, bounce=parsed.is_bounce)
    record(
        "enquiries.received",
        entity=enquiry,
        entity_id=enquiry.ref,
        summary=f"{'New enquiry' if is_new else 'Reply'} from {parsed.from_email}",
        actor_email=parsed.from_email,
        provider=provider,
        auto=is_auto,
        classification=reason,
    )
    return message, enquiry, event
