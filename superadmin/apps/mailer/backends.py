"""Django email backends selected by EMAIL_TRANSPORT.

- ``log`` (default, dev and test): nothing leaves the process. Each message is written to the log
  (headers and size, never the body) so threading can be checked without sending anything.
- ``resend``: Resend's HTTPS API. Only enabled when a human sets EMAIL_TRANSPORT=resend and the
  sending domain is verified (docs/email-setup.md).

After a send, each message carries ``provider_message_id`` (Resend's id, or a log id).
"""

import base64
import json
import logging
import urllib.error
import urllib.request
import uuid
from email.message import MIMEPart

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger("superadmin.mail")

# Headers we pass through to the provider; anything else set on a message is dropped.
FORWARDED_HEADERS = (
    "Message-ID",
    "In-Reply-To",
    "References",
    "Auto-Submitted",
    "X-Auto-Response-Suppress",
    # Names the platform's own system emails, so inbound ingestion recognises them (ADR-046).
    "X-Vitalos-Notification",
    "X-Vitalos-Reference",
    # One-click unsubscribe for marketing and outreach email (RFC 8058).
    "List-Unsubscribe",
    "List-Unsubscribe-Post",
)


def _headers(message) -> dict[str, str]:
    extra = {key.lower(): value for key, value in (message.extra_headers or {}).items()}
    return {name: extra[name.lower()] for name in FORWARDED_HEADERS if name.lower() in extra}


def _html_part(message) -> str | None:
    for content, mimetype in getattr(message, "alternatives", []) or []:
        if mimetype == "text/html":
            return content
    return None


class LogEmailBackend(BaseEmailBackend):
    """Development and test transport: records that a message would have been sent."""

    def send_messages(self, email_messages):
        for message in email_messages:
            message.provider_message_id = f"log-{uuid.uuid4().hex}"
            logger.info(
                "Email not sent (EMAIL_TRANSPORT=log)",
                extra={
                    "to": list(message.to),
                    "subject": message.subject,
                    "headers": _headers(message),
                    "bytes": len(message.body or ""),
                    "provider_message_id": message.provider_message_id,
                },
            )
        return len(email_messages)


class ResendEmailBackend(BaseEmailBackend):
    """Send through Resend (https://resend.com/docs/api-reference/emails/send-email)."""

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.api_key = settings.RESEND_API_KEY
        self.api_url = settings.RESEND_API_URL
        self.timeout = 15

    def _payload(self, message) -> dict:
        payload = {
            "from": message.from_email or settings.DEFAULT_FROM_EMAIL,
            "to": list(message.to),
            "subject": message.subject,
            "text": message.body,
        }
        html = _html_part(message)
        if html:
            payload["html"] = html
        if message.cc:
            payload["cc"] = list(message.cc)
        if message.reply_to:
            payload["reply_to"] = list(message.reply_to)
        headers = _headers(message)
        if headers:
            payload["headers"] = headers
        attachments = []
        for attachment in message.attachments or []:
            if isinstance(attachment, MIMEPart):
                # An inline image (apps.mailer.messages): Resend references it by content id.
                item = {
                    "filename": attachment.get_filename() or "attachment",
                    "content": base64.b64encode(attachment.get_payload(decode=True) or b"").decode(),
                    "content_type": attachment.get_content_type(),
                }
                content_id = (attachment.get("Content-ID") or "").strip("<>")
                if content_id:
                    item["content_id"] = content_id
                attachments.append(item)
                continue
            filename, content, _mimetype = attachment
            raw = content if isinstance(content, bytes) else str(content).encode()
            attachments.append({"filename": filename, "content": base64.b64encode(raw).decode()})
        if attachments:
            payload["attachments"] = attachments
        return payload

    def send_messages(self, email_messages):
        if not self.api_key:
            if self.fail_silently:
                return 0
            raise RuntimeError("EMAIL_TRANSPORT=resend needs RESEND_API_KEY.")
        sent = 0
        for message in email_messages:
            request = urllib.request.Request(  # noqa: S310 - fixed https URL from settings
                self.api_url,
                data=json.dumps(self._payload(message)).encode(),
                method="POST",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "vitalos-superadmin/1.0",
                    # Resend de-duplicates retries of the same message for 24 hours.
                    "Idempotency-Key": _headers(message).get("Message-ID", uuid.uuid4().hex)[:256],
                },
            )
            try:
                with urllib.request.urlopen(request, timeout=self.timeout) as response:  # noqa: S310  # nosec B310
                    body = json.loads(response.read() or b"{}")
            except (urllib.error.URLError, TimeoutError, ValueError) as exc:
                logger.warning("Resend send failed", extra={"error": str(exc)[:200], "to": list(message.to)})
                if not self.fail_silently:
                    raise
                continue
            message.provider_message_id = str(body.get("id", ""))
            sent += 1
        return sent
