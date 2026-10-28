"""Opportunity qualification scorecard (blueprint §7.4). Pure functions, no Django models.

Six criteria are each scored 0–5 by a person. The score is the weighted sum on a 0–100 scale:
``sum(score / 5 * weight)``, rounded half up to one decimal place with ``Decimal`` (never floats).
A risk override forces the band "Blocked by risk" whatever the numbers say.
"""

from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

MAX_CRITERION = 5


@dataclass(frozen=True)
class Criterion:
    field: str
    label: str
    weight: int


CRITERIA = (
    Criterion("score_problem", "Problem severity and frequency", 25),
    Criterion("score_economic", "Verified economic impact", 20),
    Criterion("score_budget", "Budget and buying authority", 20),
    Criterion("score_data", "Data and integration readiness", 15),
    Criterion("score_feasibility", "Delivery feasibility", 10),
    Criterion("score_reuse", "Reuse and market potential", 10),
)  # Weights add up to 100 (tested).

PROPOSAL = "proposal_candidate"
DISCOVERY = "more_discovery"
DECLINE = "decline_or_defer"
NOT_SCORED = "not_scored"
BLOCKED = "blocked_by_risk"
BAND_LABELS = {
    PROPOSAL: "Proposal candidate",
    DISCOVERY: "More discovery or narrower scope",
    DECLINE: "Decline or defer",
    NOT_SCORED: "Not scored",
    BLOCKED: "Blocked by risk",
}
PROPOSAL_THRESHOLD = Decimal("80")
DISCOVERY_THRESHOLD = Decimal("65")
ONE_DECIMAL = Decimal("0.1")


@dataclass(frozen=True)
class Result:
    score: Decimal | None
    band: str

    @property
    def label(self) -> str:
        return BAND_LABELS[self.band]


def compute_score(scores: dict[str, int | None]) -> Decimal | None:
    """Weighted 0–100 score, or None when any criterion is missing. Raises ValueError out of range."""
    total = Decimal(0)
    for criterion in CRITERIA:
        value = scores.get(criterion.field)
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_CRITERION:
            raise ValueError(f"{criterion.label} must be a whole number from 0 to {MAX_CRITERION}.")
        total += Decimal(value) * criterion.weight
    return (total / MAX_CRITERION).quantize(ONE_DECIMAL, rounding=ROUND_HALF_UP)


def band_for(score: Decimal | None, *, risk_override: bool = False) -> str:
    if risk_override:
        return BLOCKED
    if score is None:
        return NOT_SCORED
    if score >= PROPOSAL_THRESHOLD:
        return PROPOSAL
    if score >= DISCOVERY_THRESHOLD:
        return DISCOVERY
    return DECLINE


def evaluate(scores: dict[str, int | None], *, risk_override: bool = False) -> Result:
    score = compute_score(scores)
    return Result(score=score, band=band_for(score, risk_override=risk_override))
