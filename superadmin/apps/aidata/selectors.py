"""Read rules for AI & Data: who may see and change what, pipeline lists and budget totals."""

from dataclasses import dataclass
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db.models import Case, Count, F, IntegerField, Q, Sum, When
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, has_role, is_superadmin

from .models import (
    BudgetCategory,
    BudgetSettings,
    CostEntry,
    CostKind,
    Offer,
    OfferPrice,
    Opportunity,
    PriceBasis,
    Recurrence,
    Sector,
    Stage,
)

ACTIVE_STAGES = (Stage.NEW, Stage.REVIEWING, Stage.DISCOVERY, Stage.QUALIFIED, Stage.PROPOSAL)
CLOSED_STAGES = (Stage.WON, Stage.LOST)
WARN_RATIO = Decimal("0.8")
#: A recurring commitment counts for one year of payments against the ceiling.
COMMITMENT_PERIODS = {Recurrence.MONTHLY: 12, Recurrence.ANNUAL: 1, Recurrence.NONE: 1}
MAX_QUERY = 100
ZERO = Decimal("0.00")


# --- Access ---------------------------------------------------------------------------------------


def can_access(user) -> bool:
    """Opportunities hold personal data: SuperAdmin and ServiceLead only (as enquiries)."""
    return has_role(user, SUPERADMIN, SERVICE_LEAD)


def can_edit_pipeline(user) -> bool:
    return can_access(user)


def can_edit_prices(user) -> bool:
    return can_access(user) and is_superadmin(user)


def can_edit_budget(user) -> bool:
    return can_access(user) and is_superadmin(user)


def can_reopen(user) -> bool:
    return can_access(user) and is_superadmin(user)


def owners():
    """People who may own an opportunity (SuperAdmin and ServiceLead)."""
    User = get_user_model()
    return (
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name__in=(SUPERADMIN, SERVICE_LEAD)))
        .distinct()
        .order_by("email")
    )


# --- Pipeline -------------------------------------------------------------------------------------


def get_by_ref(ref: str) -> Opportunity | None:
    number = (ref or "").upper().removeprefix("OPP-")
    if not number.isdigit():
        return None
    return Opportunity.objects.select_related("owner", "enquiry").filter(number=int(number)).first()


def for_enquiry(enquiry) -> Opportunity | None:
    return Opportunity.objects.filter(enquiry=enquiry).first()


def overdue_q(today=None) -> Q:
    today = today or timezone.localdate()
    return Q(next_action_due__lt=today, stage__in=(*ACTIVE_STAGES, Stage.ON_HOLD))


def pipeline(*, stage="", owner="", sector="", overdue=False, query=""):
    queryset = Opportunity.objects.select_related("owner", "enquiry")
    if stage in Stage.values:
        queryset = queryset.filter(stage=stage)
    if owner == "none":
        queryset = queryset.filter(owner__isnull=True)
    elif owner.isdigit():
        queryset = queryset.filter(owner_id=int(owner))
    if sector in Sector.values:
        queryset = queryset.filter(sector=sector)
    if overdue:
        queryset = queryset.filter(overdue_q())
    query = (query or "").strip()[:MAX_QUERY]
    if query:
        condition = Q(title__icontains=query) | Q(organisation__icontains=query)
        number = query.upper().removeprefix("OPP-")
        if number.isdigit():
            condition |= Q(number=int(number))
        queryset = queryset.filter(condition)
    # Open work first, soonest next action first (no due date last on every database), then newest.
    closed_last = Case(When(stage__in=CLOSED_STAGES, then=1), default=0, output_field=IntegerField())
    return queryset.order_by(closed_last, F("next_action_due").asc(nulls_last=True), "-created_at")


def board(queryset) -> list[dict]:
    """The pipeline grouped into stage columns, in stage order."""
    columns = {value: {"stage": value, "label": label, "items": []} for value, label in Stage.choices}
    for opportunity in queryset:
        columns[opportunity.stage]["items"].append(opportunity)
    return list(columns.values())


