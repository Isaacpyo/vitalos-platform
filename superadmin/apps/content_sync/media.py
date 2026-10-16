"""Public media (post and author images) and the CV storage switch.

Images: JPEG, PNG, WebP or AVIF only (no SVG), checked by magic bytes, at most 5 MB, stored under a
random ``content/{uuid}.{ext}`` key in the ``content_media`` storage (public-read bucket, or local disk
in development). Dimensions are read from the file headers here, without an imaging library.
"""

import struct
import uuid
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.files.storage import storages

from .models import MediaAsset

MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_DIMENSION = 10000
EXTENSIONS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/avif": "avif"}


@dataclass(frozen=True)
class ImageInfo:
    content_type: str
    width: int
    height: int


def _png(data: bytes) -> tuple[int, int] | None:
    if data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        return None
    return struct.unpack(">II", data[16:24])


def _jpeg(data: bytes) -> tuple[int, int] | None:
    if data[:3] != b"\xff\xd8\xff":
        return None
    index = 2
    length = len(data)
    while index + 9 < length:
        if data[index] != 0xFF:
            index += 1
            continue
        marker = data[index + 1]
        if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
            index += 2
            continue
        segment = struct.unpack(">H", data[index + 2 : index + 4])[0]
        # Start-of-frame markers carry the dimensions (not DHT C4, JPG C8 or DAC CC).
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            height, width = struct.unpack(">HH", data[index + 5 : index + 9])
            return width, height
        index += 2 + segment
    return None


def _webp(data: bytes) -> tuple[int, int] | None:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    chunk = data[12:16]
    if chunk == b"VP8X" and len(data) >= 30:
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height
    if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF
    if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
        bits = int.from_bytes(data[21:25], "little")
        return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
    return None


def _avif(data: bytes) -> tuple[int, int] | None:
    if data[4:8] != b"ftyp" or not any(brand in data[8:64] for brand in (b"avif", b"avis")):
        return None
    index = data.find(b"ispe")
    if index < 0 or index + 16 > len(data):
        return None
    return struct.unpack(">II", data[index + 8 : index + 16])


READERS = {"image/png": _png, "image/jpeg": _jpeg, "image/webp": _webp, "image/avif": _avif}


def inspect_image(data: bytes) -> ImageInfo:
    """The image's real type and size from its bytes; raises ValidationError for anything else."""
    if not data:
        raise ValidationError("Choose an image to upload.")
    if len(data) > MAX_IMAGE_BYTES:
        raise ValidationError("Images must be 5 MB or smaller.")
    for content_type, reader in READERS.items():
        try:
            size = reader(data)
        except (struct.error, IndexError):
            size = None
        if size:
            width, height = size
            if not (0 < width <= MAX_DIMENSION and 0 < height <= MAX_DIMENSION):
                raise ValidationError("The image dimensions could not be read.")
            return ImageInfo(content_type, width, height)
    raise ValidationError("Upload a JPEG, PNG, WebP or AVIF image.")


def media_enabled() -> bool:
    return bool(settings.CONTENT_MEDIA_STORAGE_ENABLED)


def cv_storage_enabled() -> bool:
    """Production refuses CV upload tickets without a private CV bucket (ADR-041)."""
    return bool(settings.CAREERS_CV_STORAGE_ENABLED)


def public_base_url() -> str:
    return settings.CONTENT_MEDIA_PUBLIC_BASE_URL or f"{settings.APP_BASE_URL}/media"


def public_url(key: str) -> str:
    return f"{public_base_url()}/{key}" if key else ""


def store_image(data: bytes, *, purpose: str, alt: str = "", user=None) -> MediaAsset:
    """Validate and store an image under a random key; returns its MediaAsset (with dimensions)."""
    if not media_enabled():
        raise ValidationError("Image uploads need object storage (CONTENT_MEDIA_BUCKET is not set).")
    info = inspect_image(data)
    key = f"content/{uuid.uuid4()}.{EXTENSIONS[info.content_type]}"
    saved = storages["content_media"].save(key, ContentFile(data))
    return MediaAsset.objects.create(
        key=saved,
        content_type=info.content_type,
        size=len(data),
        width=info.width,
        height=info.height,
        purpose=purpose,
        alt=alt[:300],
        uploaded_by=user if getattr(user, "is_authenticated", False) else None,
    )


def read_upload(uploaded) -> bytes:
    """Read an UploadedFile up to the limit (one byte more tells us it is too large)."""
    data = uploaded.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise ValidationError("Images must be 5 MB or smaller.")
    return data
