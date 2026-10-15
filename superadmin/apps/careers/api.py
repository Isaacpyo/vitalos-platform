"""Careers intake endpoints under /api/careers/v1/ (amendment A9; contract: openapi.yaml).

``upload-tickets`` and ``applications`` are called by the website server, signed with scope ``submit``
(``CAREERS_SUBMIT_CLIENT_KEYS``). ``uploads/{id}`` is the browser's fallback upload target when there is
no CV bucket: unsigned, the ``token`` query parameter is the single-use capability, and CORS allows only
the website origins from ``CONTENT_WEB_TARGETS``. Bodies and candidate data are never logged.
"""

import json
import logging
import uuid
from urllib.parse import urlsplit

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.content_sync import signing
from apps.enquiries import providers

from . import intake

logger = logging.getLogger(__name__)

MAX_JSON = 16 * 1024
# The applicant's IP, added by the website to its signed upload-ticket request (the contract's ticket
# body has no clientIp). It is not part of the canonical string, but only the website holds a submit
# key, so the header is trusted like the rest of that request. It is only ever hashed.
CLIENT_IP_HEADER = "X-Vitalos-Client-Ip"


def _json(data, status: int) -> JsonResponse:
    response = JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False})
    response["Cache-Control"] = "no-store"
    response["X-Robots-Tag"] = "noindex"
    return response


def _error(message: str, status: int) -> JsonResponse:
    return _json({"error": message}, status)


def _signed_json(request):
    """(data, None) or (None, error response) for a signed submit-scope POST."""
    if request.method != "POST":
        response = _error("Method not allowed", 405)
        response["Allow"] = "POST"
        return None, response
    if not signing.keys_for("submit"):
        return None, _error("Not configured", 503)
    try:
        body = providers.read_body(request, MAX_JSON)
    except providers.BodyTooLarge:
        return None, _error("Payload too large", 413)
    try:
        signing.verify_request(request, "submit", body)
    except signing.NotConfigured:
        return None, _error("Not configured", 503)
    except signing.InvalidSignature as exc:
        logger.info("Careers API signature refused", extra={"reason": str(exc), "path": request.path})
        return None, _error("Invalid signature", 401)
    try:
        data = json.loads(body or b"{}")
    except ValueError:
        return None, _json({"errors": {"body": "invalid"}}, 400)
    if not isinstance(data, dict):
        return None, _json({"errors": {"body": "invalid"}}, 400)
    return data, None


@csrf_exempt
def upload_tickets(request):
    data, failure = _signed_json(request)
    if failure is not None:
        return failure
    try:
        return _json(
            intake.create_ticket(data, client_ip=request.headers.get(CLIENT_IP_HEADER, "")[:45]), 201
        )
    except intake.IntakeError as exc:
        return _json({"errors": exc.errors}, exc.status)


@csrf_exempt
def applications(request):
    data, failure = _signed_json(request)
    if failure is not None:
        return failure
    try:
        accepted = intake.submit(data)
    except intake.IntakeError as exc:
        return _json({"errors": exc.errors}, exc.status)
    return _json(accepted.payload(), 201 if accepted.created else 200)


# --- Fallback upload target ----------------------------------------------------------------------


def allowed_origins() -> set[str]:
    origins = set()
    for target in settings.CONTENT_WEB_TARGETS:
        parts = urlsplit(target)
        if parts.scheme and parts.netloc:
            origins.add(f"{parts.scheme}://{parts.netloc}")
    return origins


def _cors(response: HttpResponse, origin: str) -> HttpResponse:
    response["Vary"] = "Origin"
    if origin and origin in allowed_origins():
        response["Access-Control-Allow-Origin"] = origin
        response["Access-Control-Allow-Methods"] = "PUT, OPTIONS"
        response["Access-Control-Allow-Headers"] = "Content-Type"
        response["Access-Control-Max-Age"] = "600"
    response["Cache-Control"] = "no-store"
    return response


@csrf_exempt
def upload(request, upload_id):
    origin = request.headers.get("Origin", "")
    if origin and origin not in allowed_origins():
        return _cors(_error("Origin not allowed", 403), origin)
    if request.method == "OPTIONS":
        return _cors(HttpResponse(status=204), origin)
    if request.method != "PUT":
        response = _error("Method not allowed", 405)
        response["Allow"] = "PUT, OPTIONS"
        return _cors(response, origin)
    try:
        ticket_id = uuid.UUID(str(upload_id))
        ticket = intake.check_upload_request(
            ticket_id,
            request.GET.get("token", "")[:200],
            request.headers.get("Content-Type", ""),
            request.META.get("CONTENT_LENGTH") or "",
        )
        try:
            data = providers.read_body(request, min(intake.FALLBACK_LIMIT, ticket.size))
        except providers.BodyTooLarge:
            raise intake.UploadRefused(413, "Too large") from None
        intake.store_upload(ticket, data)
    except ValueError:
        return _cors(_error("Not found", 400), origin)
    except intake.UploadRefused as exc:
        return _cors(_error(exc.message, exc.status), origin)
    return _cors(HttpResponse(status=204), origin)
