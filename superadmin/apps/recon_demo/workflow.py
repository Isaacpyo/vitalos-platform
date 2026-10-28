"""Supplier statement reconciliation workflow (CORE-02 shape, pure Python).

States: CREATED -> RUNNING -> COMPLETED | REVIEW_REQUIRED | FAILED | UNSUPPORTED (CANCELLED exists
for the model but no path here produces it).

1. Validate input first (empty, binary or not UTF-8, oversize, unreadable ledger) -> UNSUPPORTED,
   before any model call.
2. Deterministic statement parser; injection scan.
3. Unparsed lines: the model path when it is on (grounding decides what is accepted), otherwise a
   "needs manual extraction" review item per line.
4. Reconcile against the ledger and check the closing balance (Decimal).
5. COMPLETED only when there is no exception, no unparsed or ungrounded line, no instruction-like
   text and the balance agrees (or is not stated). Otherwise REVIEW_REQUIRED with reasons.
   A provider failure after bounded retries -> FAILED with its category; the run can be retried, or
   continued without the model (those lines then go to manual review).
"""

from __future__ import annotations

import hashlib
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal

from apps.aicore.core.gateway import ModelGateway
from apps.aicore.core.limits import RunContext
from apps.aicore.core.prompts import PromptConfig

from . import injection, reconcile, statement_model
from .ledger import LedgerError, parse_ledger
from .statement_rules import PARSER_VERSION, parse_statement

CREATED, RUNNING, COMPLETED, REVIEW_REQUIRED, FAILED, UNSUPPORTED, CANCELLED = (
    "CREATED",
    "RUNNING",
    "COMPLETED",
    "REVIEW_REQUIRED",
    "FAILED",
    "UNSUPPORTED",
    "CANCELLED",
)
STATES = (CREATED, RUNNING, COMPLETED, REVIEW_REQUIRED, FAILED, UNSUPPORTED, CANCELLED)
FINAL_STATES = (COMPLETED, REVIEW_REQUIRED, FAILED, UNSUPPORTED, CANCELLED)
MAX_STATEMENT_BYTES = 64 * 1024
MAX_LEDGER_BYTES = 64 * 1024
WORKFLOW = "recon_demo.statement_reconciliation"

REASONS = {
    "exceptions_found": "Reconciliation exceptions need a decision.",
    "manual_extraction": "Some statement lines could not be read automatically and need manual extraction.",
    "ungrounded_lines": "The model returned lines that are not on the cited source line; they were rejected.",
    "instruction_like_text": "The statement contains instruction-like text (possible prompt injection).",
    "balance_mismatch": "The closing balance does not agree with the statement lines.",
    "model_refused": "The model call was refused by a control (kill switch or limit).",
}


class RunsDisabled(Exception):
    """The kill switch is off: no run may start."""


@dataclass(frozen=True)
class ModelPath:
    """How unparsed lines are handled. ``gateway`` is None when the model path is off or unavailable."""

    mode: str = "off"  # "off", "live", "simulated" or "replay"
    gateway: ModelGateway | None = None
    prompt: PromptConfig | None = None
    off_reason: str = "The model path is off."

    @property
    def simulated(self) -> bool:
        return self.mode == "simulated"


def config_versions(model_path: ModelPath) -> dict:
    prompt = model_path.prompt if model_path.gateway is not None else None
    return {
        "workflow": WORKFLOW,
        "parser": PARSER_VERSION,
        "reconcile": reconcile.RECONCILE_VERSION,
        "injection": injection.SCANNER_VERSION,
        "model_mode": model_path.mode if model_path.gateway is not None else "off",
        "prompt": prompt.ref if prompt else None,
        "prompt_hash": prompt.content_hash if prompt else None,
        "model": model_path.gateway.provider.model if model_path.gateway is not None else None,
    }


def run_key(statement: bytes, ledger: bytes, versions: dict) -> str:
    digest = hashlib.sha256()
    for part in (statement, b"\0", ledger, b"\0", repr(sorted(versions.items())).encode("utf-8")):
        digest.update(part)
    return digest.hexdigest()


def as_bytes(value: bytes | str) -> bytes:
    return value if isinstance(value, bytes) else value.encode("utf-8")


