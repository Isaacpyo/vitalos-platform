"""Billing arithmetic: line totals, VAT and rounding in integer pence. No floats anywhere."""

from decimal import Decimal

import pytest

from apps.billing import money


@pytest.mark.parametrize(
    ("quantity", "unit", "expected"),
    [
        (Decimal("1"), 35000, 35000),
        (Decimal("2"), 12550, 25100),
        (Decimal("0.5"), 101, 51),  # 50.5 → 51 (half up, not banker's rounding)
        (Decimal("0.5"), 103, 52),  # 51.5 → 52
        (Decimal("1.333"), 100, 133),  # 133.3 → 133
        (Decimal("0.125"), 4, 1),  # 0.5 → 1
        (Decimal("3"), 0, 0),
    ],
)
def test_line_total_rounds_half_up_to_the_penny(quantity, unit, expected):
    assert money.line_total_pence(quantity, unit) == expected


def test_totals_without_vat_registration_have_no_vat_at_any_rate():
    totals = money.compute_totals(
        [(Decimal("1"), 35000), (Decimal("2"), 12550)], vat_registered=False, vat_rate=Decimal("20")
    )
    assert totals.line_totals == (35000, 25100)
    assert totals.subtotal == 60100
    assert totals.vat == 0
    assert totals.vat_rate == Decimal("0.00")
    assert totals.total == 60100


def test_vat_is_charged_once_on_the_subtotal_and_rounded_half_up():
    # Two 1p lines at 25%: VAT is 0.5p on the 2p subtotal, rounded up to 1p (per-line VAT would give 0p).
    totals = money.compute_totals(
        [(Decimal("1"), 1), (Decimal("1"), 1)], vat_registered=True, vat_rate=Decimal("25")
    )
    assert totals.subtotal == 2
    assert totals.vat == 1  # 0.5 → 1
    assert totals.total == 3
    totals = money.compute_totals([(Decimal("1"), 60100)], vat_registered=True, vat_rate=Decimal("20"))
    assert (totals.subtotal, totals.vat, totals.total) == (60100, 12020, 72120)
    assert totals.vat_rate == Decimal("20.00")


def test_vat_with_fractional_rate():
    totals = money.compute_totals([(Decimal("1"), 9999)], vat_registered=True, vat_rate=Decimal("17.5"))
    assert totals.vat == 1750  # 1749.825 → 1750
    assert totals.total == 11749


def test_pounds_to_pence_refuses_floats_and_rounds_half_up():
    assert money.pounds_to_pence(Decimal("1250.50")) == 125050
    assert money.pounds_to_pence("0.005") == 1
    assert money.pounds_to_pence(Decimal("12")) == 1200
    with pytest.raises(TypeError):
        money.pounds_to_pence(12.5)
    with pytest.raises(ValueError):
        money.pounds_to_pence("twelve")


def test_formatting():
    assert money.format_gbp(123456789) == "£1,234,567.89"
    assert money.format_gbp(5) == "£0.05"
    assert money.format_gbp(-1200) == "−£12.00"
    assert money.format_gbp(None) == "—"
    assert money.format_quantity(Decimal("1.000")) == "1"
    assert money.format_quantity(Decimal("2.500")) == "2.5"
    assert money.format_quantity(Decimal("100")) == "100"
    assert money.pence_to_pounds(125050) == Decimal("1250.50")
