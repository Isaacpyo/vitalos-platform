"""Application intake (amendment A9, ADR-041): upload tickets, the fallback upload target and
applications. The website verifies Turnstile and its own rate limits first; this module trusts nothing
it is sent. Candidate data and CV contents are never logged.

1. ``create_ticket``: a single-use, 10-minute upload for ``pending/{uuid}.{ext}``: a pre-signed PUT with
   a CV bucket, the admin's own endpoint without one (development and tests only; production refuses).
2. ``store_upload``: the fallback target: token, exact size, 10 MB cap and magic bytes.
3. ``submit``: checks the stored object (exists, size, magic bytes), moves it to
   ``applications/{id}/cv.{ext}`` and creates the application (idempotent by ``submissionId``).
"""

import hashlib
import hmac
import io
import ipaddress
import logging
import re
import secrets
import unicodedata
import uuid
import zipfile
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import storages
from django.core.validators import EmailValidator
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.crypto import salted_hmac

from apps.audit.services import record
from apps.content_sync import formatting, media
from apps.content_sync.models import SiteSettings

from . import config as careers_config
from . import retention
from .models import (
    Application,
    ApplicationSource,
    ApplyMode,
    RightToWork,
    Role,
    UploadTicket,
)

logger = logging.getLogger(__name__)

CV_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}
TICKET_TTL = timedelta(minutes=10)
FALLBACK_LIMIT = 10 * 1024 * 1024
MAX_ZIP_ENTRIES = 2000
EMAIL_DAILY_LIMIT = 3
DUPLICATE_WINDOW = timedelta(days=30)
FIELD_LIMITS = {
    "name": 200,
    "email": 254,
    "phone": 40,
    "location": 120,
    "linkedinUrl": 300,
    "portfolioUrl": 300,
    "noticePeriod": 100,
    "coverNote": 3000,
    "noticeVersion": 40,
    "clientIp": 45,
    "userAgent": 300,
}
_UNSAFE = re.compile(r"[^\w .()-]+")
_CONTROL = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f\u2028\u2029]")
MULTI_LINE = ("coverNote",)
TICKETS_PER_IP_HOUR = 10
APPLICATIONS_PER_IP_HOUR = 5


def single_line(value: str) -> str:
    """Collapse all whitespace (newlines included) and drop control characters: these values go into
    staff email bodies and subjects, so a candidate must not be able to add lines to them."""
    value = " ".join(value.split())  # every kind of whitespace, line breaks included, becomes one space
    return "".join(ch for ch in value if unicodedata.category(ch) not in ("Cc", "Cf", "Zl", "Zp")).strip()


def multi_line(value: str) -> str:
    """Keep newlines (normalised to LF) and drop every other control character."""
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    return _CONTROL.sub("", value).strip()


class IntakeError(Exception):
    """Carries the HTTP status and the contract's ``{"errors": {field: code}}``."""

    def __init__(self, status: int, errors: dict[str, str]):
        super().__init__(status)
        self.status = status
        self.errors = errors


@dataclass
class Accepted:
    application: Application
    created: bool

    def payload(self) -> dict:
        role = self.application.role
        process = ""
        if role is not None:
            process = role.process_md or careers_config.load()["process"]
        return {
            "applicationId": str(self.application.pk),
            "roleTitle": role.title if role is not None else "",
            "process": process,
        }


# --- Checks --------------------------------------------------------------------------------------


def max_bytes() -> int:
    return settings.CAREERS_CV_MAX_MB * 1024 * 1024


def cv_matches(data: bytes, mime: str) -> bool:
    """``%PDF-``, or a ZIP whose central directory lists ``word/document.xml``. Nothing is extracted."""
    if mime == "application/pdf":
        return data.startswith(b"%PDF-")
    if mime in CV_TYPES and data.startswith(b"PK\x03\x04"):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as archive:
                names = archive.namelist()
        except (zipfile.BadZipFile, ValueError, OSError, EOFError):
            return False
        return len(names) <= MAX_ZIP_ENTRIES and "word/document.xml" in names
    return False


def safe_filename(name: str) -> str:
    name = unicodedata.normalize("NFKC", (name or "").replace("\\", "/").split("/")[-1])
    name = "".join(ch for ch in name if ch.isprintable())
    name = _UNSAFE.sub("_", name).strip(" .")
    return name[:200] or "cv"