def stage_counts() -> list[dict]:
    counts = dict(Opportunity.objects.values_list("stage").annotate(n=Count("id")))
    return [{"stage": value, "label": label, "count": counts.get(value, 0)} for value, label in Stage.choices]


def overdue(limit=10):
    return Opportunity.objects.filter(overdue_q()).select_related("owner").order_by("next_action_due")[:limit]


def overdue_count() -> int:
    return Opportunity.objects.filter(overdue_q()).count()


# --- Offers ---------------------------------------------------------------------------------------


def offer_prices():
    return OfferPrice.objects.select_related("updated_by").order_by("id")


def default_value_for(offer: str) -> Decimal | None:
    """The proposed price of ``offer`` (the opportunity's default estimated value)."""
    if offer not in Offer.values:
        return None
    price = OfferPrice.objects.filter(key=offer).first()
    return price.price if price else None


def price_label(price: OfferPrice) -> str:
    amount = f"£{price.price:,.2f}".removesuffix(".00")
    if price.basis == PriceBasis.FROM:
        return f"From {amount}"
    if price.basis == PriceBasis.PER_MONTH:
        return f"From {amount} per month"
    return f"{amount} fixed"


# --- Budget ---------------------------------------------------------------------------------------


@dataclass(frozen=True)
class BudgetLine:
    key: str
    label: str
    ceiling: Decimal
    actual: Decimal
    planned: Decimal
    committed: Decimal

    @property
    def used(self) -> Decimal:
        return self.actual + self.planned + self.committed

    @property
    def remaining(self) -> Decimal:
        return self.ceiling - self.used

    @property
    def over_by(self) -> Decimal:
        return max(self.used - self.ceiling, ZERO)

    @property
    def percent(self) -> int:
        if self.ceiling <= 0:
            return 100 if self.used > 0 else 0
        return int(self.used * 100 / self.ceiling)

    @property
    def status(self) -> str:
        """``over`` above the ceiling, ``warn`` from 80 % of it, otherwise ``ok``."""
        if self.used > self.ceiling:
            return "over"
        if self.ceiling > 0 and self.used >= self.ceiling * WARN_RATIO:
            return "warn"
        return "ok"


def entry_exposure(entry: CostEntry) -> Decimal:
    """What an entry counts against the ceiling: a recurring commitment counts for a year."""
    if entry.kind == CostKind.COMMITMENT:
        return entry.amount * COMMITMENT_PERIODS.get(entry.recurrence, 1)
    return entry.amount


def budget_summary() -> dict:
    """Per-category and overall actual, planned, committed and remaining against the ceilings."""
    budget = BudgetSettings.load()
    totals = {(category, kind): ZERO for category in BudgetCategory.values for kind in CostKind.values}
    for row in (
        CostEntry.objects.exclude(kind=CostKind.COMMITMENT)
        .values("category", "kind")
        .annotate(total=Sum("amount"))
    ):
        totals[(row["category"], row["kind"])] = row["total"] or ZERO
    for entry in CostEntry.objects.filter(kind=CostKind.COMMITMENT).only(
        "category", "kind", "amount", "recurrence"
    ):
        totals[(entry.category, CostKind.COMMITMENT)] += entry_exposure(entry)
    lines = [
        BudgetLine(
            key=category,
            label=label,
            ceiling=budget.ceiling_for(category),
            actual=totals[(category, CostKind.ACTUAL)],
            planned=totals[(category, CostKind.PLANNED)],
            committed=totals[(category, CostKind.COMMITMENT)],
        )
        for category, label in BudgetCategory.choices
    ]
    overall = BudgetLine(
        key="overall",
        label="Overall",
        ceiling=budget.overall_ceiling,
        actual=sum((line.actual for line in lines), ZERO),
        planned=sum((line.planned for line in lines), ZERO),
        committed=sum((line.committed for line in lines), ZERO),
    )
    category_total = sum((line.ceiling for line in lines), ZERO)
    return {
        "settings": budget,
        "lines": lines,
        "overall": overall,
        "category_total": category_total,
        "ceilings_mismatch": category_total != budget.overall_ceiling,
    }


def cost_entries():
    return CostEntry.objects.select_related("owner", "created_by").order_by("-date", "-id")
