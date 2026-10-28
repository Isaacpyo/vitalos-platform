"""Model gateway (CORE-01): one structured call with validation, bounded retries, limits and metering.

``ModelGateway.run_structured`` renders a versioned prompt, checks the limits BEFORE each provider
call, calls the provider with a per-call timeout inside an overall deadline, retries only retryable
failures (at most ``max_retries`` = 2, exponential backoff with jitter), validates the output against
the prompt's JSON Schema (one extra attempt for schema-invalid output), and returns a
``GatewayResult`` that is recorded whatever the outcome.

Outcomes: ``success``, ``invalid_output``, ``timeout``, ``unavailable``, ``rejected``, ``disabled``,
``limit_exceeded``. Only ``success`` carries an output, and that output has passed schema validation.
Prompts and outputs are never logged; logs carry ids, outcome, counts and cost.
"""

from __future__ import annotations

import json
import logging
import math
import random
import time
import uuid
from collections.abc import Callable
from dataclasses import asdict, dataclass, field, replace
from decimal import Decimal

import jsonschema

from .limits import ExecutionLimits, LimitGuard, RunContext
from .pricing import PriceTable, default_table
from .prompts import PromptConfig, input_hash
from .providers import ModelProvider, ModelRequest, ProviderError
from .redaction import safe_detail

logger = logging.getLogger("aicore.gateway")

OUTCOMES = ("success", "invalid_output", "timeout", "unavailable", "rejected", "disabled", "limit_exceeded")
_EXHAUSTED = {"timeout": "timeout", "unavailable": "unavailable", "invalid_response": "invalid_output"}


@dataclass
class AttemptRecord:
    number: int
    result: str  # "success", "schema_invalid" or a provider error category
    latency_ms: int
    input_tokens: int = 0
    output_tokens: int = 0


@dataclass
class GatewayResult:
    execution_id: str
    workflow: str
    run_ref: str
    prompt_id: str
    prompt_version: int
    prompt_hash: str
    provider: str
    model: str
    simulated: bool
    outcome: str
    output: dict | None = None
    validation_errors: list[str] = field(default_factory=list)
    attempts: int = 0
    attempt_log: list[AttemptRecord] = field(default_factory=list)
    input_tokens: int = 0
    output_tokens: int = 0
    cost_gbp: Decimal = Decimal("0")
    latency_ms: int = 0
    error_category: str = ""
    limit: str = ""
    detail: str = ""  # human-readable reason for a refusal or failure (no secrets, no document text)
    input_hash: str = ""

    @property
    def ok(self) -> bool:
        return self.outcome == "success"

    def as_dict(self) -> dict:
        data = asdict(self)
        data["cost_gbp"] = str(self.cost_gbp)
        return data


def _strip_fence(text: str) -> str:
    stripped = text.strip()
    if stripped.startswith("```") and stripped.endswith("```"):
        stripped = stripped[3:-3]
        if stripped.lower().startswith("json"):
            stripped = stripped[4:]
    return stripped.strip()


def validate_output(text: str, schema: dict) -> tuple[dict | None, list[str]]:
    """Parse ``text`` as JSON and validate it. Returns (output, []) or (None, errors)."""
    try:
        value = json.loads(_strip_fence(text))
    except ValueError:
        return None, ["Output is not valid JSON."]
    validator = jsonschema.Draft202012Validator(schema)
    errors = sorted(validator.iter_errors(value), key=lambda error: list(error.absolute_path))
    if errors:
        messages = []
        for error in errors[:10]:
            path = "/".join(str(part) for part in error.absolute_path) or "(root)"
            messages.append(safe_detail(f"{path}: {error.message}", 160))
        return None, messages
    return value, []


