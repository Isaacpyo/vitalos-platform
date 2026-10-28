"""Deterministic supplier-statement parser. Pure Python, runs before any model.

Supported layouts (``PARSER_VERSION``):

* ``csv``: a CSV export whose header has Date, Reference, Type and Amount (optional Balance and
  Description). Rows typed "Opening balance" / "Balance b/f" and "Closing balance" set the balances.
* ``printed``: a fixed-width printed statement whose header line names Date, Ref(erence), Details
  and Debit/Credit (or Amount) and Balance columns. Amounts are assigned to a column by position.

Every line keeps its 1-based source line number. A line that carries an amount but matches no
layout (and is not a recognised balance line) is returned as **unparsed** with its line number:
it goes to the model path when that is enabled, otherwise to a reviewer. Lines without an amount
(titles, addresses, notes) are ignored here; the injection scanner still reads them.
"""

from __future__ import annotations

import csv
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal

from .values import amounts_in, normalise_reference, normalise_type, parse_amount, parse_date, signed

PARSER_VERSION = "statement_rules@1"
_OPENING = re.compile(r"\b(opening balance|balance b/?f|brought forward)\b", re.IGNORECASE)
_CLOSING = re.compile(
    r"\b(closing balance|balance c/?f|carried forward|balance due|amount due|total due|balance outstanding)\b",
    re.IGNORECASE,
)
_PRINTED_ROW = re.compile(
    r"^\s*(?P<date>\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(?P<ref>\S+)\s+(?P<rest>.*)$"
)


@dataclass(frozen=True)
class StatementLine:
    source_line: int
    date: date
    reference: str
    type: str
    amount: Decimal
    origin: str = "rules"  # "rules" or "model"

    @property
    def norm_ref(self) -> str:
        return normalise_reference(self.reference)

    @property
    def signed_amount(self) -> Decimal:
        return signed(self.type, self.amount)

    def to_dict(self) -> dict:
        return {
            "source_line": self.source_line,
            "date": self.date.isoformat(),
            "reference": self.reference,
            "type": self.type,
            "amount": str(self.amount),
            "origin": self.origin,
        }


@dataclass
class ParsedStatement:
    layout: str = "unknown"
    lines: list[StatementLine] = field(default_factory=list)
    unparsed: list[tuple[int, str]] = field(default_factory=list)
    opening_balance: Decimal | None = None
    opening_line: int | None = None
    closing_balance: Decimal | None = None
    closing_line: int | None = None


def _balance_line(parsed: ParsedStatement, number: int, text: str) -> bool:
    """Record an opening/closing balance line. True when the line was one."""
    amounts = amounts_in(text)
    if not amounts:
        return False
    if _OPENING.search(text):
        parsed.opening_balance, parsed.opening_line = amounts[-1][0], number
        return True
    if _CLOSING.search(text):
        parsed.closing_balance, parsed.closing_line = amounts[-1][0], number
        return True
    return False


def _other_line(parsed: ParsedStatement, number: int, text: str) -> None:
    """A line outside the table: a balance line, an unreadable amount-bearing line, or plain text."""
    if text.strip() and not _balance_line(parsed, number, text) and amounts_in(text):
        parsed.unparsed.append((number, text))


def _csv_header(cells: list[str]) -> dict[str, int] | None:
    names = [cell.strip().lower() for cell in cells]
    aliases = {"ref": "reference", "transaction type": "type", "value": "amount"}
    names = [aliases.get(name, name) for name in names]
    if all(name in names for name in ("date", "reference", "type", "amount")):
        return {name: i for i, name in enumerate(names)}
    return None


