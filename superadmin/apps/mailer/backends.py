"""Django email backends selected by EMAIL_TRANSPORT.

- ``log`` (default, dev and test): nothing leaves the process. Each message is written to the log
  (headers and size, never the body) so threading can be checked without sending anything.
- ``resend``: Resend's HTTPS API. Only enabled when a human sets EMAIL_TRANSPORT=resend and the
  sending domain is verified (docs/email-setup.md).

Outreach (cold) email never uses either: it goes through ``outreach_connection()``, a Microsoft 365
mailbox over Microsoft Graph (preferred) or any mailbox over SMTP (ADR-051).

After a send, each message carries ``provider_message_id`` (Resend's id, or a log id).
"""

import base64
import json
import logging
import urllib.error
import urllib.parse
import urllib.request
import uuid
from email.message import MIMEPart

from django.conf import settings
from django.core.cache import cache
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


def outreach_mailbox() -> str:
    """The address outreach is sent from (and replies go to)."""
    return settings.OUTREACH_MAILBOX or settings.OUTREACH_SMTP_USER


def outreach_connection():
    """A connection to the outreach mailbox, or None when none is set up.

    Microsoft Graph when OUTREACH_GRAPH_* and OUTREACH_MAILBOX are set (Microsoft 365, app-only OAuth, no
    password), otherwise SMTP with TLS when OUTREACH_SMTP_* are set. Outreach (cold) email never goes
    through Resend, whose acceptable use policy forbids it.
    """
    if (
        settings.OUTREACH_GRAPH_TENANT_ID
        and settings.OUTREACH_GRAPH_CLIENT_ID
        and settings.OUTREACH_GRAPH_CLIENT_SECRET
        and settings.OUTREACH_MAILBOX
    ):
        return GraphEmailBackend(
            tenant_id=settings.OUTREACH_GRAPH_TENANT_ID,
            client_id=settings.OUTREACH_GRAPH_CLIENT_ID,
            client_secret=settings.OUTREACH_GRAPH_CLIENT_SECRET,
            mailbox=settings.OUTREACH_MAILBOX,
        )
    if not (settings.OUTREACH_SMTP_HOST and settings.OUTREACH_SMTP_USER):
        return None
    from django.core.mail.backends.smtp import EmailBackend as SMTPBackend

    port = settings.OUTREACH_SMTP_PORT
    return SMTPBackend(
        host=settings.OUTREACH_SMTP_HOST,
        port=port,
        username=settings.OUTREACH_SMTP_USER,
        password=settings.OUTREACH_SMTP_PASSWORD,
        use_ssl=port == 465,
        use_tls=port != 465,
        timeout=20,
        fail_silently=False,
    )


GRAPH_SIGN_IN_URL = "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token"
GRAPH_SEND_URL = "https://graph.microsoft.com/v1.0/users/{mailbox}/sendMail"


class GraphError(RuntimeError):
    """Microsoft refused a token or a send. The message holds the status and error code, never a secret."""


class GraphEmailBackend(BaseEmailBackend):
    """Send as one Microsoft 365 mailbox through Microsoft Graph (outreach only, ADR-051).

    App-only OAuth 2.0 (client credentials): an Entra app granted Mail.Send in Exchange (RBAC for
    Applications), limited to the one mailbox. The access token is cached until shortly before it expires. Each message
    goes as base64 MIME, so List-Unsubscribe, the Message-ID and the inline images arrive as built; Exchange
    keeps a copy in the mailbox's Sent Items.
    """

    def __init__(self, *, tenant_id, client_id, client_secret, mailbox, timeout=20):
        super().__init__()
        self.tenant_id, self.client_id, self.client_secret = tenant_id, client_id, client_secret
        self.mailbox, self.timeout = mailbox, timeout
        self.cache_key = f"mailer:graph-token:{tenant_id}:{client_id}"

    def _post(self, url: str, data: bytes, headers: dict[str, str]) -> tuple[int, bytes]:
        request = urllib.request.Request(url, data=data, method="POST", headers=headers)  # noqa: S310
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:  # noqa: S310  # nosec B310
                return response.status, response.read()
        except urllib.error.HTTPError as exc:
            return exc.code, exc.read() or b""

    @staticmethod
    def _error(body: bytes) -> str:
        try:
            data = json.loads(body or b"{}")
        except ValueError:
            return ""
        error = data.get("error")
        return str(error.get("code", "") if isinstance(error, dict) else error or "")[:80]

    def _token(self) -> str:
        token = cache.get(self.cache_key)
        if token:
            return token
        form = urllib.parse.urlencode(
            {
                "grant_type": "client_credentials",
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
            }
        ).encode()
        status, body = self._post(
            GRAPH_SIGN_IN_URL.format(tenant=urllib.parse.quote(self.tenant_id, safe="")),
            form,
            {"Content-Type": "application/x-www-form-urlencoded"},
        )
        try:
            data = json.loads(body or b"{}") if status == 200 else {}
        except ValueError:
            data = {}
        token = data.get("access_token", "")
        if not token:
            raise GraphError(f"Microsoft sign-in refused the outreach app ({status} {self._error(body)}).")
        cache.set(self.cache_key, token, max(int(data.get("expires_in", 3600)) - 300, 60))
        return token

    def send_messages(self, email_messages):
        sent = 0
        url = GRAPH_SEND_URL.format(mailbox=urllib.parse.quote(self.mailbox, safe="@"))
        for message in email_messages:
            mime = base64.b64encode(message.message().as_bytes())
            headers = {"Authorization": f"Bearer {self._token()}", "Content-Type": "text/plain"}
            status, body = self._post(url, mime, headers)
            if status == 401:  # the cached token was revoked or expired early: sign in again once
                cache.delete(self.cache_key)
                headers["Authorization"] = f"Bearer {self._token()}"
                status, body = self._post(url, mime, headers)
            if status != 202:  # always raised: outreach records the failure on the contact
                logger.warning("Graph send failed", extra={"status": status, "error": self._error(body)})
                raise GraphError(f"Microsoft did not accept the email ({status} {self._error(body)}).")
            message.provider_message_id = f"graph-{uuid.uuid4().hex}"
            sent += 1
        return sent


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
