"""Attachment rules: allowlisted types verified by magic bytes, size caps, random storage keys.

Files go to the ``attachments`` storage (S3-compatible object storage such as Cloudflare R2 when
OBJECT_STORAGE_BUCKET is set; local disk in development). Without object storage in production the
bytes are not kept: the metadata is recorded and the original stays in the forwarded support mailbox.
Downloads are short-lived signed URLs (object storage) or a forced download (local), never inline.
"""

import hashlib
import secrets
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages

MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024
MAX_TOTAL_BYTES = 25 * 1024 * 1024

ZIP = b"PK\x03\x04"
OLE = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
# Content type -> (canonical extension, magic check)
ALLOWED = {
    "application/pdf": ("pdf", lambda data: data.startswith(b"%PDF-")),
    "image/png": ("png", lambda data: data.startswith(b"\x89PNG\r\n\x1a\n")),
    "image/jpeg": ("jpg", lambda data: data.startswith(b"\xff\xd8\xff")),
    "image/gif": ("gif", lambda data: data[:6] in (b"GIF87a", b"GIF89a")),
    "image/webp": ("webp", lambda data: data[:4] == b"RIFF" and data[8:12] == b"WEBP"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (
        "docx",
        lambda d: d.startswith(ZIP),
    ),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (
        "xlsx",
        lambda d: d.startswith(ZIP),
    ),
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": (
        "pptx",
        lambda d: d.startswith(ZIP),
    ),
    "application/msword": ("doc", lambda data: data.startswith(OLE)),
    "application/vnd.ms-excel": ("xls", lambda data: data.startswith(OLE)),
    "text/plain": ("txt", lambda data: b"\x00" not in data[:8192]),
    "text/csv": ("csv", lambda data: b"\x00" not in data[:8192]),
}


@dataclass
class Checked:
    filename: str
    content_type: str
    data: bytes
    sha256: str
    refused_reason: str = ""


def check(filename: str, content_type: str, data: bytes, running_total: int) -> Checked:
    content_type = (content_type or "").split(";")[0].strip().lower()
    filename = (filename or "attachment").replace("\\", "/").split("/")[-1][:200] or "attachment"
    digest = hashlib.sha256(data).hexdigest()
    result = Checked(filename=filename, content_type=content_type, data=data, sha256=digest)
    if content_type not in ALLOWED:
        result.refused_reason = "File type not allowed"
    elif not ALLOWED[content_type][1](data):
        result.refused_reason = "File contents do not match the declared type"
    elif len(data) > MAX_ATTACHMENT_BYTES:
        result.refused_reason = "Larger than 15 MB"
    elif running_total + len(data) > MAX_TOTAL_BYTES:
        result.refused_reason = "Message attachments exceed 25 MB in total"
    return result


def storage_enabled() -> bool:
    return settings.ATTACHMENTS_STORAGE_ENABLED


def store(checked: Checked) -> str:
    """Save the bytes under a random key and return the key ('' when storage is off or refused)."""
    if checked.refused_reason or not storage_enabled():
        return ""
    extension = ALLOWED[checked.content_type][0]
    key = f"enquiries/{secrets.token_hex(16)}.{extension}"
    return storages["attachments"].save(key, ContentFile(checked.data))


def open_bytes(key: str) -> bytes:
    with storages["attachments"].open(key, "rb") as handle:
        return handle.read()


def signed_url(key: str) -> str | None:
    """A short-lived URL on object storage, or None for local storage (use the download view)."""
    storage = storages["attachments"]
    if getattr(storage, "querystring_auth", False):
        return storage.url(key)
    return None
