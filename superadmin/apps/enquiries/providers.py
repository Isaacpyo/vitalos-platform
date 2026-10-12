"""Mail provider adapters. Business rules stay in ingest.py and services.py; these only move bytes.

- CloudflareWorkerInbound: a Cloudflare Email Worker POSTs the raw MIME, signed with HMAC-SHA256.
- ResendInbound: Resend Inbound webhooks (Svix-signed), used only when INBOUND_PROVIDER=resend.
- ResendOutbound: sending through the Django mail backend selected by EMAIL_TRANSPORT.
- MicrosoftGraphProvider: placeholder for a future Microsoft 365 mailbox integration.
"""

import base64
import binascii
import hashlib
import hmac
import json
import time
import urllib.error
import urllib.request
from typing import Protocol

from django.conf import settings

from . import ingest as ingest_module
from .models import Message

SIGNATURE_TOLERANCE_SECONDS = 300
MAX_INBOUND_BYTES = ingest_module.MAX_RAW_BYTES
MAX_WEBHOOK_BYTES = 1024 * 1024
RESEND_RECEIVING_URL = "https://api.resend.com/emails/receiving/{email_id}"
USER_AGENT = "vitalos-superadmin/1.0"
HTTP_TIMEOUT = 15


class BodyTooLarge(Exception):
    pass


def read_body(request, limit: int) -> bytes:
    """Read the request body once, without Django's DATA_UPLOAD_MAX_MEMORY_SIZE cap, up to ``limit``.

    Cached on the request so verification and processing see the same bytes.
    """
    cached = getattr(request, "_vitalos_raw_body", None)
    if cached is not None:
        return cached
    declared = request.META.get("CONTENT_LENGTH") or "0"
    if declared.isdigit() and int(declared) > limit:
        raise BodyTooLarge
    raw = request.read(limit + 1)
    if len(raw) > limit:
        raise BodyTooLarge
    request._vitalos_raw_body = raw
    return raw


def sign(secret: str, timestamp: str, body: bytes) -> str:
    """Lowercase hex HMAC-SHA256 over ``"{timestamp}." + body`` (shared with the Cloudflare Worker)."""
    return hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()


def verify_hmac(secret: str, timestamp: str, signature: str, body: bytes, now: float | None = None) -> bool:
    if not secret or not timestamp or not signature:
        return False
    try:
        sent_at = int(timestamp)
    except ValueError:
        return False
    if abs((now if now is not None else time.time()) - sent_at) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    return hmac.compare_digest(sign(secret, timestamp, body), signature.strip().lower())


def svix_signature(secret: str, msg_id: str, timestamp: str, body: bytes) -> str:
    key = base64.b64decode(secret.removeprefix("whsec_"))
    signed = f"{msg_id}.{timestamp}.".encode() + body
    return base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()


def verify_svix(
    secret: str, msg_id: str, timestamp: str, signature_header: str, body: bytes, now: float | None = None
) -> bool:
    """Svix webhook verification (used by Resend): ``v1,<base64>`` entries, 5-minute tolerance."""
    if not secret or not msg_id or not timestamp or not signature_header:
        return False
    try:
        sent_at = int(timestamp)
        expected = svix_signature(secret, msg_id, timestamp, body)
    except (ValueError, binascii.Error):
        return False
    if abs((now if now is not None else time.time()) - sent_at) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    for entry in signature_header.split():
        version, _, value = entry.partition(",")
        if version == "v1" and hmac.compare_digest(value.encode(), expected.encode()):
            return True
    return False


def _http_get(url: str, *, headers=None, limit: int) -> bytes:
    if not url.startswith("https://"):
        raise ValueError("Only https URLs are fetched")
    request = urllib.request.Request(  # noqa: S310 - https only, checked above
        url, headers={"User-Agent": USER_AGENT, **(headers or {})}
    )
    with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT) as response:  # noqa: S310  # nosec B310
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Download larger than the limit")
    return data


