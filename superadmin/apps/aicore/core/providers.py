"""Model providers behind one interface (CORE-01, AID-011).

``ModelProvider.complete(ModelRequest) -> ModelResponse`` is the only call the gateway makes. Errors
are typed so the gateway can decide what to retry:

* ``ProviderTimeout`` and ``ProviderUnavailable`` (network failure, HTTP 429 and 5xx) are retryable.
* ``ProviderResponseInvalid`` (a body that is not the expected JSON shape) is retryable once or twice.
* ``ProviderRejected`` (authentication, validation, unknown model: other 4xx) is permanent.

Implementations:

* ``OpenAICompatibleProvider``: chat completions over ``urllib`` (OpenAI, DeepSeek, Gemini's
  OpenAI-compatible endpoint and others). The API key is passed in, sent only in the Authorization
  header, never logged, never put in an exception message and never forwarded on a redirect.
* ``SimulatedProvider``: scripted, hand-written responses and faults for tests and the offline
  evaluation. Every response it returns is marked ``simulated=True``. It says nothing about the
  quality of a real model.
* ``ReplayProvider``: responses recorded from a real live run, keyed by prompt version and input hash,
  with provenance (provider, model, date). Empty until a live run records some.
* ``RecordingProvider``: wraps a live provider and keeps what it returned so a replay file can be
  written after a live evaluation.
"""

from __future__ import annotations

import http.client
import json
import time
import urllib.error
import urllib.request
from collections.abc import Callable, Sequence
from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable
from urllib.parse import urlsplit

MAX_RESPONSE_BYTES = 1024 * 1024
USER_AGENT = "vitalos-aicore/1.0"


@dataclass(frozen=True)
class ModelRequest:
    """One model call. ``messages`` are chat messages ({"role", "content"})."""

    messages: tuple[dict, ...]
    temperature: float = 0.0
    max_output_tokens: int = 1024
    json_output: bool = True
    timeout_s: float = 20.0
    # The prompt's output JSON Schema. Providers with structured outputs constrain the answer to it;
    # the gateway validates every answer against it either way.
    output_schema: dict | None = None
    # Correlation for replay and metering. Never contains document text.
    prompt_ref: str = ""
    input_hash: str = ""

    @property
    def input_chars(self) -> int:
        return sum(len(message.get("content", "")) for message in self.messages)


@dataclass(frozen=True)
class ModelResponse:
    text: str
    model: str
    input_tokens: int
    output_tokens: int
    finish_reason: str
    latency_ms: int
    simulated: bool = False
    provenance: dict = field(default_factory=dict)


class ProviderError(Exception):
    """Base class. ``category`` is safe to log, store and show; the message never holds secrets."""

    category = "provider_error"
    retryable = False

    def __init__(self, detail: str = ""):
        self.detail = detail[:200]
        super().__init__(f"{self.category}: {self.detail}" if self.detail else self.category)


class ProviderTimeout(ProviderError):
    category = "timeout"
    retryable = True


class ProviderUnavailable(ProviderError):
    category = "unavailable"
    retryable = True


class ProviderRejected(ProviderError):
    category = "rejected"
    retryable = False


class ProviderResponseInvalid(ProviderError):
    category = "invalid_response"
    retryable = True


@runtime_checkable
class ModelProvider(Protocol):
    name: str
    model: str
    simulated: bool

    def complete(self, request: ModelRequest) -> ModelResponse: ...