def _decode(data: bytes, label: str, limit: int) -> tuple[str | None, str]:
    if len(data) > limit:
        return None, f"The {label} is larger than {limit // 1024} KB."
    if b"\0" in data:
        return None, f"The {label} looks like a binary file, not text."
    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError:
        return None, f"The {label} is not UTF-8 text."
    if not text.strip():
        return None, f"The {label} is empty."
    return text, ""


@dataclass
class WorkflowResult:
    state: str
    config_versions: dict
    simulated: bool = False
    reasons: list[dict] = field(default_factory=list)
    unsupported_reason: str = ""
    layout: str = ""
    lines: list[dict] = field(default_factory=list)
    unparsed: list[dict] = field(default_factory=list)
    rejected_model_lines: list[dict] = field(default_factory=list)
    injection_flags: list[dict] = field(default_factory=list)
    reconciliation: list[dict] = field(default_factory=list)
    counts: dict = field(default_factory=dict)
    balance: dict = field(default_factory=dict)
    review_items: list[dict] = field(default_factory=list)
    executions: list[dict] = field(default_factory=list)
    model_calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cost_gbp: str = "0"
    error_category: str = ""
    error_detail: str = ""
    duration_ms: int = 0
    timeline: list[dict] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {name: getattr(self, name) for name in self.__dataclass_fields__}

    def add_reason(self, code: str, detail: str = "") -> None:
        if all(reason["code"] != code for reason in self.reasons):
            self.reasons.append({"code": code, "message": REASONS.get(code, code), "detail": detail})


