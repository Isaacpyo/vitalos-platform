"""Model path for statement lines the deterministic parser could not read, plus grounding.

Only unparsed lines are sent (never the whole statement, never lines flagged as instruction-like),
in batches, through the AI core gateway with the versioned ``statement_extraction`` prompt. Every
line the model returns is then checked against the source text (**grounding**):

* it must cite a line that was sent;
* its reference must appear on that line;
* its amount must equal an amount printed on that line;
* its date must equal a date printed on that line;
* it must not repeat another accepted line.

A line that fails any check is rejected and becomes a review item. It is never accepted. A sent line
for which no grounded line came back also goes to review ("needs manual extraction").
"""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal

from apps.aicore.core.gateway import GatewayResult, ModelGateway
from apps.aicore.core.limits import RunContext
from apps.aicore.core.prompts import PromptConfig

from .statement_rules import StatementLine
from .values import amounts_in, dates_in, normalise_reference, parse_amount, parse_date

BATCH_SIZE = 40
FAILURE_OUTCOMES = ("timeout", "unavailable", "rejected", "invalid_output")
REFUSED_OUTCOMES = ("disabled", "limit_exceeded")


@dataclass
class Rejection:
    source_line: int | None
    reference: str
    amount: str
    reason: str

    def to_dict(self) -> dict:
        return {
            "source_line": self.source_line,
            "reference": self.reference,
            "amount": self.amount,
            "reason": self.reason,
        }


@dataclass
class ModelExtraction:
    accepted: list[StatementLine] = field(default_factory=list)
    rejected: list[Rejection] = field(default_factory=list)
    not_extracted: list[int] = field(default_factory=list)
    executions: list[GatewayResult] = field(default_factory=list)
    failure: GatewayResult | None = None  # provider failure: the run ends FAILED (retryable)
    refusal: GatewayResult | None = None  # kill switch or a limit: remaining lines go to review


def _contains_reference(text: str, reference: str) -> bool:
    wanted = normalise_reference(reference)
    if not wanted:
        return False
    tokens = [normalise_reference(token) for token in text.replace(",", " ").split()]
    return wanted in tokens or (len(wanted) >= 4 and wanted in normalise_reference(text))


def ground(item: dict, sent: dict[int, str], accepted_keys: set) -> tuple[StatementLine | None, str]:
    """Check one model line against the source. Returns (line, "") or (None, reason)."""
    number = item.get("source_line")
    if number not in sent:
        return None, "cites a line that was not sent for extraction"
    text = sent[number]
    reference = str(item.get("reference", "")).strip()
    amount = parse_amount(str(item.get("amount", "")))
    when = parse_date(str(item.get("date", "")))
    if not _contains_reference(text, reference):
        return None, "reference does not appear on the cited line"
    if amount is None or amount not in {value for value, _s, _e in amounts_in(text)}:
        return None, "amount does not appear on the cited line"
    if when is None or when not in dates_in(text):
        return None, "date does not appear on the cited line"
    key = (number, normalise_reference(reference), amount)
    if key in accepted_keys:
        return None, "repeats another extracted line"
    accepted_keys.add(key)
    return StatementLine(number, when, reference, item["type"], amount, origin="model"), ""


def extract(
    unparsed: list[tuple[int, str]], *, gateway: ModelGateway, prompt: PromptConfig, ctx: RunContext
) -> ModelExtraction:
    extraction = ModelExtraction()
    accepted_keys: set = set()
    covered: set[int] = set()
    batches = [unparsed[i : i + BATCH_SIZE] for i in range(0, len(unparsed), BATCH_SIZE)]
    for batch in batches:
        sent = dict(batch)
        data = "\n".join(f"L{number}: {text}" for number, text in batch)
        result = gateway.run_structured(prompt, data=data, ctx=ctx)
        extraction.executions.append(result)
        if result.outcome in REFUSED_OUTCOMES:
            extraction.refusal = result
            break
        if result.outcome != "success":
            extraction.failure = result
            break
        for item in result.output.get("lines", []):
            line, reason = ground(item, sent, accepted_keys)
            if line is None:
                extraction.rejected.append(
                    Rejection(
                        item.get("source_line"),
                        str(item.get("reference", ""))[:64],
                        str(item.get("amount", ""))[:20],
                        reason,
                    )
                )
            else:
                extraction.accepted.append(line)
                covered.add(line.source_line)
    attempted = {number for batch in batches[: len(extraction.executions)] for number, _ in batch}
    if extraction.failure is None:
        extraction.not_extracted = sorted(
            number
            for number, _ in unparsed
            if number not in covered and (number in attempted or extraction.refusal)
        )
    return extraction


def total_cost(executions: list[GatewayResult]) -> Decimal:
    return sum((result.cost_gbp for result in executions), Decimal("0"))
