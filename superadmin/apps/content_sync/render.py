"""Client for the website's Markdown renderer (A7): one renderer, so preview equals production.

``render(markdown, context)`` POSTs ``{markdown, context}`` signed with scope ``render`` to
``{first target}/api/content/render`` (3 s timeout) and returns a ``RenderResult``. Any failure gives
``RenderResult.unavailable()``: the editor says "Preview unavailable. Your changes are saved." The HTML
is only ever shown inside a sandboxed iframe with no scripts (views.preview_frame).
"""

import hashlib
import json
import logging
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from urllib.parse import urlsplit

from django.conf import settings
from django.core.cache import cache

from . import signing

logger = logging.getLogger(__name__)

RENDER_PATH = "/api/content/render"
TIMEOUT_SECONDS = 3
MAX_MARKDOWN = 200_000
CONTEXTS = ("post", "role", "author", "settings")
CACHE_SECONDS = 600
MAX_RESPONSE_BYTES = 2 * 1024 * 1024
USER_AGENT = "vitalos-superadmin/1.0"


@dataclass
class RenderResult:
    available: bool
    html: str = ""
    toc: list = field(default_factory=list)
    footnotes: int = 0
    warnings: list = field(default_factory=list)
    reason: str = ""

    @classmethod
    def unavailable(cls, reason: str) -> "RenderResult":
        return cls(available=False, reason=reason)

    @property
    def blocking_warnings(self) -> list[dict]:
        return [warning for warning in self.warnings if warning.get("blocking")]


def http_post(url: str, body: bytes, headers: dict[str, str], timeout: float = TIMEOUT_SECONDS) -> bytes:
    """POST and return the body of a 200 response. Tests replace this function."""
    parts = urlsplit(url)
    if parts.scheme not in ("http", "https") or not parts.netloc:
        raise ValueError("invalid_target")
    request = urllib.request.Request(  # noqa: S310 - http(s) only, checked above
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/json", "User-Agent": USER_AGENT, **headers},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310  # nosec B310
        if response.status != 200:
            raise ValueError(f"http_{response.status}")
        data = response.read(MAX_RESPONSE_BYTES + 1)
    if len(data) > MAX_RESPONSE_BYTES:
        raise ValueError("too_large")
    return data


def _cache_key(markdown: str, context: str) -> str:
    digest = hashlib.sha256(f"{context}\n{markdown}".encode()).hexdigest()
    return f"content-render:{digest}"


def _parse(data: bytes) -> RenderResult:
    parsed = json.loads(data)
    if not isinstance(parsed, dict) or not isinstance(parsed.get("html"), str):
        raise ValueError("shape")
    warnings = [
        {
            "code": str(item.get("code", ""))[:40],
            "message": str(item.get("message", ""))[:300],
            "blocking": bool(item.get("blocking")),
        }
        for item in parsed.get("warnings") or []
        if isinstance(item, dict)
    ]
    toc = [item for item in parsed.get("toc") or [] if isinstance(item, dict)]
    footnotes = parsed.get("footnotes") if isinstance(parsed.get("footnotes"), int) else 0
    return RenderResult(True, parsed["html"], toc, footnotes, warnings)


def cached(markdown: str, context: str = "post") -> RenderResult | None:
    """A previous successful render of exactly this Markdown, without calling the website."""
    data = cache.get(_cache_key(markdown or "", context))
    return RenderResult(**data) if data is not None else None


def render(markdown: str, context: str = "post") -> RenderResult:
    if context not in CONTEXTS:
        raise ValueError("Unknown render context")
    markdown = markdown or ""
    if len(markdown) > MAX_MARKDOWN:
        return RenderResult.unavailable("too_large")
    key = _cache_key(markdown, context)
    cached = cache.get(key)
    if cached is not None:
        return RenderResult(**cached)
    web_targets = list(settings.CONTENT_WEB_TARGETS)
    if not web_targets:
        return RenderResult.unavailable("no_target")
    body = json.dumps({"markdown": markdown, "context": context}, separators=(",", ":")).encode()
    try:
        headers = signing.sign_headers("render", "POST", RENDER_PATH, body)
    except signing.NotConfigured:
        return RenderResult.unavailable("not_configured")
    try:
        result = _parse(http_post(web_targets[0] + RENDER_PATH, body, headers))
    except (urllib.error.URLError, TimeoutError, OSError, ValueError) as exc:
        reason = str(exc) if isinstance(exc, ValueError) else type(exc).__name__
        logger.warning("Render unavailable", extra={"reason": reason[:40]})
        return RenderResult.unavailable(reason[:40])
    cache.set(key, result.__dict__, CACHE_SECONDS)
    return result