def _parse_csv(rows: list[tuple[int, str]], header_at: int, columns: dict[str, int]) -> ParsedStatement:
    parsed = ParsedStatement(layout="csv")
    last_running: tuple[Decimal, int] | None = None
    for number, text in rows:
        if number < header_at:
            _other_line(parsed, number, text)
            continue
        if number == header_at or not text.strip():
            continue
        try:
            cells = next(csv.reader([text]))
        except (csv.Error, StopIteration):
            cells = []
        if len(cells) < len(columns):
            if not _balance_line(parsed, number, text) and amounts_in(text):
                parsed.unparsed.append((number, text))
            continue
        kind = cells[columns["type"]].strip()
        amount = parse_amount(cells[columns["amount"]])
        if _OPENING.search(kind) and amount is not None:
            parsed.opening_balance, parsed.opening_line = amount, number
            continue
        if _CLOSING.search(kind) and amount is not None:
            parsed.closing_balance, parsed.closing_line = amount, number
            continue
        when = parse_date(cells[columns["date"]])
        type_ = normalise_type(kind)
        reference = cells[columns["reference"]].strip()
        if when is None or type_ is None or amount is None or not reference:
            if amounts_in(text) or amount is not None:
                parsed.unparsed.append((number, text))
            continue
        parsed.lines.append(StatementLine(number, when, reference, type_, amount))
        if "balance" in columns:
            running = parse_amount(cells[columns["balance"]])
            if running is not None:
                last_running = (running, number)
    if parsed.closing_balance is None and last_running is not None:
        parsed.closing_balance, parsed.closing_line = last_running
    return parsed


def _printed_columns(header: str) -> dict[str, tuple[int, int]] | None:
    lower = header.lower()
    if "," in header or "date" not in lower or not re.search(r"\bref(erence)?\b", lower):
        return None
    columns: dict[str, tuple[int, int]] = {}
    for name in ("debit", "credit", "amount", "balance"):
        match = re.search(rf"\b{name}\b", lower)
        if match:
            columns[name] = (match.start(), match.end())
    if not ({"debit", "credit"} & columns.keys() or "amount" in columns):
        return None
    return columns


def _parse_printed(rows: list[tuple[int, str]], header_at: int, columns: dict[str, tuple[int, int]]):
    parsed = ParsedStatement(layout="printed")
    last_running: tuple[Decimal, int] | None = None
    for number, text in rows:
        if number < header_at:
            _other_line(parsed, number, text)
            continue
        if number == header_at or not text.strip():
            continue
        match = _PRINTED_ROW.match(text)
        amounts = amounts_in(text)
        if not match:
            if not _balance_line(parsed, number, text) and amounts:
                parsed.unparsed.append((number, text))
            continue
        # Assign each amount to the column whose header ends nearest the amount's end (right-aligned).
        by_column: dict[str, Decimal] = {}
        for value, _start, end in amounts:
            column = min(columns, key=lambda name: abs(columns[name][1] - end))
            if column in by_column:
                by_column = {}
                break
            by_column[column] = value
        details = match.group("rest").lower()
        reference = match.group("ref")
        if _OPENING.search(details) or reference.upper() in ("B/F", "BF", "BAL"):
            value = by_column.get("balance") or (amounts[-1][0] if amounts else None)
            if value is not None:
                parsed.opening_balance, parsed.opening_line = value, number
                continue
        when = parse_date(match.group("date"))
        money = [by_column[name] for name in ("debit", "credit", "amount") if name in by_column]
        if when is None or len(money) != 1:
            if amounts:
                parsed.unparsed.append((number, text))
            continue
        if re.search(r"\bcredit\b", details):
            type_ = "credit"
        elif re.search(r"\b(payment|paid|receipt|bacs|remittance)\b", details):
            type_ = "payment"
        elif re.search(r"\b(invoice|inv)\b", details):
            type_ = "invoice"
        elif "debit" in by_column:
            type_ = "invoice"
        elif "credit" in by_column:
            type_ = "credit" if "credit" in details else "payment"
        else:
            parsed.unparsed.append((number, text))
            continue
        parsed.lines.append(StatementLine(number, when, reference, type_, money[0]))
        if "balance" in by_column:
            last_running = (by_column["balance"], number)
    if parsed.closing_balance is None and last_running is not None:
        parsed.closing_balance, parsed.closing_line = last_running
    return parsed


def parse_statement(text: str) -> ParsedStatement:
    rows = list(enumerate(text.splitlines(), start=1))
    for number, line in rows:
        if "," in line:
            try:
                cells = next(csv.reader([line]))
            except (csv.Error, StopIteration):
                continue
            columns = _csv_header(cells)
            if columns:
                return _parse_csv(rows, number, columns)
        printed = _printed_columns(line)
        if printed:
            return _parse_printed(rows, number, printed)
    parsed = ParsedStatement(layout="unknown")
    for number, line in rows:
        _other_line(parsed, number, line)
    return parsed