class ModelGateway:
    def __init__(
        self,
        provider: ModelProvider,
        guard: LimitGuard,
        *,
        pricing: PriceTable | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
        rng: random.Random | None = None,
        recorders: list[Callable[[GatewayResult], None]] | None = None,
        id_factory: Callable[[], str] | None = None,
    ):
        self.provider = provider
        self.guard = guard
        self.pricing = pricing or default_table()
        self.sleep = sleep
        self.clock = clock
        self.rng = rng or random.Random()  # noqa: S311 - jitter, not security  # nosec B311
        self.recorders = list(recorders or [])
        self.id_factory = id_factory or (lambda: str(uuid.uuid4()))

    @property
    def limits(self) -> ExecutionLimits:
        return self.guard.limits

    def backoff_delay(self, attempt: int) -> float:
        """Delay before retry ``attempt`` (1-based): base * 2^(attempt-1), capped, plus jitter."""
        limits = self.limits
        base = min(limits.backoff_max_s, limits.backoff_base_s * (2 ** (attempt - 1)))
        return base + self.rng.uniform(0, limits.backoff_base_s)

    def run_structured(
        self, prompt: PromptConfig, *, data: str, ctx: RunContext, variables: dict | None = None
    ) -> GatewayResult:
        limits = self.limits
        messages = prompt.render(data=data, **(variables or {}))
        request = ModelRequest(
            messages=messages,
            temperature=prompt.temperature,
            max_output_tokens=prompt.max_output_tokens,
            json_output=True,
            timeout_s=limits.per_call_timeout_s,
            prompt_ref=prompt.ref,
            input_hash=input_hash(messages),
        )
        price = self.pricing.price(self.provider.model)
        # Worst case: about three characters a token in, the full output allowance out.
        worst_case = price.cost_gbp(math.ceil(request.input_chars / 3), request.max_output_tokens)
        result = GatewayResult(
            execution_id=self.id_factory(),
            workflow=ctx.workflow,
            run_ref=ctx.run_ref,
            prompt_id=prompt.id,
            prompt_version=prompt.version,
            prompt_hash=prompt.content_hash,
            provider=self.provider.name,
            model=self.provider.model,
            simulated=bool(getattr(self.provider, "simulated", False)),
            outcome="",
            input_hash=request.input_hash,
        )
        max_attempts = 1 + limits.max_retries
        started = self.clock()
        schema_retry_used = False
        last_error: ProviderError | None = None
        while True:
            remaining = limits.overall_deadline_s - (self.clock() - started)
            if remaining <= 0:
                result.outcome, result.error_category = "timeout", "deadline_exceeded"
                result.detail = f"The overall deadline of {limits.overall_deadline_s:g} s passed."
                break
            decision = self.guard.check_call(ctx, input_chars=request.input_chars, worst_case_gbp=worst_case)
            if not decision.allowed:
                result.outcome = decision.outcome
                result.error_category = result.limit = decision.limit
                result.detail = decision.reason
                ctx.blocked.append(decision.limit)
                break
            ctx.calls_made += 1
            ctx.started_model = True
            result.attempts += 1
            attempt_started = self.clock()
            try:
                response = self.provider.complete(
                    replace(request, timeout_s=min(limits.per_call_timeout_s, remaining))
                )
            except ProviderError as error:
                last_error = error
                result.attempt_log.append(
                    AttemptRecord(
                        result.attempts, error.category, int((self.clock() - attempt_started) * 1000)
                    )
                )
                logger.warning(
                    "model call failed",
                    extra={
                        "execution_id": result.execution_id,
                        "attempt": result.attempts,
                        "category": error.category,
                    },
                )
                if not error.retryable:
                    result.outcome, result.error_category = "rejected", error.category
                    result.detail = f"The provider refused the request ({safe_detail(error.detail, 80)})."
                    break
                if result.attempts >= max_attempts:
                    result.outcome = _EXHAUSTED.get(error.category, "unavailable")
                    result.error_category = error.category
                    result.detail = f"Gave up after {result.attempts} attempts ({error.category})."
                    break
                delay = self.backoff_delay(result.attempts)
                left = limits.overall_deadline_s - (self.clock() - started)
                self.sleep(max(0.0, min(delay, left)))
                continue
            cost = price.cost_gbp(response.input_tokens, response.output_tokens)
            result.input_tokens += response.input_tokens
            result.output_tokens += response.output_tokens
            result.cost_gbp += cost
            ctx.spent_gbp += cost
            output, errors = validate_output(response.text, prompt.output_schema)
            result.attempt_log.append(
                AttemptRecord(
                    result.attempts,
                    "success" if output is not None else "schema_invalid",
                    int((self.clock() - attempt_started) * 1000),
                    response.input_tokens,
                    response.output_tokens,
                )
            )
            if output is not None:
                result.outcome, result.output, result.validation_errors = "success", output, []
                break
            result.validation_errors = errors
            if not schema_retry_used and result.attempts < max_attempts:
                schema_retry_used = True
                continue
            result.outcome, result.error_category = "invalid_output", "schema_invalid"
            result.detail = f"The output failed schema validation after {result.attempts} attempts."
            break
        result.latency_ms = int((self.clock() - started) * 1000)
        if result.outcome != "success" and last_error is not None and not result.error_category:
            result.error_category = last_error.category
        logger.info(
            "model execution",
            extra={
                "execution_id": result.execution_id,
                "workflow": result.workflow,
                "prompt": prompt.ref,
                "outcome": result.outcome,
                "attempts": result.attempts,
                "input_tokens": result.input_tokens,
                "output_tokens": result.output_tokens,
                "cost_gbp": str(result.cost_gbp),
            },
        )
        for recorder in self.recorders:
            recorder(result)
        return result
