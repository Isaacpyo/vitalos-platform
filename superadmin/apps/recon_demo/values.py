"""Value parsing shared by the ledger and statement parsers (pure Python, Decimal only)."""

from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

PENNY = Decimal("0.01")
TYPES = ("invoice", "credit", "payment")
_TYPE_WORDS = {
    "invoice": "invoice",
    "inv": "invoice",
    "purchase invoice": "invoice",
    "bill": "invoice",
    "credit": "credit",
    "credit note": "credit",
    "crn": "credit",
    "cn": "credit",
    "payment": "payment",
    "pmt": "payment",
    "bank payment": "payment",
    "payment received": "payment",
    "bacs": "payment",
}
_AMOUNT = re.compile(r"^\(?-?£?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?\)?$")
# An amount inside a line of text: always two decimals, so dates and references do not match.
AMOUNT_TOKEN = re.compile(r"(?<![\w.,])\(?-?£?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\)?(?![\w.])")
DATE_TOKEN = re.compile(
    r"\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?,?\s+\d{4})\b"
)
_DATE_FORMATS = ("%Y-%m-%d", "%d/%m/%Y", "%d/%m/%y", "%d-%m-%Y", "%d.%m.%Y", "%d %b %Y", "%d %B %Y")


def parse_amount(text: str) -> Decimal | None:
    """A money amount as a positive Decimal with two places, or None. Signs and brackets are dropped:
    the transaction type carries the direction."""
    cleaned = (text or "").strip()
    if not cleaned or not _AMOUNT.match(cleaned):
        return None
    digits = cleaned.strip("()").replace("£", "").replace(",", "").replace(" ", "").lstrip("-")
    try:
        value = Decimal(digits)
    except InvalidOperation:
        return None
    return value.quantize(PENNY)


def amounts_in(text: str) -> list[tuple[Decimal, int, int]]:
    """Every two-decimal amount in ``text`` with its start and end column."""
    found = []
    for match in AMOUNT_TOKEN.finditer(text):
        value = parse_amount(match.group(0))
        if value is not None:
            found.append((value, match.start(), match.end()))
    return found


def parse_date(text: str) -> date | None:
    cleaned = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", (text or "").strip()).replace(",", "").replace(".", " ")
    cleaned = re.sub(r"\s+", " ", cleaned)
    for fmt in _DATE_FORMATS:
        candidate = cleaned if fmt != "%d.%m.%Y" else text.strip()
        try:
            return datetime.strptime(candidate, fmt).date()  # noqa: DTZ007 - calendar dates, no time
        except ValueError:
            continue
    return None


def dates_in(text: str) -> list[date]:
    return [value for value in (parse_date(m.group(0)) for m in DATE_TOKEN.finditer(text)) if value]


def normalise_type(text: str) -> str | None:
    return _TYPE_WORDS.get(re.sub(r"\s+", " ", (text or "").strip().lower()))


def normalise_reference(text: str) -> str:
    """Matching key for a reference: letters and digits only, upper case (INV-1001 == inv 1001)."""
    return re.sub(r"[^A-Za-z0-9]", "", text or "").upper()


def signed(type_: str, amount: Decimal) -> Decimal:
    """Effect on the balance owed to the supplier: invoices add, credits and payments reduce."""
    return amount if type_ == "invoice" else -amount
