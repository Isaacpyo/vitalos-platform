"""Public billing endpoints: the vitalos.co.uk/pay form target and the Stripe webhook.

No session and no CSRF token: ``/pay/checkout/`` is a plain cross-origin HTML form post from the
website (protected by the payment code, Turnstile, a honeypot and rate limits) and always answers
303, either to Stripe Checkout or back to the website's /pay page with an error code. The webhook is
authenticated by Stripe's signature and fails closed (503) without a secret. Bodies are never logged.
"""

import json
import logging

from django.conf import settings
from django.http import HttpResponseRedirect, JsonResponse
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.core.http import client_ip
from apps.enquiries.api import _turnstile_ok

from . import selectors, services, stripe_client

logger = logging.getLogger(__name__)

MAX_WEBHOOK_BYTES = 512 * 1024


class _SeeOther(HttpResponseRedirect):
    status_code = 303
    # The Location is either our configured site or a checkout.stripe.com URL (checked before use).
    allowed_schemes = ["https", "http"]


def _refuse(code: str, number: str) -> _SeeOther:
    response = _SeeOther(services.pay_page_url(number, error=code))
    response["Cache-Control"] = "no-store"
    return response


@csrf_exempt
@never_cache
@require_POST
def pay_checkout(request):
    """POST invoice, code, cf-turnstile-response (or turnstileToken), website (honeypot) → 303."""
    number = selectors.normalise_number(request.POST.get("invoice", ""))
    if str(request.POST.get("website") or "").strip():
        return _refuse("not-found", number)  # Honeypot filled: look like a miss, store nothing.
    ip = client_ip(request)
    try:
        services.check_ip_limit(ip)
        token = str(request.POST.get("cf-turnstile-response") or request.POST.get("turnstileToken") or "")
        if settings.TURNSTILE_SECRET_KEY and not _turnstile_ok(token[:2048], ip):
            raise services.CheckoutRefused("verification")
        services.check_invoice_limit(number)
        code = services.normalise_code(request.POST.get("code", ""))
        url = services.start_public_checkout(number, code)
    except services.CheckoutRefused as refusal:
        return _refuse(refusal.code, number)
    if not services.is_stripe_checkout_url(url):  # Defence in depth: never an open redirect.
        return _refuse("unavailable", number)
    response = _SeeOther(url)
    response["Cache-Control"] = "no-store"
    return response


@csrf_exempt
@require_POST
def stripe_webhook(request):
    secret = settings.BILLING_STRIPE_WEBHOOK_SECRET
    if not secret:
        return JsonResponse({"error": "Stripe webhook secret is not configured"}, status=503)
    try:
        length = int(request.META.get("CONTENT_LENGTH") or 0)
    except ValueError:
        length = 0
    if length > MAX_WEBHOOK_BYTES:
        return JsonResponse({"error": "Payload too large"}, status=413)
    body = request.body
    if len(body) > MAX_WEBHOOK_BYTES:
        return JsonResponse({"error": "Payload too large"}, status=413)
    if not stripe_client.verify_signature(body, request.headers.get("Stripe-Signature", ""), secret):
        return JsonResponse({"error": "Invalid signature"}, status=400)
    try:
        event = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    if not isinstance(event, dict):
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    outcome = services.handle_webhook_event(event)
    logger.info("Stripe webhook", extra={"event_type": str(event.get("type") or "")[:80], "outcome": outcome})
    return JsonResponse({"status": outcome})
