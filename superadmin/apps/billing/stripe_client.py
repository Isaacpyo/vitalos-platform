"""A small Stripe REST client on the standard library (no SDK), plus webhook signature checks.

Only the calls billing needs: Prices, Payment Links, Checkout Sessions. Requests are form-encoded
with bracket keys (``line_items[0][price_data][currency]=gbp``), carry a pinned ``Stripe-Version`` and,
on creates, an ``Idempotency-Key``. Redirects are refused and every request has a timeout.

The secret key is held only on the client instance: it is never logged, never shown by ``repr`` and
never put in an exception message (errors carry the HTTP status and Stripe's error type and code only).
"""

import hashlib
import hmac
import http.client
import json
import logging
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Mapping
from urllib.parse import urlsplit

from django.conf import settings

logger = logging.getLogger(__name__)

API_BASE = "https://api.stripe.com"
#: Pinned so a Stripe default-version change on the account cannot alter responses under us.
STRIPE_VERSION = "2024-06-20"
TIMEOUT_S = 15
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
USER_AGENT = "VitalosSuperAdmin-Billing/1.0"
SIGNATURE_TOLERANCE_S = 300


class StripeError(Exception):
    """Base error. ``str()`` is safe to show and log: it never contains the key or request bodies."""

    def __init__(self, message: str, *, status: int | None = None, code: str = ""):
        super().__init__(message)
        self.status = status
        self.code = code


class StripeNotConfigured(StripeError):
    pass


class StripeUnavailable(StripeError):
    """Network failure, timeout, 5xx or 429: worth trying again later."""


class StripeRejected(StripeError):
    """4xx: Stripe refused the request (bad parameters, bad key, missing permission)."""


class StripeResponseInvalid(StripeError):
    pass


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is a failure: urllib would otherwise resend the Authorization header elsewhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _allowed_base(base_url: str) -> bool:
    parts = urlsplit(base_url)
    if not parts.hostname:
        return False
    if parts.scheme == "https":
        return True
    # Plain HTTP only to this machine (the contract-test fake server).
    return parts.scheme == "http" and parts.hostname in ("127.0.0.1", "localhost", "::1")


def encode_form(params: Mapping, prefix: str = "") -> list[tuple[str, str]]:
    """Flatten nested dicts and lists into Stripe's bracket notation, in a stable order."""
    pairs: list[tuple[str, str]] = []
    for key, value in params.items():
        name = f"{prefix}[{key}]" if prefix else str(key)
        if value is None:
            continue
        if isinstance(value, Mapping):
            pairs.extend(encode_form(value, name))
        elif isinstance(value, list | tuple):
            for index, item in enumerate(value):
                item_name = f"{name}[{index}]"
                if isinstance(item, Mapping):
                    pairs.extend(encode_form(item, item_name))
                else:
                    pairs.append((item_name, _scalar(item)))
        else:
            pairs.append((name, _scalar(value)))
    return pairs


def _scalar(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, float):
        raise TypeError("Stripe amounts are integers; floats are refused.")
    return str(value)


def _error_from(status: int, raw: bytes) -> StripeError:
    kind, code = "", ""
    try:
        detail = (json.loads(raw.decode("utf-8")) or {}).get("error") or {}
        kind = str(detail.get("type") or "")[:60]
        code = str(detail.get("code") or "")[:60]
    except (UnicodeDecodeError, ValueError, AttributeError):
        pass
    label = "/".join(part for part in (kind, code) if part)
    suffix = f" ({label})" if label else ""
    if status == 429 or status >= 500:
        return StripeUnavailable(f"Stripe is unavailable (HTTP {status}){suffix}.", status=status, code=code)
    if status in (401, 403):
        return StripeRejected(
            f"Stripe refused the key (HTTP {status}){suffix}. Check the key and its permissions.",
            status=status,
            code=code,
        )
    return StripeRejected(f"Stripe rejected the request (HTTP {status}){suffix}.", status=status, code=code)