def open_role_for(slug: str, now=None) -> Role | None:
    """The role, if it is accepting applications through the form right now."""
    from . import public

    if not SiteSettings.load().careers_open:
        return None
    role = public.open_roles(now).filter(published_slug=slug).first()
    if role is None or (role.published_snapshot.get("apply") or {}).get("mode") != ApplyMode.FORM:
        return None
    return role


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_ip(ip: str) -> str:
    """Salted HMAC of the client IP; the raw address is never stored."""
    try:
        normalised = str(ipaddress.ip_address((ip or "").strip()))
    except ValueError:
        return ""
    if settings.CONTENT_IP_SALT:
        return hmac.new(settings.CONTENT_IP_SALT.encode(), normalised.encode(), hashlib.sha256).hexdigest()
    return salted_hmac("careers.ip", normalised, algorithm="sha256").hexdigest()


# --- Upload tickets ------------------------------------------------------------------------------


def presign_put(key: str, mime: str, size: int) -> str:
    """A 10-minute pre-signed PUT for the private CV bucket, bound to the type and exact length."""
    storage = storages["careers_cvs"]
    client = storage.connection.meta.client
    return client.generate_presigned_url(
        "put_object",
        Params={"Bucket": storage.bucket_name, "Key": key, "ContentType": mime, "ContentLength": size},
        ExpiresIn=int(TICKET_TTL.total_seconds()),
        HttpMethod="PUT",
    )


def create_ticket(data: dict, *, client_ip: str = "") -> dict:
    """``client_ip`` comes from the X-Vitalos-Client-Ip header of the website's signed request."""
    errors = {}
    slug = data.get("roleSlug")
    filename = data.get("filename")
    size = data.get("size")
    mime = data.get("mime")
    if not isinstance(slug, str) or not formatting.is_slug(slug):
        errors["roleSlug"] = "invalid"
    if not isinstance(filename, str) or not filename.strip():
        errors["filename"] = "required"
    elif len(filename) > 200:
        errors["filename"] = "too_long"
    if mime not in CV_TYPES:
        errors["mime"] = "upload_type"
    elif isinstance(filename, str) and not filename.lower().endswith("." + CV_TYPES[mime]):
        errors["filename"] = "upload_type"
    if not isinstance(size, int) or isinstance(size, bool) or size < 1:
        errors["size"] = "invalid"
    elif size > max_bytes():
        errors["size"] = "upload_size"
    if errors:
        raise IntakeError(400, errors)
    role = open_role_for(slug)
    if role is None:
        raise IntakeError(409, {"roleSlug": "role_closed"})
    ip_hash = hash_ip(client_ip)
    if ip_hash:
        recent = UploadTicket.objects.filter(
            ip_hash=ip_hash, created_at__gte=timezone.now() - timedelta(hours=1)
        ).count()
        if recent >= TICKETS_PER_IP_HOUR:
            logger.info("Upload tickets rate limited", extra={"code": "ticket_ip_limit"})
            raise IntakeError(429, {"uploadId": "rate_limited"})
    bucket = bool(settings.CAREERS_CV_BUCKET)
    if not bucket and not media.cv_storage_enabled():
        logger.error("CV upload refused", extra={"code": "cv_storage_not_configured"})
        raise IntakeError(503, {"uploadId": "upload_missing"})
    ticket_id = uuid.uuid4()
    extension = CV_TYPES[mime]
    key = f"pending/{ticket_id}.{extension}"
    now = timezone.now()
    ticket = UploadTicket(
        id=ticket_id,
        role=role,
        mode=UploadTicket.Mode.BUCKET if bucket else UploadTicket.Mode.FALLBACK,
        mime=mime,
        extension=extension,
        size=size,
        filename=safe_filename(filename),
        key=key,
        expires_at=now + TICKET_TTL,
        ip_hash=ip_hash,
    )
    if bucket:
        url = presign_put(key, mime, size)
    else:
        token = secrets.token_urlsafe(32)
        ticket.token_hash = _token_hash(token)
        url = f"{settings.APP_BASE_URL}/api/careers/v1/uploads/{ticket_id}?token={token}"
    ticket.save()
    logger.info("Upload ticket issued", extra={"upload_id": str(ticket_id), "mode": ticket.mode})
    return {
        "uploadId": str(ticket_id),
        "uploadUrl": url,
        "method": "PUT",
        "headers": {"Content-Type": mime},
        "expiresAt": formatting.iso(ticket.expires_at),
    }


