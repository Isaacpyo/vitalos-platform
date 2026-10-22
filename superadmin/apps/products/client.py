"""HTTP adapter for product status endpoints. Server-side only: the browser never sees the URL's token.

``fetch_status_json`` is the single network call; tests replace it (``monkeypatch``) with a stub.
It sends ``Authorization: Bearer <token>``, refuses redirects (so the token is never forwarded to
another host), gives up after ``timeout`` seconds overall, and reads at most ``MAX_RESPONSE_BYTES``.
Response bodies and the token are never logged.
"""

from __future__ import annotations

import http.client
import json
import time
import urllib.error
import urllib.request
from urllib.parse import urlsplit

TIMEOUT_SECONDS = 3.0
MAX_RESPONSE_BYTES = 64 * 1024
USER_AGENT = "vitalos-superadmin-product-pipeline/1.0"


class StatusFetchError(Exception):
    """The endpoint could not give a usable answer. ``code`` is safe to log and to show to staff."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(f"Product status unavailable ({code})")


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """Treat every redirect as a failure: urllib would otherwise resend the Authorization header."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def fetch_status_json(url: str, token: str, timeout: float = TIMEOUT_SECONDS) -> object:
    """GET ``url`` with the Bearer ``token`` and return the decoded JSON body."""
    parts = urlsplit(url)
    if parts.scheme not in ("https", "http") or not parts.hostname:
        raise StatusFetchError("bad_url")
    request = urllib.request.Request(  # noqa: S310 - http(s) only, checked above
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
            "User-Agent": USER_AGENT,
            "Cache-Control": "no-cache",
        },
    )
    opener = urllib.request.build_opener(_NoRedirect)
    deadline = time.monotonic() + timeout
    try:
        with opener.open(request, timeout=timeout) as response:
            if response.status != 200:
                raise StatusFetchError(f"http_{response.status}")
            content_type = response.headers.get("Content-Type", "")
            if content_type.split(";")[0].strip().lower() != "application/json":
                raise StatusFetchError("not_json")
            body = bytearray()
            while len(body) <= MAX_RESPONSE_BYTES:
                if time.monotonic() > deadline:
                    raise StatusFetchError("timeout")
                chunk = response.read(8192)
                if not chunk:
                    break
                body.extend(chunk)
            if len(body) > MAX_RESPONSE_BYTES:
                raise StatusFetchError("too_large")
    except StatusFetchError:
        raise
    except urllib.error.HTTPError as exc:
        raise StatusFetchError(f"http_{exc.code}") from None
    except urllib.error.URLError as exc:
        code = "timeout" if isinstance(exc.reason, TimeoutError) else "unreachable"
        raise StatusFetchError(code) from None
    except TimeoutError:
        raise StatusFetchError("timeout") from None
    except (OSError, http.client.HTTPException):
        raise StatusFetchError("unreachable") from None
    try:
        return json.loads(bytes(body).decode("utf-8"))
    except (UnicodeDecodeError, ValueError):
        raise StatusFetchError("bad_json") from None