def execute(
    statement: bytes | str,
    ledger: bytes | str,
    *,
    model_path: ModelPath,
    ctx: RunContext,
    enabled: bool = True,
    clock: Callable[[], float] = time.monotonic,
) -> WorkflowResult:
    if not enabled:
        raise RunsDisabled("The AI & Data demonstrator is switched off (kill switch).")
    started = clock()
    result = WorkflowResult(
        state=RUNNING, config_versions=config_versions(model_path), simulated=model_path.simulated
    )
    result.timeline = [{"state": CREATED, "note": ""}, {"state": RUNNING, "note": ""}]

    def finish(state: str, note: str = "") -> WorkflowResult:
        result.state = state
        result.timeline.append({"state": state, "note": note})
        result.duration_ms = int((clock() - started) * 1000)
        return result

    statement_text, problem = _decode(as_bytes(statement), "statement", MAX_STATEMENT_BYTES)
    if statement_text is None:
        result.unsupported_reason = problem
        return finish(UNSUPPORTED, problem)
    ledger_text, problem = _decode(as_bytes(ledger), "ledger export", MAX_LEDGER_BYTES)
    if ledger_text is None:
        result.unsupported_reason = problem
        return finish(UNSUPPORTED, problem)
    try:
        ledger_entries = parse_ledger(ledger_text)
    except LedgerError as error:
        result.unsupported_reason = "; ".join(error.reasons)
        return finish(UNSUPPORTED, result.unsupported_reason)

    parsed = parse_statement(statement_text)
    result.layout = parsed.layout
    if not parsed.lines and not parsed.unparsed:
        result.unsupported_reason = "No statement lines were found (no amounts in a recognised position)."
        return finish(UNSUPPORTED, result.unsupported_reason)

    flags = injection.scan(statement_text)
    flagged_lines = {flag.source_line for flag in flags}
    result.injection_flags = [flag.to_dict() for flag in flags]
    result.unparsed = [{"source_line": number, "text": text} for number, text in parsed.unparsed]
    lines = list(parsed.lines)
    review: list[dict] = []

    # Unparsed lines: never send instruction-like lines to the model.
    to_model = [(n, t) for n, t in parsed.unparsed if n not in flagged_lines]
    manual: dict[int, str] = {
        n: "Contains instruction-like text; not sent to the model."
        for n, t in parsed.unparsed
        if n in flagged_lines
    }
    if to_model and model_path.gateway is not None and model_path.prompt is not None:
        extraction = statement_model.extract(
            to_model, gateway=model_path.gateway, prompt=model_path.prompt, ctx=ctx
        )
        result.executions = [execution.as_dict() for execution in extraction.executions]
        result.model_calls = sum(execution.attempts for execution in extraction.executions)
        result.input_tokens = sum(execution.input_tokens for execution in extraction.executions)
        result.output_tokens = sum(execution.output_tokens for execution in extraction.executions)
        result.cost_gbp = str(statement_model.total_cost(extraction.executions))
        if extraction.failure is not None:
            failure = extraction.failure
            result.error_category = failure.error_category or failure.outcome
            result.error_detail = failure.detail
            return finish(
                FAILED, f"Model call failed: {failure.outcome} after {failure.attempts} attempt(s)."
            )
        lines.extend(extraction.accepted)
        result.rejected_model_lines = [rejection.to_dict() for rejection in extraction.rejected]
        for rejection in extraction.rejected:
            review.append(
                {
                    "kind": "ungrounded_line",
                    "source_lines": [rejection.source_line] if rejection.source_line else [],
                    "detail": f"Model line {rejection.reference or '?'} {rejection.amount or ''} rejected: {rejection.reason}.",
                }
            )
        if extraction.rejected:
            result.add_reason("ungrounded_lines")
        if extraction.refusal is not None:
            result.add_reason("model_refused", extraction.refusal.detail)
            note = f"Model call refused: {extraction.refusal.detail}"
        else:
            note = "The model returned no grounded line for this source line."
        for number in extraction.not_extracted:
            manual.setdefault(number, note)
    else:
        for number, _text in to_model:
            manual.setdefault(number, model_path.off_reason)

    for number in sorted(manual):
        review.append({"kind": "manual_extraction", "source_lines": [number], "detail": manual[number]})
    if manual:
        result.add_reason("manual_extraction")

    lines.sort(key=lambda line: line.source_line)
    result.lines = [line.to_dict() for line in lines]
    items = reconcile.reconcile(lines, ledger_entries)
    result.reconciliation = [item.to_dict() for item in items]
    result.counts = reconcile.summary(items)
    incomplete = bool(manual) or bool(result.rejected_model_lines)
    balance = reconcile.check_balance(
        lines,
        opening=parsed.opening_balance,
        stated_closing=parsed.closing_balance,
        incomplete=incomplete,
        opening_line=parsed.opening_line,
        closing_line=parsed.closing_line,
    )
    result.balance = balance.to_dict()

    raised = [
        item
        for item in items
        # While statement lines are unread, a ledger item may simply be on one of them: resolve the
        # manual extraction first instead of raising a possibly false exception.
        if item.is_exception and not (incomplete and item.cls == "not_on_statement")
    ]
    for item in raised:
        if item.is_exception:
            review.append(
                {
                    "kind": "exception",
                    "source_lines": [item.source_line] if item.source_line else [],
                    "detail": _exception_detail(item),
                    "class": item.cls,
                    "reference": item.reference,
                }
            )
    if raised:
        result.add_reason("exceptions_found")
    if balance.verdict == "mismatch":
        review.append(
            {
                "kind": "balance_mismatch",
                "source_lines": [balance.closing_line] if balance.closing_line else [],
                "detail": f"Stated closing balance {balance.stated}, computed {balance.computed} "
                f"(difference {balance.difference}).",
            }
        )
        result.add_reason("balance_mismatch")
    for flag in flags:
        review.append(
            {
                "kind": "instruction_like_text",
                "source_lines": [flag.source_line],
                "detail": f"Instruction-like text ({flag.pattern}). It was not acted on.",
            }
        )
    if flags:
        result.add_reason("instruction_like_text")
    result.review_items = review
    if review:
        return finish(REVIEW_REQUIRED, f"{len(review)} item(s) need review.")
    return finish(COMPLETED, "Fully reconciled.")


def _exception_detail(item: reconcile.ReconItem) -> str:
    label = reconcile.CLASS_LABELS[item.cls]
    if item.cls == "amount_mismatch":
        return f"{label}: {item.reference} statement {item.statement_amount}, ledger {item.ledger_amount} (difference {item.difference})."
    if item.cls == "duplicate":
        return f"{label} on the {item.side}: {item.reference} appears more than once."
    amount = item.statement_amount if item.statement_amount is not None else item.ledger_amount
    return f"{label}: {item.type} {item.reference} {amount}."


def total_cost(result: WorkflowResult) -> Decimal:
    return Decimal(result.cost_gbp)