# --- Fallback upload target ----------------------------------------------------------------------


class UploadRefused(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def check_upload_request(ticket_id, token: str, content_type: str, declared_length: str) -> UploadTicket:
    """Everything about a fallback PUT except the bytes. Raises UploadRefused."""
    ticket = UploadTicket.objects.filter(pk=ticket_id, mode=UploadTicket.Mode.FALLBACK).first()
    if ticket is None or not token or not hmac.compare_digest(ticket.token_hash, _token_hash(token)):
        raise UploadRefused(403, "Invalid upload token")
    if ticket.uploaded_at is not None or ticket.consumed_at is not None:
        raise UploadRefused(403, "This upload link has been used")
    if ticket.expires_at <= timezone.now():
        raise UploadRefused(403, "This upload link has expired")
    if (content_type or "").split(";")[0].strip().lower() != ticket.mime:
        raise UploadRefused(400, "Wrong content type")
    if not declared_length.isdigit():
        raise UploadRefused(400, "Content-Length is required")
    if int(declared_length) > min(FALLBACK_LIMIT, max_bytes()):
        raise UploadRefused(413, "Too large")
    if int(declared_length) != ticket.size:
        raise UploadRefused(400, "The size does not match the upload ticket")
    return ticket


def store_upload(ticket: UploadTicket, data: bytes) -> None:
    if len(data) != ticket.size:
        raise UploadRefused(400, "The size does not match the upload ticket")
    if not cv_matches(data, ticket.mime):
        raise UploadRefused(400, "The file is not a PDF or Word document")
    claimed = UploadTicket.objects.filter(
        pk=ticket.pk, uploaded_at__isnull=True, consumed_at__isnull=True
    ).update(uploaded_at=timezone.now())
    if not claimed:
        raise UploadRefused(403, "This upload link has been used")
    storages["careers_cvs"].save(ticket.key, ContentFile(data))
    logger.info("CV uploaded", extra={"upload_id": str(ticket.pk)})


# --- Applications --------------------------------------------------------------------------------


def _text(data: dict, name: str, errors: dict, *, required: bool = False) -> str:
    value = data.get(name)
    if value is None:
        value = ""
    if not isinstance(value, str):
        errors[name] = "invalid"
        return ""
    value = (multi_line if name in MULTI_LINE else single_line)(value)
    if required and not value:
        errors[name] = "required"
    elif len(value) > FIELD_LIMITS[name]:
        errors[name] = "too_long"
    return value


def _validate(data: dict) -> dict:
    errors: dict[str, str] = {}
    cleaned = {name: _text(data, name, errors, required=name in ("name", "email")) for name in FIELD_LIMITS}
    if "email" not in errors:
        try:
            EmailValidator()(cleaned["email"])
        except ValidationError:
            errors["email"] = "invalid"
    for name in ("linkedinUrl", "portfolioUrl"):
        value = cleaned[name]
        if value and name not in errors and not re.match(r"^https?://[^\s<>\"']+$", value):
            errors[name] = "invalid"
    if data.get("rightToWork") not in RightToWork.values:
        errors["rightToWork"] = "required" if not data.get("rightToWork") else "invalid"
    if data.get("consent") is not True:
        errors["consent"] = "required"
    if data.get("source") not in ApplicationSource.values:
        errors["source"] = "invalid"
    try:
        cleaned["uploadId"] = uuid.UUID(str(data.get("uploadId")))
    except ValueError:
        errors["uploadId"] = "upload_missing"
    if not isinstance(data.get("roleSlug"), str) or not formatting.is_slug(data["roleSlug"]):
        errors["roleSlug"] = "invalid"
    if errors:
        raise IntakeError(400, errors)
    cleaned["rightToWork"] = data["rightToWork"]
    cleaned["source"] = data["source"]
    cleaned["roleSlug"] = data["roleSlug"]
    return cleaned


def _read_stored(ticket: UploadTicket) -> bytes | None:
    storage = storages["careers_cvs"]
    try:
        if not storage.exists(ticket.key):
            return None
        with storage.open(ticket.key, "rb") as handle:
            return handle.read(max_bytes() + 1)
    except OSError:
        return None


def submit(data: dict, *, now=None) -> Accepted:
    """Create the application, or return the existing one for a repeated ``submissionId``."""
    now = now or timezone.now()
    try:
        submission_id = uuid.UUID(str(data.get("submissionId")))
    except ValueError:
        raise IntakeError(400, {"submissionId": "invalid"}) from None
    existing = Application.objects.select_related("role").filter(submission_id=submission_id).first()
    if existing is not None:
        return Accepted(existing, created=False)
    cleaned = _validate(data)
    role = open_role_for(cleaned["roleSlug"], now)
    if role is None:
        raise IntakeError(409, {"roleSlug": "role_closed"})
    email = cleaned["email"].lower()
    ip_hash = hash_ip(cleaned["clientIp"])
    if ip_hash:
        from_ip = Application.objects.filter(
            ip_hash=ip_hash, created_at__gte=now - timedelta(hours=1)
        ).count()
        if from_ip >= APPLICATIONS_PER_IP_HOUR:
            logger.info("Applications rate limited", extra={"code": "application_ip_limit"})
            raise IntakeError(429, {"email": "rate_limited"})
    recent = Application.objects.filter(email__iexact=email, created_at__gte=now - timedelta(days=1)).count()
    if recent >= EMAIL_DAILY_LIMIT:
        raise IntakeError(429, {"email": "rate_limited"})
    ticket = UploadTicket.objects.filter(pk=cleaned["uploadId"], role=role, consumed_at__isnull=True).first()
    if ticket is None or (ticket.mode == UploadTicket.Mode.FALLBACK and ticket.uploaded_at is None):
        raise IntakeError(422, {"uploadId": "upload_missing"})
    stored = _read_stored(ticket)
    if stored is None:
        raise IntakeError(422, {"uploadId": "upload_missing"})
    if len(stored) != ticket.size or len(stored) > max_bytes():
        raise IntakeError(422, {"uploadId": "upload_size"})
    if not cv_matches(stored, ticket.mime):
        raise IntakeError(422, {"uploadId": "upload_type"})

    application_id = uuid.uuid4()
    storage = storages["careers_cvs"]
    final_key = storage.save(f"applications/{application_id}/cv.{ticket.extension}", ContentFile(stored))
    duplicate = (
        Application.objects.filter(email__iexact=email, role=role, created_at__gte=now - DUPLICATE_WINDOW)
        .order_by("created_at")
        .first()
    )
    try:
        with transaction.atomic():
            consumed = UploadTicket.objects.filter(pk=ticket.pk, consumed_at__isnull=True).update(
                consumed_at=now
            )
            if not consumed:
                raise IntakeError(422, {"uploadId": "upload_missing"})
            application = Application.objects.create(
                id=application_id,
                role=role,
                name=cleaned["name"],
                email=email,
                phone=cleaned["phone"],
                location_text=cleaned["location"],
                linkedin_url=cleaned["linkedinUrl"],
                portfolio_url=cleaned["portfolioUrl"],
                right_to_work=cleaned["rightToWork"],
                notice_period=cleaned["noticePeriod"],
                cover_note=cleaned["coverNote"],
                cv_path=final_key,
                cv_filename=ticket.filename,
                cv_mime=ticket.mime,
                cv_size=len(stored),
                consent_at=now,
                notice_version=cleaned["noticeVersion"],
                source=cleaned["source"],
                submission_id=submission_id,
                duplicate_of=duplicate,
                ip_hash=ip_hash,
                user_agent=cleaned["userAgent"],
                created_at=now,
                updated_at=now,
            )
            record(
                "careers.application_received",
                entity_type="careers.application",
                entity_id=retention.hashed_id(application.pk),
                summary=f"Application for {role.title}",
                duplicate=duplicate is not None,
            )
            transaction.on_commit(lambda: _after_commit(application.pk))
    except IntegrityError:
        storage.delete(final_key)
        existing = Application.objects.select_related("role").filter(submission_id=submission_id).first()
        if existing is None:
            raise
        return Accepted(existing, created=False)
    except IntakeError:
        storage.delete(final_key)
        raise
    try:
        storage.delete(ticket.key)
    except OSError:
        logger.warning("Pending CV not removed", extra={"upload_id": str(ticket.pk)})
    logger.info(
        "Application received",
        extra={"application_id": str(application.pk), "duplicate": duplicate is not None},
    )
    return Accepted(application, created=True)


def _after_commit(application_id) -> None:
    from . import alerts

    try:
        alerts.application_received(application_id)
    except Exception:  # noqa: BLE001 - alerts must never fail an accepted application
        logger.exception("Application alerts failed", extra={"application_id": str(application_id)})
