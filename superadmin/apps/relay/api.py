"""POST /api/inbound/relay: signed alert events from the website (docs/relay/API.md, "Webhook").

No session and no CSRF: the request is authenticated by an HMAC-SHA256 signature over the canonical
string (signing.py) with RELAY_WEBHOOK_SECRET, within 300 seconds, compared in constant time. A repeated
event id is acknowledged and ignored. Bodies are never logged. With Relay not configured the endpoint
does not exist (404); with no secret it refuses everything (503).
"""

import json
import logging
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.http import Http404, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.enquiries.providers import BodyTooLarge, read_body

from . import alerts, signing
from .client import is_configured
from .models import RelayInboundEvent

logger = logging.getLogger(__name__)

MAX_BODY_BYTES = 64 * 1024


def _error(code: str, message: str, status: int) -> JsonResponse:
    return JsonResponse({"error": {"code": code, "message": message}}, status=status)


@csrf_exempt
@require_POST
def inbound(request):
    if not is_configured():
        raise Http404
    if not settings.RELAY_WEBHOOK_SECRET:
        return _error("disabled", "Relay webhook secret is not configured", 503)
    try:
        body = read_body(request, MAX_BODY_BYTES)
    except BodyTooLarge:
        return _error("invalid", "Payload too large", 413)
    failure = signing.verify(
        settings.RELAY_WEBHOOK_SECRET,
        timestamp=request.headers.get("X-Relay-Timestamp", ""),
        signature=request.headers.get("X-Relay-Signature", ""),
        method=request.method,
        path_with_query=request.get_full_path(),
        admin_header="",
        body=body,
    )
    if failure:
        logger.warning("Relay webhook rejected", extra={"reason": failure})
        return _error(
            failure, "Signature rejected" if failure == "bad_signature" else "Timestamp too old", 401
        )
    try:
        payload = json.loads(body or b"{}")
        event_id = uuid.UUID(str(payload.get("id")))
        event_type = str(payload.get("type") or "")[:40]
    except (ValueError, AttributeError, TypeError):
        return _error("invalid", "Expected {id, type, at, counts, data}", 400)
    if not event_type:
        return _error("invalid", "Expected {id, type, at, counts, data}", 400)
    try:
        with transaction.atomic():
            RelayInboundEvent.objects.create(id=event_id, type=event_type)
    except IntegrityError:
        return JsonResponse({"ok": True, "duplicate": True})
    alerts.update_counts(payload.get("counts"))
    try:
        outcome = alerts.handle(event_type, payload.get("data") or {})
    except Exception:  # noqa: BLE001 - acknowledged; a retry would only repeat the same failure
        logger.exception("Relay webhook processing failed", extra={"type": event_type})
        return JsonResponse({"ok": True})
    logger.info(
        "Relay webhook",
        extra={
            "type": event_type,
            "in_app": outcome.in_app,
            "emails": outcome.emails,
            "skipped": outcome.skipped,
        },
    )
    return JsonResponse({"ok": True})
