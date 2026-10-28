"""Deterministic reconciliation of statement lines against the purchase ledger (Decimal only).

Matching key: transaction type + normalised reference (letters and digits, upper case). Classes:

* ``matched``: on both, same amount.
* ``amount_mismatch``: on both, different amounts (difference = statement - ledger).
* ``missing_from_ledger``: on the statement, not in the ledger.
* ``not_on_statement``: in the ledger, not on the statement.
* ``duplicate``: a second (or later) occurrence of the same key on the statement or in the ledger.

Closing-balance check: opening (0 when not stated) + sum of signed statement lines must equal the
stated closing balance. It is ``incomplete`` when some statement lines could not be extracted.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .ledger import LedgerEntry
from .statement_rules import StatementLine

RECONCILE_VERSION = "reconcile@1"
EXCEPTION_CLASSES = ("amount_mismatch", "missing_from_ledger", "not_on_statement", "duplicate")
CLASS_LABELS = {
    "matched": "Matched",
    "amount_mismatch": "Amount mismatch",
    "missing_from_ledger": "On statement, missing from ledger",
    "not_on_statement": "In ledger, not on statement",
    "duplicate": "Duplicate",
}


@dataclass(frozen=True)
class ReconItem:
    cls: str
    reference: str
    norm_ref: str
    type: str
    statement_amount: Decimal | None
    ledger_amount: Decimal | None
    source_line: int | None
    ledger_row: int | None
    side: str = ""  # for duplicates: "statement" or "ledger"

    @property
    def difference(self) -> Decimal | None:
        if self.statement_amount is None or self.ledger_amount is None:
            return None
        return self.statement_amount - self.ledger_amount

    @property
    def is_exception(self) -> bool:
        return self.cls in EXCEPTION_CLASSES

    def to_dict(self) -> dict:
        return {
            "class": self.cls,
            "reference": self.reference,
            "norm_ref": self.norm_ref,
            "type": self.type,
            "statement_amount": None if self.statement_amount is None else str(self.statement_amount),
            "ledger_amount": None if self.ledger_amount is None else str(self.ledger_amount),
            "difference": None if self.difference is None else str(self.difference),
            "source_line": self.source_line,
            "ledger_row": self.ledger_row,
            "side": self.side,
        }


def reconcile(lines: list[StatementLine], ledger: list[LedgerEntry]) -> list[ReconItem]:
    items: list[ReconItem] = []
    ledger_by_key: dict[tuple[str, str], LedgerEntry] = {}
    for entry in sorted(ledger, key=lambda e: e.row):
        key = (entry.type, entry.norm_ref)
        if key in ledger_by_key:
            items.append(
                ReconItem(
                    "duplicate",
                    entry.reference,
                    entry.norm_ref,
                    entry.type,
                    None,
                    entry.amount,
                    None,
                    entry.row,
                    "ledger",
                )
            )
            continue
        ledger_by_key[key] = entry
    seen: set[tuple[str, str]] = set()
    used: set[tuple[str, str]] = set()
    for line in sorted(lines, key=lambda line: line.source_line):
        key = (line.type, line.norm_ref)
        if key in seen:
            items.append(
                ReconItem(
                    "duplicate",
                    line.reference,
                    line.norm_ref,
                    line.type,
                    line.amount,
                    None,
                    line.source_line,
                    None,
                    "statement",
                )
            )
            continue
        seen.add(key)
        entry = ledger_by_key.get(key)
        if entry is None:
            items.append(
                ReconItem(
                    "missing_from_ledger",
                    line.reference,
                    line.norm_ref,
                    line.type,
                    line.amount,
                    None,
                    line.source_line,
                    None,
                )
            )
            continue
        used.add(key)
        cls = "matched" if entry.amount == line.amount else "amount_mismatch"
        items.append(
            ReconItem(
                cls,
                line.reference,
                line.norm_ref,
                line.type,
                line.amount,
                entry.amount,
                line.source_line,
                entry.row,
            )
        )
    for key, entry in sorted(ledger_by_key.items(), key=lambda kv: kv[1].row):
        if key not in used:
            items.append(
                ReconItem(
                    "not_on_statement",
                    entry.reference,
                    entry.norm_ref,
                    entry.type,
                    None,
                    entry.amount,
                    None,
                    entry.row,
                )
            )
    return items


def summary(items: list[ReconItem]) -> dict:
    counts = {name: 0 for name in CLASS_LABELS}
    for item in items:
        counts[item.cls] += 1
    return counts


@dataclass(frozen=True)
class BalanceCheck:
    verdict: str  # "ok", "mismatch", "not_stated", "incomplete"
    opening: Decimal | None
    computed: Decimal | None
    stated: Decimal | None
    opening_line: int | None = None
    closing_line: int | None = None

    @property
    def difference(self) -> Decimal | None:
        if self.computed is None or self.stated is None:
            return None
        return self.stated - self.computed

    def to_dict(self) -> dict:
        def text(value):
            return None if value is None else str(value)

        return {
            "verdict": self.verdict,
            "opening": text(self.opening),
            "computed": text(self.computed),
            "stated": text(self.stated),
            "difference": text(self.difference),
            "opening_line": self.opening_line,
            "closing_line": self.closing_line,
        }


def check_balance(
    lines: list[StatementLine],
    *,
    opening: Decimal | None,
    stated_closing: Decimal | None,
    incomplete: bool,
    opening_line: int | None = None,
    closing_line: int | None = None,
) -> BalanceCheck:
    computed = (opening or Decimal("0.00")) + sum((line.signed_amount for line in lines), Decimal("0.00"))
    if stated_closing is None:
        return BalanceCheck("not_stated", opening, computed, None, opening_line, closing_line)
    if incomplete:
        return BalanceCheck("incomplete", opening, computed, stated_closing, opening_line, closing_line)
    verdict = "ok" if computed == stated_closing else "mismatch"
    return BalanceCheck(verdict, opening, computed, stated_closing, opening_line, closing_line)
