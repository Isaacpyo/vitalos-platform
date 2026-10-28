"""Model price table and cost estimates (CORE-06). Decimal arithmetic only, never float.

The table is configuration (``pricing_table.json``) with a "last checked / estimate" label: prices are
per one million tokens in the provider's currency, converted to GBP with a stated FX assumption.
An unknown model gets a deliberately high default price so budget checks err on the safe side.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from functools import cache
from pathlib import Path

TABLE_PATH = Path(__file__).resolve().parent / "pricing_table.json"
MILLION = Decimal(1_000_000)
GBP_QUANTUM = Decimal("0.000001")


@dataclass(frozen=True)
class ModelPrice:
    model: str
    input_per_mtok: Decimal
    output_per_mtok: Decimal
    currency: str
    fx_to_gbp: Decimal
    known: bool
    note: str = ""

    def cost_gbp(self, input_tokens: int, output_tokens: int) -> Decimal:
        native = (
            Decimal(int(input_tokens)) * self.input_per_mtok
            + Decimal(int(output_tokens)) * self.output_per_mtok
        ) / MILLION
        return (native * self.fx_to_gbp).quantize(GBP_QUANTUM, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class PriceTable:
    label: str
    last_checked: str
    fx_to_gbp: dict[str, Decimal]
    default: dict
    models: dict[str, dict]

    def price(self, model: str) -> ModelPrice:
        entry = self.models.get(model)
        known = entry is not None
        entry = entry or self.default
        currency = entry.get("currency", "USD")
        return ModelPrice(
            model=model,
            input_per_mtok=Decimal(str(entry["input_per_mtok"])),
            output_per_mtok=Decimal(str(entry["output_per_mtok"])),
            currency=currency,
            fx_to_gbp=self.fx_to_gbp[currency],
            known=known,
            note=entry.get("note", ""),
        )

    def cost_gbp(self, model: str, input_tokens: int, output_tokens: int) -> Decimal:
        return self.price(model).cost_gbp(input_tokens, output_tokens)


def from_dict(data: dict) -> PriceTable:
    return PriceTable(
        label=data["label"],
        last_checked=data["last_checked"],
        fx_to_gbp={key: Decimal(str(value)) for key, value in data["fx_to_gbp"].items()},
        default=data["default"],
        models=data["models"],
    )


@cache
def default_table() -> PriceTable:
    return from_dict(json.loads(TABLE_PATH.read_text(encoding="utf-8")))


def format_gbp(value: Decimal) -> str:
    """£ with 4 decimals below a penny (model calls are fractions of a penny), else 2."""
    value = Decimal(value)
    if value == 0:
        return "£0.00"
    if abs(value) < Decimal("0.01"):
        return f"£{value.quantize(Decimal('0.0001'), rounding=ROUND_HALF_UP)}"
    return f"£{value.quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)}"
