"""Portal file rules: allow-listed types verified by content (magic bytes and, for Office files, the archive's
structure), a size cap, a filename/extension check and random storage keys in a private store.

Nothing here trusts the browser's declared type or the filename. Downloads go through an authorised view that
re-checks visibility on every request and always sends the file as an attachment (never inline).
"""

from __future__ import annotations

import hashlib
import io
import re
import secrets
import zipfile
from dataclasses import dataclass

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import storages

from apps.enquiries.attachments import ALLOWED, OLE

MAX_BYTES = 10 * 1024 * 1024
# Office archives: the part directory every genuine file of that type has, and the macro parts we refuse.
_OFFICE_DIR = {
    "docx": "word/",
    "xlsx": "xl/",
    "pptx": "ppt/",
}
_REFUSED_PARTS = ("vbaproject.bin", "macros/", "activex/")
_EXT_ALIASES = {"jpg": {"jpg", "jpeg"}, "txt": {"txt", "text", "md"}, "csv": {"csv"}}
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._ ()\-]+")


# The enquiries app still accepts .doc and .xls; the portal does not, because those OLE containers can carry
# macros and objects that the portal's archive checks cannot inspect.
_LEGACY_TYPES = {"application/msword", "application/vnd.ms-excel"}
_LEGACY_MESSAGE = (
    "Older Word and Excel files (.doc, .xls) are not accepted because they can carry macros. "
    "Save the file as .docx or .xlsx, or as a PDF, and upload that."
)


@dataclass
class Checked:
    filename: str
    content_type: str
    data: bytes
    sha256: str
    refused_reason: str = ""

    @property
    def ok(self) -> bool:
        return not self.refused_reason


def clean_filename(name: str) -> str:
    name = (name or "file").replace("\\", "/").split("/")[-1]
    name = _SAFE_NAME.sub("_", name).strip(" .") or "file"
    return name[:150]


def _office_ok(data: bytes, ext: str) -> str:
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            names = [n.lower() for n in archive.namelist()]
            if len(names) > 2000:
                return "Archive has too many parts"
            if "[content_types].xml" not in names or not any(n.startswith(_OFFICE_DIR[ext]) for n in names):
                return "File contents do not match the declared type"
            if any(part in n for n in names for part in _REFUSED_PARTS):
                return "Files containing macros are not accepted"
            if sum(info.file_size for info in archive.infolist()) > 200 * 1024 * 1024:
                return "Archive expands to an unreasonable size"
    except zipfile.BadZipFile:
        return "File contents do not match the declared type"
    return ""


def check(filename: str, declared_type: str, data: bytes) -> Checked:
    content_type = (declared_type or "").split(";")[0].strip().lower()
    name = clean_filename(filename)
    result = Checked(name, content_type, data, hashlib.sha256(data).hexdigest())
    if not data:
        result.refused_reason = "The file is empty"
    elif len(data) > MAX_BYTES:
        result.refused_reason = f"Larger than {MAX_BYTES // (1024 * 1024)} MB"
    elif content_type in _LEGACY_TYPES or data.startswith(OLE) or name.lower().endswith((".doc", ".xls")):
        result.refused_reason = _LEGACY_MESSAGE
    elif content_type not in ALLOWED:
        result.refused_reason = "This file type is not accepted"
    else:
        ext, magic = ALLOWED[content_type]
        suffix = name.rsplit(".", 1)[-1].lower() if "." in name else ""
        if suffix not in _EXT_ALIASES.get(ext, {ext}):
            result.refused_reason = "The file name's extension does not match its type"
        elif not magic(data):
            result.refused_reason = "File contents do not match the declared type"
        elif ext in _OFFICE_DIR:
            result.refused_reason = _office_ok(data, ext)
        elif ext in ("txt", "csv"):
            try:
                data.decode("utf-8")
            except UnicodeDecodeError:
                result.refused_reason = "Text files must be UTF-8"
    return result


def storage_enabled() -> bool:
    return bool(getattr(settings, "PORTAL_FILES_STORAGE_ENABLED", False))


def store(organisation_id: int, checked: Checked) -> str:
    """Save under a random key and return it ('' when storage is not configured or the file was refused)."""
    if checked.refused_reason or not storage_enabled():
        return ""
    ext = ALLOWED[checked.content_type][0]
    key = f"portal/{organisation_id}/{secrets.token_hex(16)}.{ext}"
    return storages["portal_files"].save(key, ContentFile(checked.data))


def open_file(key: str):
    return storages["portal_files"].open(key, "rb")
