"""Signing scheme v1 for the content API, and preview tokens (contracts/content-api/v1/openapi.yaml).

Headers: ``X-Vitalos-Key-Id``, ``X-Vitalos-Timestamp`` (Unix seconds) and ``X-Vitalos-Signature``
(``v1=`` + lowercase hex HMAC-SHA256). Canonical string, joined with newlines and no trailing newline::

    v1
    {scope}
    {timestamp}
    {METHOD}
    {path and query string exactly as sent}
    {lowercase hex SHA-256 of the raw body}

Keys are configured per scope as ``keyId:secret[,keyId:secret...]``: the signer uses the first entry and
the verifier accepts any, so a key rotates with no downtime. A scope with no keys fails closed.
This extends the Enquiries scheme (``providers.sign``: HMAC over ``"{ts}." + body``) to the method,
path, query string and scope.
"""

import base64
import binascii
import hashlib
import hmac
import json
import re
import time
from dataclasses import dataclass

from django.conf import settings

VERSION = "v1"
TOLERANCE_SECONDS = 300
PREVIEW_TTL_SECONDS = 15 * 60
SCOPES = ("read", "tick", "submit", "revalidate", "render", "preview")
KEY_ID_RE = re.compile(r"[a-z0-9-]{1,32}", re.ASCII)
TIMESTAMP_RE = re.compile(r"[0-9]{1,12}", re.ASCII)
SIGNATURE_RE = re.compile(r"v1=([0-9a-f]{64})", re.ASCII)
TOKEN_RE = re.compile(r"[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+", re.ASCII)
HEADER_KEY_ID = "X-Vitalos-Key-Id"
HEADER_TIMESTAMP = "X-Vitalos-Timestamp"
HEADER_SIGNATURE = "X-Vitalos-Signature"
PREVIEW_ENTITIES = ("post", "role")
EMPTY_SHA256 = hashlib.sha256(b"").hexdigest()

# Which setting holds the keys for each scope. ``tick`` is signed with a read key (ADR-042).
SCOPE_SETTINGS = {
    "read": "CONTENT_READ_CLIENT_KEYS",
    "tick": "CONTENT_READ_CLIENT_KEYS",
    "submit": "CAREERS_SUBMIT_CLIENT_KEYS",
    "revalidate": "CONTENT_REVALIDATE_SECRET",
    "render": "CONTENT_RENDER_SECRET",
    "preview": "CONTENT_PREVIEW_SECRET",
}


class NotConfigured(Exception):
    """The scope has no keys: the endpoint answers 503 (fail closed)."""


class InvalidSignature(Exception):
    """Missing, malformed, unknown, stale, tampered or wrong-scope: the endpoint answers 401."""


@dataclass(frozen=True)
class Key:
    key_id: str
    secret: str


def parse_keys(raw: str) -> list[Key]:
    """``keyId:secret`` entries, comma-separated. Malformed entries are ignored (never logged)."""
    keys = []
    for entry in (raw or "").split(","):
        key_id, sep, secret = entry.strip().partition(":")
        if sep and KEY_ID_RE.fullmatch(key_id) and secret:
            keys.append(Key(key_id, secret))
    return keys


def keys_for(scope: str) -> list[Key]:
    if scope not in SCOPE_SETTINGS:
        raise ValueError(f"Unknown scope {scope!r}")
    return parse_keys(getattr(settings, SCOPE_SETTINGS[scope], ""))


def body_hash(body: bytes) -> str:
    return hashlib.sha256(body or b"").hexdigest()


