"""HMAC-SHA256 signing shared by both directions of the Relay contract (docs/relay/API.md, "Signing").

    canonical = ts + "\\n" + METHOD + "\\n" + pathWithQuery + "\\n" + (X-Relay-Admin or "") + "\\n"
                + hex(SHA-256(raw body bytes))
    X-Relay-Signature: v1=<hex HMAC-SHA256(secret, canonical)>

Secrets and bodies are never logged.
"""

import hashlib
import hmac
import time

TOLERANCE_SECONDS = 300
VERSION = "v1"


def body_hash(body: bytes) -> str:
    return hashlib.sha256(body or b"").hexdigest()


def canonical(timestamp: str, method: str, path_with_query: str, admin_header: str, body: bytes) -> str:
    return "\n".join((timestamp, method.upper(), path_with_query, admin_header or "", body_hash(body)))


def sign(secret: str, message: str) -> str:
    """``v1=<hex>`` for the canonical string ``message``."""
    digest = hmac.new(secret.encode(), message.encode(), hashlib.sha256).hexdigest()
    return f"{VERSION}={digest}"


def verify(
    secret: str,
    *,
    timestamp: str,
    signature: str,
    method: str,
    path_with_query: str,
    admin_header: str,
    body: bytes,
    now: float | None = None,
) -> str | None:
    """None when valid, otherwise the error code: ``bad_signature`` or ``stale``."""
    if not secret or not timestamp or not signature:
        return "bad_signature"
    try:
        sent_at = int(timestamp)
    except ValueError:
        return "bad_signature"
    expected = sign(secret, canonical(timestamp, method, path_with_query, admin_header, body))
    # Compare before the clock check so a forged request learns nothing from the error code.
    # Compare bytes: compare_digest raises TypeError on non-ASCII str, which would turn a junk
    # header into a 500 instead of a rejection.
    if not hmac.compare_digest(expected.encode(), signature.strip().lower().encode("utf-8", "replace")):
        return "bad_signature"
    if abs((now if now is not None else time.time()) - sent_at) > TOLERANCE_SECONDS:
        return "stale"
    return None
