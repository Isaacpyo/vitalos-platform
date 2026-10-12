"""Machine-to-machine endpoints for enquiries: inbound email, the website form and Resend events.

No session authentication and no CSRF: each request is authenticated by an HMAC signature over the
raw body, and every endpoint fails closed (503) when its secret is not configured. Bodies are never
logged.
"""

import email.errors
import ipaddress
import json
import logging
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from . import providers, services
from .models import EnquiryNote, InboxSettings, Message

logger = logging.getLogger(__name__)

MAX_FORM_BYTES = 64 * 1024
FIELD_LIMITS = {"name": 200, "email": 254, "company": 200, "message": services.WEB_FORM_MAX_MESSAGE}
TURNSTILE_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
SAFE_ERRORS = {"Message larger than 25 MiB", "Message has no sender address"}
DELIVERY_EVENTS = {
    "email.delivered": "delivered",
    "email.bounced": "bounced",
    "email.complained": "complained",
    "email.delivery_delayed": "delayed",
}


def _error(message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": message}, status=status)


def _record_inbound_error(text: str) -> None:
    InboxSettings.load()
    InboxSettings.objects.filter(pk=1).update(
        last_inbound_error=text[:300], last_inbound_error_at=timezone.now()
    )


def _verify_hmac(request, limit: int):
    """Returns (body, None) or (None, error response)."""
    if not settings.INBOUND_WEBHOOK_SECRET:
        return None, _error("Inbound webhook secret is not configured", 503)
    try:
        body = providers.read_body(request, limit)
    except providers.BodyTooLarge:
        return None, _error("Payload too large", 413)
    valid = providers.verify_hmac(
        settings.INBOUND_WEBHOOK_SECRET,
        request.headers.get("X-Vitalos-Timestamp", ""),
        request.headers.get("X-Vitalos-Signature", ""),
        body,
    )
    if not valid:
        return None, _error("Invalid signature", 401)
    return body, None


@csrf_exempt
@require_POST
def inbound_email(request):
    """Raw MIME (message/rfc822) from the Cloudflare Email Worker."""
    raw, failure = _verify_hmac(request, providers.MAX_INBOUND_BYTES)
    if failure is not None:
        return failure
    envelope_to = request.headers.get("X-Vitalos-Envelope-To", "").strip()[:254]
    try:
        message, created = providers.CloudflareWorkerInbound().ingest(raw, envelope_to=envelope_to)
    except (ValueError, TypeError, LookupError, email.errors.MessageError) as exc:
        reason = (
            str(exc) if str(exc) in SAFE_ERRORS else f"Could not parse the message ({type(exc).__name__})"
        )
        _record_inbound_error(reason)
        logger.warning("Inbound email rejected", extra={"reason": reason})
        return _error(reason, 400)
    ref = message.enquiry.ref if message is not None else ""
    logger.info("Inbound email", extra={"ref": ref, "stored": created})
    return JsonResponse({"status": "stored" if created else "duplicate", "ref": ref})


def _turnstile_ok(token: str, ip: str) -> bool:
    if not settings.TURNSTILE_SECRET_KEY:
        return True  # Turnstile is not configured yet; the HMAC signature still authenticates the site.
    if not token:
        return False
    fields = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if ip:
        fields["remoteip"] = ip
    request = urllib.request.Request(  # noqa: S310 - fixed https URL
        TURNSTILE_URL,
        data=urllib.parse.urlencode(fields).encode(),
        method="POST",
        headers={"User-Agent": providers.USER_AGENT},
    )
    try:
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310  # nosec B310
            return bool(json.loads(response.read(65536) or b"{}").get("success"))
    except (urllib.error.URLError, TimeoutError, ValueError, OSError) as exc:
        logger.warning("Turnstile verification failed", extra={"error": type(exc).__name__})
        return False


def _client_ip(value) -> str:
    try:
        return str(ipaddress.ip_address(str(value or "").strip()))
    except ValueError:
        return ""


@csrf_exempt
@require_POST
def inbound_web_form(request):
    """The website contact form, relayed by the website server and signed like inbound email."""
    body, failure = _verify_hmac(request, MAX_FORM_BYTES)
    if failure is not None:
        return failure
    try:
        data = json.loads(body or b"{}")
    except ValueError:
        return _error("Invalid JSON", 400)
    if not isinstance(data, dict):
        return _error("Invalid JSON", 400)
    if str(data.get("website") or "").strip():
        return JsonResponse({"status": "ok"})  # Honeypot filled: pretend success, store nothing.
    fields = {key: str(data.get(key) or "") for key in FIELD_LIMITS}
    errors = {
        key: f"Must be {limit} characters or fewer."
        for key, limit in FIELD_LIMITS.items()
        if len(fields[key]) > limit
    }
    if errors:
        return JsonResponse({"errors": errors}, status=400)
    ip = _client_ip(data.get("client_ip"))
    if not _turnstile_ok(str(data.get("turnstile_token") or ""), ip):
        return _error("Verification failed", 400)
    try:
        enquiry = services.create_web_form_enquiry(
            name=fields["name"],
            email=fields["email"],
            company=fields["company"],
            message=fields["message"],
            ip=ip,
        )
    except ValidationError as exc:
        detail = exc.message_dict if hasattr(exc, "error_dict") else {"email": "Enter a valid email address."}
        return JsonResponse({"errors": detail}, status=400)
    if enquiry is None:
        return JsonResponse({"status": "ok"})  # Over the hourly limit: accepted, not stored.
    return JsonResponse({"ref": enquiry.ref}, status=201)


def _delivery_event(event_type: str, data: dict) -> None:
    provider_id = str(data.get("email_id") or "")
    status = DELIVERY_EVENTS[event_type]
    if not provider_id:
        return
    for message in Message.objects.filter(provider_message_id=provider_id).select_related("enquiry"):
        if message.delivery_status == status:
            continue  # Svix retries the same event; record it once.
        message.delivery_status = status
        message.save(update_fields=["delivery_status"])
        if status in ("bounced", "complained"):
            text = (
                "Delivery failure: the customer's mail server bounced our reply."
                if status == "bounced"
                else "The customer marked our reply as spam. Do not email them again without a new request."
            )
            EnquiryNote.objects.create(enquiry=message.enquiry, body=text, is_system=True)


@csrf_exempt
@require_POST
def resend_webhook(request):
    """Resend events (Svix-signed): delivery status for our replies, and Resend Inbound mail."""
    if not settings.RESEND_WEBHOOK_SECRET:
        return _error("Resend webhook secret is not configured", 503)
    provider = providers.ResendInbound()
    try:
        if not provider.verify_webhook(request):
            return _error("Invalid signature", 401)
        body = providers.read_body(request, providers.MAX_WEBHOOK_BYTES)
    except providers.BodyTooLarge:
        return _error("Payload too large", 413)
    try:
        payload = json.loads(body or b"{}")
    except ValueError:
        return _error("Invalid JSON", 400)
    event_type = str(payload.get("type") or "")
    data = payload.get("data") or {}
    if event_type in DELIVERY_EVENTS:
        _delivery_event(event_type, data)
        return JsonResponse({"status": "ok"})
    if event_type == "email.received":
        if not provider.active():
            return JsonResponse({"status": "ignored"})
        try:
            raw = provider.fetch_raw(str(data.get("email_id") or ""))
            message, created = provider.ingest(raw)
        except (
            ValueError,
            TypeError,
            LookupError,
            email.errors.MessageError,
            urllib.error.URLError,
            RuntimeError,
        ) as exc:
            reason = str(exc) if str(exc) in SAFE_ERRORS else f"Resend inbound failed ({type(exc).__name__})"
            _record_inbound_error(reason)
            logger.warning("Resend inbound rejected", extra={"reason": reason})
            return _error(reason, 400 if not isinstance(exc, urllib.error.URLError | RuntimeError) else 502)
        ref = message.enquiry.ref if message is not None else ""
        return JsonResponse({"status": "stored" if created else "duplicate", "ref": ref})
    return JsonResponse({"status": "ignored"})
