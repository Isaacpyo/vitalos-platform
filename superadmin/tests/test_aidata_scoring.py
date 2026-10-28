"""AI & Data qualification scorecard maths (blueprint §7.4)."""

from decimal import Decimal

import pytest

from apps.aidata import scoring

FIELDS = [c.field for c in scoring.CRITERIA]


def scores(*values):
    return dict(zip(FIELDS, values, strict=True))


def test_weights_add_up_to_one_hundred():
    assert [c.weight for c in scoring.CRITERIA] == [25, 20, 20, 15, 10, 10]
    assert sum(c.weight for c in scoring.CRITERIA) == 100


@pytest.mark.parametrize(
    ("values", "expected", "band"),
    [
        ((5, 5, 5, 5, 5, 5), Decimal("100.0"), scoring.PROPOSAL),
        ((0, 0, 0, 0, 0, 0), Decimal("0.0"), scoring.DECLINE),
        ((4, 4, 4, 4, 4, 4), Decimal("80.0"), scoring.PROPOSAL),  # boundary: 80 is a proposal candidate
        ((4, 4, 4, 4, 4, 3), Decimal("78.0"), scoring.DISCOVERY),
        ((4, 3, 3, 3, 4, 3), Decimal("67.0"), scoring.DISCOVERY),
        ((4, 3, 3, 3, 3, 3), Decimal("65.0"), scoring.DISCOVERY),  # boundary: 65 needs more discovery
        ((3, 3, 3, 3, 4, 3), Decimal("62.0"), scoring.DECLINE),
        ((5, 4, 4, 4, 4, 4), Decimal("85.0"), scoring.PROPOSAL),
        ((1, 0, 0, 0, 0, 0), Decimal("5.0"), scoring.DECLINE),
        ((0, 0, 0, 1, 0, 0), Decimal("3.0"), scoring.DECLINE),
        ((0, 0, 0, 0, 1, 0), Decimal("2.0"), scoring.DECLINE),
        ((4, 4, 4, 3, 4, 4), Decimal("77.0"), scoring.DISCOVERY),
    ],
)
def test_weighted_score_and_band(values, expected, band):
    result = scoring.evaluate(scores(*values))
    assert result.score == expected
    assert result.score.as_tuple().exponent == -1  # always one decimal place
    assert result.band == band


def test_score_is_a_decimal_rounded_half_up_to_one_place():
    # 3*25 + 4*20 + 2*20 + 5*15 + 1*10 + 3*10 = 310; 310 / 5 = 62.0 exactly.
    assert scoring.compute_score(scores(3, 4, 2, 5, 1, 3)) == Decimal("62.0")
    # 25 + 40 + 60 + 60 + 50 + 0 = 235; 235 / 5 = 47.0, a Decimal with one decimal place, never a float.
    value = scoring.compute_score(scores(1, 2, 3, 4, 5, 0))
    assert isinstance(value, Decimal) and str(value) == "47.0"


def test_band_thresholds_use_decimal_comparison():
    assert scoring.band_for(Decimal("79.9")) == scoring.DISCOVERY
    assert scoring.band_for(Decimal("80.0")) == scoring.PROPOSAL
    assert scoring.band_for(Decimal("64.9")) == scoring.DECLINE
    assert scoring.band_for(Decimal("65.0")) == scoring.DISCOVERY


def test_incomplete_scorecard_is_not_scored():
    result = scoring.evaluate(scores(5, 5, 5, 5, 5, None))
    assert result.score is None and result.band == scoring.NOT_SCORED and result.label == "Not scored"
    assert scoring.evaluate({}).band == scoring.NOT_SCORED


def test_risk_override_blocks_whatever_the_score():
    result = scoring.evaluate(scores(5, 5, 5, 5, 5, 5), risk_override=True)
    assert result.score == Decimal("100.0") and result.band == scoring.BLOCKED
    assert result.label == "Blocked by risk"
    assert scoring.evaluate(scores(None, 1, 1, 1, 1, 1), risk_override=True).band == scoring.BLOCKED


@pytest.mark.parametrize("bad", [6, -1, True, "3", 2.5])
def test_out_of_range_or_wrong_type_is_refused(bad):
    with pytest.raises(ValueError):
        scoring.compute_score(scores(bad, 1, 1, 1, 1, 1))


def test_labels():
    assert scoring.BAND_LABELS == {
        scoring.PROPOSAL: "Proposal candidate",
        scoring.DISCOVERY: "More discovery or narrower scope",
        scoring.DECLINE: "Decline or defer",
        scoring.NOT_SCORED: "Not scored",
        scoring.BLOCKED: "Blocked by risk",
    }
