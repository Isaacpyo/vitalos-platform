"""Strict parser for the purchase-ledger export (CSV). Pure Python.

Required columns (any order, case-insensitive): ``date``, ``reference``, ``type``, ``amount``. Other
columns (description, supplier) are ignored. Any bad header or row rejects the whole ledger with
reasons: a half-read ledger would make the reconciliation look better than it is.
"""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from .values import normalise_reference, normalise_type, parse_amount, parse_date

REQUIRED = ("date", "reference", "type", "amount")
MAX_ROWS = 5000


@dataclass(frozen=True)
class LedgerEntry:
    row: int  # line number in the file (header is line 1)
    date: date
    reference: str
    type: str
    amount: Decimal
    description: str = ""

    @property
    def norm_ref(self) -> str:
        return normalise_reference(self.reference)

    def to_dict(self) -> dict:
        return {
            "row": self.row,
            "date": self.date.isoformat(),
            "reference": self.reference,
            "type": self.type,
            "amount": str(self.amount),
        }


class LedgerError(ValueError):
    def __init__(self, reasons: list[str]):
        self.reasons = reasons[:5]
        super().__init__("; ".join(self.reasons))


def parse_ledger(text: str) -> list[LedgerEntry]:
    lines = [line for line in text.splitlines()]
    first = next((i for i, line in enumerate(lines) if line.strip()), None)
    if first is None:
        raise LedgerError(["The ledger export is empty."])
    reader = csv.reader(io.StringIO("\n".join(lines[first:])))
    try:
        header = [cell.strip().lower() for cell in next(reader)]
    except (csv.Error, StopIteration):
        raise LedgerError(["The ledger header could not be read as CSV."]) from None
    missing = [name for name in REQUIRED if name not in header]
    if missing:
        raise LedgerError(
            [
                f"The ledger header must include {', '.join(REQUIRED)}; "
                f"missing {', '.join(missing)} (found: {', '.join(header)[:120]})."
            ]
        )
    index = {name: header.index(name) for name in REQUIRED}
    description_index = header.index("description") if "description" in header else None
    entries: list[LedgerEntry] = []
    reasons: list[str] = []
    try:
        for offset, row in enumerate(reader, start=first + 2):
            if not any(cell.strip() for cell in row):
                continue
            if len(row) < len(header):
                reasons.append(f"Ledger line {offset}: expected {len(header)} columns, found {len(row)}.")
                continue
            when = parse_date(row[index["date"]])
            reference = row[index["reference"]].strip()
            type_ = normalise_type(row[index["type"]])
            amount = parse_amount(row[index["amount"]])
            if when is None:
                reasons.append(f"Ledger line {offset}: unreadable date {row[index['date']][:20]!r}.")
            if not reference:
                reasons.append(f"Ledger line {offset}: missing reference.")
            if type_ is None:
                reasons.append(f"Ledger line {offset}: unknown type {row[index['type']][:20]!r}.")
            if amount is None:
                reasons.append(f"Ledger line {offset}: unparseable amount {row[index['amount']][:20]!r}.")
            if when and reference and type_ and amount is not None:
                description = row[description_index].strip() if description_index is not None else ""
                entries.append(LedgerEntry(offset, when, reference, type_, amount, description[:200]))
            if len(entries) > MAX_ROWS:
                raise LedgerError([f"The ledger has more than {MAX_ROWS} rows."])
    except csv.Error:
        raise LedgerError(["The ledger could not be read as CSV."]) from None
    if reasons:
        raise LedgerError(reasons)
    if not entries:
        raise LedgerError(["The ledger export has no entries."])
    return entries