def canonical(scope: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    return "\n".join((VERSION, scope, timestamp, method.upper(), path, body_hash(body)))


def signature(secret: str, scope: str, timestamp: str, method: str, path: str, body: bytes) -> str:
    message = canonical(scope, timestamp, method, path, body).encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def sign_headers(
    scope: str, method: str, path: str, body: bytes = b"", *, key: Key | None = None, now: float | None = None
) -> dict[str, str]:
    """Headers for an outgoing request, signed with the first key of ``scope`` (or ``key``)."""
    if key is None:
        keys = keys_for(scope)
        if not keys:
            raise NotConfigured(scope)
        key = keys[0]
    timestamp = str(int(now if now is not None else time.time()))
    return {
        HEADER_KEY_ID: key.key_id,
        HEADER_TIMESTAMP: timestamp,
        HEADER_SIGNATURE: f"{VERSION}={signature(key.secret, scope, timestamp, method, path, body)}",
    }


def verify(
    scope: str,
    *,
    key_id: str,
    timestamp: str,
    signature_header: str,
    method: str,
    path: str,
    body: bytes,
    now: float | None = None,
) -> Key:
    """Return the matching key, or raise InvalidSignature / NotConfigured."""
    keys = keys_for(scope)
    if not keys:
        raise NotConfigured(scope)
    if not key_id or not timestamp or not signature_header:
        raise InvalidSignature("missing")
    # Strict ASCII patterns: str.isdigit() accepts "²", and compare_digest raises on non-ASCII text.
    if not TIMESTAMP_RE.fullmatch(timestamp):
        raise InvalidSignature("timestamp")
    if not KEY_ID_RE.fullmatch(key_id):
        raise InvalidSignature("key")
    match = SIGNATURE_RE.fullmatch(signature_header.strip())
    if match is None:
        raise InvalidSignature("format")
    if abs((now if now is not None else time.time()) - int(timestamp)) > TOLERANCE_SECONDS:
        raise InvalidSignature("stale")
    key = next(
        (candidate for candidate in keys if hmac.compare_digest(candidate.key_id.encode(), key_id.encode())),
        None,
    )
    if key is None:
        raise InvalidSignature("key")
    expected = signature(key.secret, scope, timestamp, method, path, body)
    if not hmac.compare_digest(expected.encode(), match.group(1).encode()):
        raise InvalidSignature("signature")
    return key


def verify_request(request, scope: str, body: bytes, *, now: float | None = None) -> Key:
    """Verify a Django request; the path is ``request.get_full_path()`` (path and query as sent)."""
    return verify(
        scope,
        key_id=request.headers.get(HEADER_KEY_ID, ""),
        timestamp=request.headers.get(HEADER_TIMESTAMP, ""),
        signature_header=request.headers.get(HEADER_SIGNATURE, ""),
        method=request.method,
        path=request.get_full_path(),
        body=body,
        now=now,
    )


# --- Preview tokens -----------------------------------------------------------------------------


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def preview_token(entity: str, item_id, revision_hash: str, *, now: float | None = None) -> str:
    """``base64url(payload) + "." + base64url(HMAC-SHA256(secret, base64url(payload)))``, 15 minutes."""
    if entity not in PREVIEW_ENTITIES:
        raise ValueError("Unknown preview entity")
    keys = keys_for("preview")
    if not keys:
        raise NotConfigured("preview")
    key = keys[0]
    payload = {
        "v": 1,
        "kid": key.key_id,
        "entity": entity,
        "id": str(item_id),
        "rev": revision_hash,
        "exp": int(now if now is not None else time.time()) + PREVIEW_TTL_SECONDS,
    }
    encoded = _b64(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode())
    mac = hmac.new(key.secret.encode(), encoded.encode("ascii"), hashlib.sha256).digest()
    return f"{encoded}.{_b64(mac)}"


def verify_preview_token(token: str, entity: str, item_id, *, now: float | None = None) -> dict:
    """The payload when the token is valid for this entity and id; raises InvalidSignature otherwise."""
    keys = keys_for("preview")
    if not keys:
        raise NotConfigured("preview")
    if not token or len(token) > 2000 or not TOKEN_RE.fullmatch(token):
        raise InvalidSignature("format")
    encoded, mac_text = token.split(".")
    try:
        payload = json.loads(_unb64(encoded))
        mac = _unb64(mac_text)
    except (ValueError, binascii.Error, UnicodeDecodeError):
        raise InvalidSignature("format") from None
    if not isinstance(payload, dict) or payload.get("v") != 1:
        raise InvalidSignature("format")
    key = next((candidate for candidate in keys if candidate.key_id == payload.get("kid")), None)
    if key is None:
        raise InvalidSignature("key")
    expected = hmac.new(key.secret.encode(), encoded.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, mac):
        raise InvalidSignature("signature")
    expires = payload.get("exp")
    if not isinstance(expires, int) or expires <= (now if now is not None else time.time()):
        raise InvalidSignature("expired")
    if payload.get("entity") != entity or payload.get("id") != str(item_id):
        raise InvalidSignature("subject")
    return payload