class StripeClient:
    def __init__(self, api_key: str, *, base_url: str = API_BASE, timeout: float = TIMEOUT_S, opener=None):
        if not api_key:
            raise StripeNotConfigured("Stripe is not configured.")
        if not _allowed_base(base_url):
            raise ValueError("The Stripe API base must be https (http only for localhost).")
        self._api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self._opener = opener or urllib.request.build_opener(_NoRedirect)

    def __repr__(self) -> str:  # never show the key
        return f"StripeClient(base_url={self.base_url!r})"

    # --- transport -------------------------------------------------------------------------------

    def request(self, method: str, path: str, params: Mapping | None = None, *, idempotency_key: str = ""):
        pairs = encode_form(params or {})
        url = f"{self.base_url}{path}"
        data = None
        if method == "GET":
            if pairs:
                url = f"{url}?{urllib.parse.urlencode(pairs)}"
        else:
            data = urllib.parse.urlencode(pairs).encode("ascii")
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Stripe-Version": STRIPE_VERSION,
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
        }
        if data is not None:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key[:255]
        http_request = urllib.request.Request(  # noqa: S310 - scheme checked in __init__  # nosec B310
            url, data=data, method=method, headers=headers
        )
        try:
            with self._opener.open(http_request, timeout=self.timeout) as response:
                status = getattr(response, "status", 200)
                raw = response.read(MAX_RESPONSE_BYTES + 1)
        except urllib.error.HTTPError as exc:
            try:
                body = exc.read(65536)
            except (OSError, http.client.HTTPException):
                body = b""
            raise _error_from(exc.code, body) from None
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, TimeoutError):
                raise StripeUnavailable("Stripe did not answer before the timeout.") from None
            raise StripeUnavailable("Could not reach Stripe.") from None
        except TimeoutError:
            raise StripeUnavailable("Stripe did not answer before the timeout.") from None
        except (OSError, http.client.HTTPException):
            raise StripeUnavailable("The connection to Stripe failed.") from None
        if status >= 300:
            raise _error_from(status, raw)
        if len(raw) > MAX_RESPONSE_BYTES:
            raise StripeResponseInvalid("Stripe's response was too large.")
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise StripeResponseInvalid("Stripe's response was not JSON.") from None
        if not isinstance(payload, dict):
            raise StripeResponseInvalid("Stripe's response was not an object.")
        return payload

    # --- calls -----------------------------------------------------------------------------------

    def create_price(self, *, name: str, unit_amount: int, currency: str, idempotency_key: str) -> dict:
        return self.request(
            "POST",
            "/v1/prices",
            {"currency": currency.lower(), "unit_amount": int(unit_amount), "product_data": {"name": name}},
            idempotency_key=idempotency_key,
        )

    def create_payment_link(
        self, *, price_id: str, invoice_number: str, redirect_url: str, idempotency_key: str
    ) -> dict:
        return self.request(
            "POST",
            "/v1/payment_links",
            {
                "line_items": [{"price": price_id, "quantity": 1}],
                "metadata": {"vitalos_invoice": invoice_number},
                "payment_intent_data": {"metadata": {"vitalos_invoice": invoice_number}},
                "after_completion": {"type": "redirect", "redirect": {"url": redirect_url}},
                "restrictions": {"completed_sessions": {"limit": 1}},
            },
            idempotency_key=idempotency_key,
        )

    def deactivate_payment_link(self, link_id: str) -> dict:
        return self.request(
            "POST", f"/v1/payment_links/{urllib.parse.quote(link_id, safe='')}", {"active": False}
        )

    def create_checkout_session(
        self,
        *,
        invoice_number: str,
        amount: int,
        currency: str,
        customer_email: str,
        success_url: str,
        cancel_url: str,
        idempotency_key: str,
    ) -> dict:
        params = {
            "mode": "payment",
            "line_items": [
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": currency.lower(),
                        "unit_amount": int(amount),
                        "product_data": {"name": f"Invoice {invoice_number}"},
                    },
                }
            ],
            "metadata": {"vitalos_invoice": invoice_number},
            "payment_intent_data": {"metadata": {"vitalos_invoice": invoice_number}},
            "client_reference_id": invoice_number,
            "success_url": success_url,
            "cancel_url": cancel_url,
        }
        if customer_email:
            params["customer_email"] = customer_email
        return self.request("POST", "/v1/checkout/sessions", params, idempotency_key=idempotency_key)

    def list_checkout_sessions(self, *, created_gte: int, starting_after: str = "", limit: int = 100) -> dict:
        params = {"status": "complete", "created": {"gte": int(created_gte)}, "limit": int(limit)}
        if starting_after:
            params["starting_after"] = starting_after
        return self.request("GET", "/v1/checkout/sessions", params)


def is_configured() -> bool:
    return bool(getattr(settings, "BILLING_STRIPE_SECRET_KEY", ""))


def get_client() -> StripeClient:
    """The configured client. Raises StripeNotConfigured when no key is set."""
    key = getattr(settings, "BILLING_STRIPE_SECRET_KEY", "")
    if not key:
        raise StripeNotConfigured("Stripe is not configured.")
    return StripeClient(key, base_url=API_BASE)


# --- Webhook signatures ---------------------------------------------------------------------------


def verify_signature(
    payload: bytes,
    header: str,
    secret: str,
    *,
    tolerance: int = SIGNATURE_TOLERANCE_S,
    now: float | None = None,
) -> bool:
    """Stripe-Signature ``t=<unix>,v1=<hex>[,v1=…]``: HMAC-SHA256 of ``"{t}.{body}"``, within the tolerance."""
    if not secret or not header:
        return False
    timestamp = None
    signatures = []
    for item in header.split(","):
        key, _, value = item.strip().partition("=")
        if key == "t":
            timestamp = value
        elif key == "v1" and value:
            signatures.append(value)
    if timestamp is None or not timestamp.isdigit() or not signatures:
        return False
    current = time.time() if now is None else now
    if abs(current - int(timestamp)) > tolerance:
        return False
    signed = timestamp.encode("ascii") + b"." + payload
    expected = hmac.new(secret.encode("utf-8"), signed, hashlib.sha256).hexdigest()
    return any(hmac.compare_digest(expected, candidate) for candidate in signatures)


def sign_payload(payload: bytes, secret: str, timestamp: int) -> str:
    """The header Stripe would send (tests and local tooling)."""
    digest = hmac.new(secret.encode("utf-8"), str(timestamp).encode() + b"." + payload, hashlib.sha256)
    return f"t={timestamp},v1={digest.hexdigest()}"