class MailProvider(Protocol):
    name: str

    def verify_webhook(self, request) -> bool: ...

    def ingest(self, raw: bytes) -> tuple[Message | None, bool]: ...

    def send(self, message) -> int: ...


class CloudflareWorkerInbound:
    """Raw MIME from a Cloudflare Email Worker, signed with INBOUND_WEBHOOK_SECRET."""

    name = "cloudflare"

    def verify_webhook(self, request) -> bool:
        body = read_body(request, MAX_INBOUND_BYTES)
        return verify_hmac(
            settings.INBOUND_WEBHOOK_SECRET,
            request.headers.get("X-Vitalos-Timestamp", ""),
            request.headers.get("X-Vitalos-Signature", ""),
            body,
        )

    def ingest(self, raw: bytes, *, envelope_to: str = "") -> tuple[Message | None, bool]:
        return ingest_module.ingest(raw, provider=self.name, envelope_to=envelope_to)

    def send(self, message) -> int:
        raise NotImplementedError("The Cloudflare Email Worker only receives mail.")


class ResendInbound:
    """Resend Inbound: an ``email.received`` webhook, then fetch the raw MIME from the Resend API."""

    name = "resend"

    @staticmethod
    def active() -> bool:
        return settings.INBOUND_PROVIDER == "resend"

    def verify_webhook(self, request) -> bool:
        body = read_body(request, MAX_WEBHOOK_BYTES)
        return verify_svix(
            settings.RESEND_WEBHOOK_SECRET,
            request.headers.get("svix-id", ""),
            request.headers.get("svix-timestamp", ""),
            request.headers.get("svix-signature", ""),
            body,
        )

    def fetch_raw(self, email_id: str) -> bytes:
        if not settings.RESEND_API_KEY:
            raise RuntimeError("RESEND_API_KEY is not set")
        if not email_id or not all(ch.isalnum() or ch in "-_" for ch in email_id):
            raise ValueError("Invalid Resend email id")
        details = json.loads(
            _http_get(
                RESEND_RECEIVING_URL.format(email_id=email_id),
                headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                limit=MAX_WEBHOOK_BYTES,
            )
        )
        download_url = ((details or {}).get("raw") or {}).get("download_url", "")
        return _http_get(download_url, limit=MAX_INBOUND_BYTES)

    def ingest(self, raw: bytes) -> tuple[Message | None, bool]:
        if not self.active():
            raise RuntimeError("Resend Inbound is not the active inbound provider")
        return ingest_module.ingest(raw, provider=self.name)

    def send(self, message) -> int:
        return ResendOutbound().send(message)


class ResendOutbound:
    """Sending goes through Django's mail API; EMAIL_TRANSPORT picks the log or Resend backend."""

    name = "resend"

    def verify_webhook(self, request) -> bool:
        return ResendInbound().verify_webhook(request)

    def ingest(self, raw: bytes) -> tuple[Message | None, bool]:
        raise NotImplementedError("ResendOutbound only sends; inbound mail uses ResendInbound.")

    def send(self, message) -> int:
        return message.send(fail_silently=False)


class MicrosoftGraphProvider:
    """Future: a Microsoft 365 shared mailbox through Microsoft Graph. Not implemented.

    TODO(graph): subscribe to change notifications on /users/{mailbox}/mailFolders('inbox')/messages,
    validate the clientState and validationToken handshake, and renew the subscription daily (mail
    subscriptions expire after about three days).
    TODO(graph): fetch new messages as MIME via /messages/{id}/$value and pass them to ingest.ingest.
    TODO(graph): send with /users/{mailbox}/sendMail, or /messages/{id}/reply to keep Outlook threading.
    """

    name = "microsoft_graph"

    def verify_webhook(self, request) -> bool:
        raise NotImplementedError("Microsoft Graph is not implemented yet.")

    def ingest(self, raw: bytes) -> tuple[Message | None, bool]:
        raise NotImplementedError("Microsoft Graph is not implemented yet.")

    def send(self, message) -> int:
        raise NotImplementedError("Microsoft Graph is not implemented yet.")
