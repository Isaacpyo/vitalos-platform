"""Invoice arithmetic. Pure functions on integer pence and Decimal: no floats, no database.

Every line total is quantity × unit price rounded half up to the penny; VAT is the subtotal × rate
rounded half up to the penny (once, on the invoice, not per line). ``compute_totals`` is the only
place totals are worked out, for drafts (live) and at issue (stored as snapshots).
"""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

PENNY = Decimal("1")
HUNDRED = Decimal("100")


@dataclass(frozen=True)
class Totals:
    line_totals: tuple[int, ...]
    subtotal: int
    vat_rate: Decimal
    vat: int
    total: int


def line_total_pence(quantity, unit_price_pence) -> int:
    value = Decimal(str(quantity)) * Decimal(int(unit_price_pence))
    return int(value.quantize(PENNY, rounding=ROUND_HALF_UP))


def vat_pence(subtotal_pence: int, rate_percent) -> int:
    value = Decimal(int(subtotal_pence)) * Decimal(str(rate_percent)) / HUNDRED
    return int(value.quantize(PENNY, rounding=ROUND_HALF_UP))


def compute_totals(lines: Iterable[tuple], *, vat_registered: bool, vat_rate=Decimal("0")) -> Totals:
    """``lines`` are (quantity, unit_price_pence) pairs. Not VAT registered: no VAT at any rate."""
    line_totals = tuple(line_total_pence(quantity, price) for quantity, price in lines)
    subtotal = sum(line_totals)
    rate = Decimal(str(vat_rate)).quantize(Decimal("0.01")) if vat_registered else Decimal("0.00")
    vat = vat_pence(subtotal, rate) if vat_registered else 0
    return Totals(line_totals=line_totals, subtotal=subtotal, vat_rate=rate, vat=vat, total=subtotal + vat)


def pounds_to_pence(value) -> int:
    """Decimal pounds (e.g. a form's 1250.5) to integer pence, half up. Refuses floats."""
    if isinstance(value, float):
        raise TypeError("Money must not be a float.")
    try:
        amount = Decimal(str(value)) * HUNDRED
    except InvalidOperation as exc:
        raise ValueError("Not an amount.") from exc
    return int(amount.quantize(PENNY, rounding=ROUND_HALF_UP))


def pence_to_pounds(pence: int) -> Decimal:
    return (Decimal(int(pence)) / HUNDRED).quantize(Decimal("0.01"))


def format_gbp(pence, *, always_pence: bool = True) -> str:
    """£1,234.50 (and −£12.00 for negatives)."""
    if pence is None or pence == "":
        return "—"
    pence = int(pence)
    sign = "−" if pence < 0 else ""
    pounds, rest = divmod(abs(pence), 100)
    text = f"{pounds:,}.{rest:02d}"
    if not always_pence:
        text = text.removesuffix(".00")
    return f"{sign}£{text}"


def format_quantity(quantity) -> str:
    """1.000 → 1, 2.500 → 2.5, 100 → 100 (never 1E+2)."""
    text = f"{Decimal(str(quantity)):f}"
    return text.rstrip("0").rstrip(".") if "." in text else text