def estimate_tokens(text: str) -> int:
    """Rough token estimate (about four characters a token) for simulated usage and limit checks."""
    return max(1, (len(text) + 3) // 4)


# --- OpenAI-compatible chat completions -----------------------------------------------------------


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    """A redirect is a failure: urllib would otherwise resend the Authorization header elsewhere."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _allowed_base_url(base_url: str) -> bool:
    parts = urlsplit(base_url)
    if not parts.hostname:
        return False
    if parts.scheme == "https":
        return True
    # Plain HTTP only to this machine (the contract-test fake server, a local model runner).
    return parts.scheme == "http" and parts.hostname in ("127.0.0.1", "localhost", "::1")


class OpenAICompatibleProvider:
    """POST ``{base_url}/chat/completions`` with a Bearer key; parse the first choice."""

    name = "openai-compatible"
    simulated = False

    def __init__(self, *, base_url: str, model: str, api_key: str, opener=None):
        if not _allowed_base_url(base_url):
            raise ValueError("The model base URL must be https (http only for localhost).")
        if not api_key:
            raise ValueError("An API key is required.")
        if not model:
            raise ValueError("A model name is required.")
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._api_key = api_key
        self._opener = opener or urllib.request.build_opener(_NoRedirect)

    def __repr__(self) -> str:  # never show the key
        return f"OpenAICompatibleProvider(base_url={self.base_url!r}, model={self.model!r})"

    def _body(self, request: ModelRequest) -> bytes:
        body = {
            "model": self.model,
            "messages": list(request.messages),
            "temperature": request.temperature,
            "max_tokens": request.max_output_tokens,
        }
        if request.json_output:
            body["response_format"] = {"type": "json_object"}
        return json.dumps(body).encode("utf-8")

    def complete(self, request: ModelRequest) -> ModelResponse:
        http_request = urllib.request.Request(  # noqa: S310 - scheme checked in __init__  # nosec B310
            f"{self.base_url}/chat/completions",
            data=self._body(request),
            method="POST",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
                "User-Agent": USER_AGENT,
            },
        )
        started = time.monotonic()
        deadline = started + request.timeout_s
        try:
            with self._opener.open(http_request, timeout=request.timeout_s) as response:
                status = getattr(response, "status", 200)
                if status != 200:
                    raise _status_error(status)
                raw = bytearray()
                while len(raw) <= MAX_RESPONSE_BYTES:
                    if time.monotonic() > deadline:
                        raise ProviderTimeout("response not complete before the deadline")
                    chunk = response.read(16384)
                    if not chunk:
                        break
                    raw.extend(chunk)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise ProviderResponseInvalid("response too large")
        except ProviderError:
            raise
        except urllib.error.HTTPError as exc:
            raise _status_error(exc.code) from None
        except urllib.error.URLError as exc:
            if isinstance(exc.reason, TimeoutError):
                raise ProviderTimeout("no response before the timeout") from None
            raise ProviderUnavailable("could not reach the provider") from None
        except TimeoutError:
            raise ProviderTimeout("no response before the timeout") from None
        except (OSError, http.client.HTTPException):
            raise ProviderUnavailable("connection failed") from None
        latency_ms = int((time.monotonic() - started) * 1000)
        return self._parse(bytes(raw), latency_ms)

    def _parse(self, raw: bytes, latency_ms: int) -> ModelResponse:
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, ValueError):
            raise ProviderResponseInvalid("response body is not JSON") from None
        try:
            choice = payload["choices"][0]
            text = choice["message"]["content"]
            if not isinstance(text, str):
                raise TypeError
            usage = payload.get("usage") or {}
            return ModelResponse(
                text=text,
                model=str(payload.get("model") or self.model),
                input_tokens=int(usage.get("prompt_tokens") or 0),
                output_tokens=int(usage.get("completion_tokens") or 0),
                finish_reason=str(choice.get("finish_reason") or ""),
                latency_ms=latency_ms,
            )
        except (KeyError, IndexError, TypeError, ValueError, AttributeError):
            raise ProviderResponseInvalid("response JSON is not a chat completion") from None


# --- Anthropic Messages API (official SDK) ----------------------------------------------------------

#: JSON Schema keywords structured outputs do not accept. They are removed from the schema sent to
#: the API only; the gateway still validates the answer against the full prompt schema.
_UNSUPPORTED_SCHEMA_KEYWORDS = frozenset(
    {
        "minimum",
        "maximum",
        "exclusiveMinimum",
        "exclusiveMaximum",
        "multipleOf",
        "minLength",
        "maxLength",
        "pattern",
        "minItems",
        "maxItems",
        "uniqueItems",
    }
)


def api_schema(schema: dict) -> dict:
    """The prompt schema without the constraints structured outputs reject (recursively)."""
    if isinstance(schema, dict):
        return {
            key: api_schema(value)
            for key, value in schema.items()
            if key not in _UNSUPPORTED_SCHEMA_KEYWORDS
        }
    if isinstance(schema, list):
        return [api_schema(item) for item in schema]
    return schema


class AnthropicProvider:
    """Claude through the official ``anthropic`` SDK: one Messages API call per request.

    * System messages become the top-level ``system`` prompt; the rest are sent as conversation turns.
    * ``output_config.format`` constrains the answer to the prompt's JSON Schema (structured outputs).
    * ``output_config.effort`` sets how much the model thinks (thinking cannot be switched off on
      current models); extraction runs at ``low`` unless configured otherwise.
    * ``fallbacks: "default"`` lets the API re-run a request declined by a safety classifier on
      Anthropic's recommended fallback model; a final refusal is a permanent error here.
    * The SDK's own retries are off (``max_retries=0``): the gateway owns retries, timeouts and limits.
    * No sampling parameters are sent: current API versions reject them.
    """

    name = "anthropic"
    simulated = False
    FALLBACK_BETA = "server-side-fallback-2026-07-01"

    def __init__(self, *, model: str, api_key: str, effort: str = "low", client=None):
        if not api_key and client is None:
            raise ValueError("An API key is required.")
        if not model:
            raise ValueError("A model name is required.")
        if effort not in {"low", "medium", "high", "xhigh", "max"}:
            raise ValueError("Effort must be low, medium, high, xhigh or max.")
        self.model = model
        self.effort = effort
        if client is None:
            import anthropic  # deferred: only the live path needs the SDK

            client = anthropic.Anthropic(api_key=api_key, max_retries=0)
        self._client = client

    def __repr__(self) -> str:  # never show the key
        return f"AnthropicProvider(model={self.model!r}, effort={self.effort!r})"

    def _params(self, request: ModelRequest) -> dict:
        system = "\n\n".join(m["content"] for m in request.messages if m.get("role") == "system")
        turns = [
            {"role": m["role"], "content": m["content"]}
            for m in request.messages
            if m.get("role") in {"user", "assistant"}
        ]
        output_config: dict = {"effort": self.effort}
        if request.json_output and request.output_schema:
            output_config["format"] = {"type": "json_schema", "schema": api_schema(request.output_schema)}
        params = {
            "model": self.model,
            "max_tokens": max(request.max_output_tokens, 4096),  # room for thinking at low effort
            "messages": turns,
            "output_config": output_config,
            "betas": [self.FALLBACK_BETA],
            "fallbacks": "default",
            "timeout": request.timeout_s,
        }
        if system:
            params["system"] = system
        return params

    def complete(self, request: ModelRequest) -> ModelResponse:
        import anthropic

        started = time.monotonic()
        try:
            response = self._client.beta.messages.create(**self._params(request))
        except anthropic.APITimeoutError:
            raise ProviderTimeout("no response before the timeout") from None
        except anthropic.APIConnectionError:
            raise ProviderUnavailable("could not reach the provider") from None
        except anthropic.RateLimitError:
            raise ProviderUnavailable("HTTP 429") from None
        except anthropic.APIStatusError as exc:
            raise _status_error(exc.status_code) from None
        latency_ms = int((time.monotonic() - started) * 1000)
        if response.stop_reason == "refusal":
            raise ProviderRejected("the model declined the request (refusal)")
        if response.stop_reason == "max_tokens":
            raise ProviderResponseInvalid("answer cut off at max_tokens")
        text = "".join(block.text for block in response.content if block.type == "text")
        if not text:
            raise ProviderResponseInvalid("no text in the response")
        usage = response.usage
        # With a fallback, top-level usage covers only the attempt that answered; the per-attempt
        # iterations are the billing record, so meter their sum when they are present.
        attempts = getattr(usage, "iterations", None) or [usage]
        input_tokens = sum(int(getattr(a, "input_tokens", 0) or 0) for a in attempts)
        output_tokens = sum(int(getattr(a, "output_tokens", 0) or 0) for a in attempts)
        return ModelResponse(
            text=text,
            model=str(response.model or self.model),
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            finish_reason=str(response.stop_reason or ""),
            latency_ms=latency_ms,
        )


DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5"


def build_live_provider(*, provider: str, api_key: str, model: str, base_url: str, effort: str):
    """The configured live provider. Raises ValueError with a safe message when it is incomplete."""
    if not api_key:
        raise ValueError("no model API key is configured (AI_DATA_LLM_API_KEY)")
    if provider == "anthropic":
        return AnthropicProvider(model=model or DEFAULT_ANTHROPIC_MODEL, api_key=api_key, effort=effort)
    if provider == "openai-compatible":
        if not base_url or not model:
            raise ValueError("AI_DATA_LLM_BASE_URL and AI_DATA_LLM_MODEL must both be set")
        return OpenAICompatibleProvider(base_url=base_url, model=model, api_key=api_key)
    raise ValueError("AI_DATA_LLM_PROVIDER must be anthropic or openai-compatible")


def _status_error(status: int) -> ProviderError:
    if status == 408:
        return ProviderTimeout("HTTP 408")
    if status == 429 or status >= 500:
        return ProviderUnavailable(f"HTTP {status}")
    return ProviderRejected(f"HTTP {status}")


# --- Simulated (hand-written test doubles) ---------------------------------------------------------

FAULTS: dict[str, type[ProviderError]] = {
    "timeout": ProviderTimeout,
    "unavailable": ProviderUnavailable,
    "rejected": ProviderRejected,
    "invalid_response": ProviderResponseInvalid,
}


class SimulatedProvider:
    """Plays a script of steps, one per call; the last step repeats when the script runs out.

    A step is ``{"respond": <str | JSON value>}`` (optionally with ``input_tokens``/``output_tokens``)
    or ``{"fault": "timeout" | "unavailable" | "rejected" | "invalid_response"}``. Every response is
    marked simulated: these are hand-written test doubles for the controls around the model.
    """

    name = "simulated"
    model = "simulated"
    simulated = True

    def __init__(self, script: Sequence[dict] | None = None, responder: Callable | None = None):
        if not script and responder is None:
            raise ValueError("A simulated provider needs a script or a responder.")
        self.script = list(script or [])
        self.responder = responder
        self.calls: list[ModelRequest] = []

    def complete(self, request: ModelRequest) -> ModelResponse:
        self.calls.append(request)
        if self.responder is not None:
            step = self.responder(request)
        else:
            step = self.script[min(len(self.calls), len(self.script)) - 1]
        fault = step.get("fault")
        if fault:
            raise FAULTS[fault](f"simulated {fault}")
        body = step.get("respond")
        text = body if isinstance(body, str) else json.dumps(body)
        prompt_text = "".join(message.get("content", "") for message in request.messages)
        return ModelResponse(
            text=text,
            model=self.model,
            input_tokens=int(step.get("input_tokens", estimate_tokens(prompt_text))),
            output_tokens=int(step.get("output_tokens", estimate_tokens(text))),
            finish_reason="stop",
            latency_ms=int(step.get("latency_ms", 1)),
            simulated=True,
            provenance={"source": "simulated", "note": "hand-written test double"},
        )


# --- Replay of recorded live responses -------------------------------------------------------------


def replay_key(prompt_ref: str, input_hash: str) -> str:
    return f"{prompt_ref}#{input_hash}"


class ReplayProvider:
    """Serves responses recorded from a real live run.

    ``recordings`` is ``{"provenance": {"provider", "model", "recorded_at", ...}, "entries": {key: {...}}}``
    as written by ``RecordingProvider.export``. A request with no recording raises ``ProviderRejected``
    (``no recording``): replay never invents a response.
    """

    name = "replay"
    simulated = False

    def __init__(self, recordings: dict):
        self.provenance = dict(recordings.get("provenance") or {})
        self.entries = dict(recordings.get("entries") or {})
        self.model = str(self.provenance.get("model") or "unknown")

    def complete(self, request: ModelRequest) -> ModelResponse:
        entry = self.entries.get(replay_key(request.prompt_ref, request.input_hash))
        if entry is None:
            raise ProviderRejected("no recording for this prompt version and input")
        return ModelResponse(
            text=entry["text"],
            model=self.model,
            input_tokens=int(entry.get("input_tokens", 0)),
            output_tokens=int(entry.get("output_tokens", 0)),
            finish_reason=str(entry.get("finish_reason", "")),
            latency_ms=0,
            provenance={"source": "replay", **self.provenance},
        )


class RecordingProvider:
    """Wraps a live provider and keeps each successful response for a replay file."""

    simulated = False

    def __init__(self, inner: ModelProvider, *, recorded_at: str):
        self.inner = inner
        self.name = inner.name
        self.model = inner.model
        self.recorded_at = recorded_at
        self.entries: dict[str, dict] = {}

    def complete(self, request: ModelRequest) -> ModelResponse:
        response = self.inner.complete(request)
        self.entries[replay_key(request.prompt_ref, request.input_hash)] = {
            "text": response.text,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "finish_reason": response.finish_reason,
        }
        return response

    def export(self) -> dict:
        return {
            "provenance": {
                "provider": self.inner.name,
                "model": self.inner.model,
                "recorded_at": self.recorded_at,
                "source": "live run",
            },
            "entries": dict(sorted(self.entries.items())),
        }
