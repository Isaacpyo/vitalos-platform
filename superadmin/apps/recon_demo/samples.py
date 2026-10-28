"""Built-in synthetic samples for the demonstrator UI, taken from dataset v1 (fictional suppliers)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from functools import cache
from pathlib import Path

DATASET = Path(__file__).resolve().parent / "datasets" / "v1"


@dataclass(frozen=True)
class Sample:
    key: str
    title: str
    summary: str
    case_path: str  # "<split>/<case id>"
    default_mode: str = "off"  # "off" or "simulated"

    @property
    def folder(self) -> Path:
        return DATASET / self.case_path

    def statement(self) -> bytes:
        return (self.folder / "statement.txt").read_bytes()

    def ledger(self) -> bytes:
        return (self.folder / "ledger.csv").read_bytes()

    @property
    def meta(self) -> dict:
        return json.loads((self.folder / "case.json").read_text(encoding="utf-8"))

    @property
    def simulated_script(self) -> list | None:
        return self.meta.get("simulated_script")

    @property
    def simulated_retry_script(self) -> list | None:
        return self.meta.get("simulated_retry_script")

    @property
    def has_script(self) -> bool:
        return bool(self.simulated_script)


SAMPLES: tuple[Sample, ...] = (
    Sample(
        "clean-csv",
        "Clean statement (CSV export)",
        "Every line matches the ledger and the closing balance agrees.",
        "dev/d01-clean-csv",
    ),
    Sample(
        "clean-printed",
        "Clean statement (printed layout)",
        "Fixed-width printed statement with debit, credit and balance columns.",
        "dev/d02-clean-printed",
    ),
    Sample(
        "missing-mismatch",
        "Missing invoice and amount mismatch",
        "One invoice missing from the ledger, one transposed amount, one ledger item not on the statement.",
        "dev/d03-missing-mismatch-unmatched",
    ),
    Sample(
        "duplicate",
        "Duplicate invoice",
        "The supplier listed the same invoice twice.",
        "dev/d04-duplicate-on-statement",
    ),
    Sample(
        "balance-mismatch",
        "Closing balance mismatch",
        "The stated closing balance does not agree with the lines.",
        "dev/d05-balance-mismatch",
    ),
    Sample(
        "injection",
        "Prompt injection in the statement",
        "Text telling an assistant to mark everything as matched. It is flagged and has no effect.",
        "dev/d06-injection",
    ),
    Sample(
        "unparsed-layout",
        "Layout the parser cannot read",
        "Free-text statement. Rules only: manual extraction. Simulated model path: extracted and grounded.",
        "dev/d08-freeform-model-good",
        default_mode="simulated",
    ),
    Sample(
        "hallucination",
        "Simulated hallucination",
        "Simulated model response with a fabricated invoice and a wrong amount. Grounding rejects both.",
        "dev/d09-freeform-model-hallucination",
        default_mode="simulated",
    ),
    Sample(
        "provider-failure",
        "Simulated provider failure and recovery",
        "Simulated persistent HTTP 5xx: three attempts, then FAILED. Retry (provider recovered) or continue "
        "without the model.",
        "dev/d12-freeform-provider-down",
        default_mode="simulated",
    ),
)


@cache
def by_key() -> dict[str, Sample]:
    return {sample.key: sample for sample in SAMPLES}


def get(key: str) -> Sample | None:
    return by_key().get(key)
