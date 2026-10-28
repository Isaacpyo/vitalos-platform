"""Vitalos AI & Data: opportunity pipeline, proposed offer prices and the speculative budget (AID-003).

Business rules live in services.py (writes) and selectors.py (reads). Keys for sectors, offers and
budget bands are the shared contract in docs/ai-data/PLAN.md; the website form uses the same keys.
"""

from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from . import scoring

MONEY = {"max_digits": 10, "decimal_places": 2}
NON_NEGATIVE = [MinValueValidator(Decimal("0"))]
SCORE_VALIDATORS = [MinValueValidator(0), MaxValueValidator(scoring.MAX_CRITERION)]


class Sector(models.TextChoices):
    ACCOUNTING = "accounting-bookkeeping", "Accounting and bookkeeping"
    PROPERTY = "property", "Property"
    AUTOMOTIVE = "automotive", "Automotive"
    PROFESSIONAL = "professional-services", "Professional services"
    TRADES = "trades-field-services", "Trades and field services"
    RETAIL = "retail-ecommerce", "Retail and e-commerce"
    OTHER = "other", "Other"


class Offer(models.TextChoices):
    ASSESSMENT = "ai-opportunity-assessment", "AI Opportunity Assessment"
    PROOF_OF_VALUE = "ai-proof-of-value", "AI Proof of Value"
    PRODUCTION = "production-ai-engineering", "Production AI Engineering"
    MANAGED = "managed-ai-operations", "Managed AI Operations"


class BudgetBand(models.TextChoices):
    UNDER_1K = "under-1k", "Under £1,000"
    FROM_1K = "1k-5k", "£1,000–£5,000"
    FROM_5K = "5k-15k", "£5,000–£15,000"
    OVER_15K = "over-15k", "Over £15,000"
    NOT_SURE = "not-sure", "Not sure yet"


class OpportunitySource(models.TextChoices):
    WEBSITE_FORM = "website_form", "Website form"
    REFERRAL = "referral", "Referral"
    OUTBOUND = "outbound", "Outbound"
    PARTNER = "partner", "Partner"
    OTHER = "other", "Other"


class Stage(models.TextChoices):
    NEW = "new", "New"
    REVIEWING = "reviewing", "Reviewing"
    DISCOVERY = "discovery", "Discovery"
    QUALIFIED = "qualified", "Qualified"
    PROPOSAL = "proposal", "Assessment / Proposal"
    WON = "won", "Won"
    LOST = "lost", "Lost"
    ON_HOLD = "on_hold", "On hold"


class PipelineSettings(models.Model):
    """Singleton (pk=1): the OPP- reference counter."""

    next_number = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name_plural = "pipeline settings"

    def __str__(self):
        return "Pipeline settings"

    @classmethod
    def load(cls) -> "PipelineSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Opportunity(models.Model):
    number = models.PositiveIntegerField(unique=True, editable=False)
    title = models.CharField(max_length=200)
    organisation = models.CharField(max_length=200, blank=True)
    sector = models.CharField(max_length=40, choices=Sector.choices, blank=True)
    contact_name = models.CharField(max_length=200, blank=True)
    contact_email = models.EmailField(blank=True)
    contact_role = models.CharField(max_length=120, blank=True)
    source = models.CharField(
        max_length=20, choices=OpportunitySource.choices, default=OpportunitySource.OTHER
    )
    # One opportunity per enquiry: the unique link is what makes intake idempotent.
    enquiry = models.OneToOneField(
        "enquiries.Enquiry", null=True, blank=True, on_delete=models.SET_NULL, related_name="opportunity"
    )
    website_reference = models.CharField(
        max_length=100, blank=True, help_text="The website's VIT-… reference."
    )
    offer = models.CharField(max_length=40, choices=Offer.choices, blank=True)
    stage = models.CharField(max_length=20, choices=Stage.choices, default=Stage.NEW, db_index=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    next_action = models.CharField(max_length=300, blank=True)
    next_action_due = models.DateField(null=True, blank=True, db_index=True)
    problem_summary = models.TextField(blank=True)
    current_tools = models.TextField(blank=True)
    desired_outcome = models.TextField(blank=True)
    timeframe = models.CharField(max_length=120, blank=True)
    budget_band = models.CharField(max_length=20, choices=BudgetBand.choices, blank=True)
    estimated_value = models.DecimalField(**MONEY, null=True, blank=True, validators=NON_NEGATIVE)
    # Qualification scorecard: each 0–5, set by a person. ``score`` is derived (scoring.py).
    score_problem = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score_economic = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score_budget = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score_data = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score_feasibility = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score_reuse = models.PositiveSmallIntegerField(null=True, blank=True, validators=SCORE_VALIDATORS)
    score = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True, editable=False)
    risk_override = models.BooleanField(default=False)
    risk_reason = models.TextField(blank=True)
    outcome_reason = models.TextField(blank=True)
    # Entered by a person when a scope is signed. Never set automatically.
    signed_scope_reference = models.CharField(max_length=200, blank=True)
    customer_summary = models.TextField(blank=True)
    internal_notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)
    stage_changed_at = models.DateTimeField(default=timezone.now)
    discovery_date = models.DateField(null=True, blank=True)
    decision_due = models.DateField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    anonymised_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        verbose_name_plural = "opportunities"

    def __str__(self):
        return f"{self.ref} {self.title}"

    def save(self, *args, **kwargs):
        # The stored score always matches the six criteria (it is only stored so lists can sort by it).
        self.score = scoring.compute_score(self.criterion_scores())
        update_fields = kwargs.get("update_fields")
        if update_fields is not None and "score" not in update_fields:
            kwargs["update_fields"] = [*update_fields, "score"]
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        from django.urls import reverse

        return reverse("aidata:opportunity", args=[self.ref])

    @property
    def ref(self) -> str:
        return f"OPP-{self.number:04d}"

    def criterion_scores(self) -> dict[str, int | None]:
        return {criterion.field: getattr(self, criterion.field) for criterion in scoring.CRITERIA}

    @property
    def scorecard(self) -> scoring.Result:
        return scoring.evaluate(self.criterion_scores(), risk_override=self.risk_override)

    @property
    def is_closed(self) -> bool:
        return self.stage in (Stage.WON, Stage.LOST)


class OpportunityNote(models.Model):
    """Internal only. Never shown to or sent to the customer."""

    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"Note on {self.opportunity_id}"


class StageChange(models.Model):
    """Who moved an opportunity from which stage to which, when and why."""

    opportunity = models.ForeignKey(Opportunity, on_delete=models.CASCADE, related_name="stage_changes")
    from_stage = models.CharField(max_length=20, choices=Stage.choices, blank=True)
    to_stage = models.CharField(max_length=20, choices=Stage.choices)
    reason = models.TextField(blank=True)
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.opportunity_id}: {self.from_stage} → {self.to_stage}"


class PriceBasis(models.TextChoices):
    FIXED = "fixed", "Fixed fee"
    FROM = "from", "From"
    PER_MONTH = "per_month", "Per month (from)"


class PriceStatus(models.TextChoices):
    PROPOSED = "proposed", "Proposed"
    VALIDATED = "validated", "Validated"


class OfferPrice(models.Model):
    """A proposed commercial assumption (AID-006). Not published on the website."""

    key = models.CharField(max_length=40, choices=Offer.choices, unique=True)
    name = models.CharField(max_length=120)
    price = models.DecimalField(**MONEY, validators=NON_NEGATIVE)
    basis = models.CharField(max_length=12, choices=PriceBasis.choices, default=PriceBasis.FIXED)
    status = models.CharField(max_length=12, choices=PriceStatus.choices, default=PriceStatus.PROPOSED)
    notes = models.TextField(blank=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.name


class BudgetCategory(models.TextChoices):
    OUTREACH = "outreach", "Outreach and acquisition"
    AI_API = "ai-api", "AI API and prototyping"
    INFRASTRUCTURE = "infrastructure", "Infrastructure and engineering"
    WEBSITE = "website", "Website and presence"
    CONTRACTS = "contracts", "Contracts and admin"
    CONTINGENCY = "contingency", "Contingency"


#: BudgetSettings field holding each category's ceiling.
CEILING_FIELDS = {
    BudgetCategory.OUTREACH: "ceiling_outreach",
    BudgetCategory.AI_API: "ceiling_ai_api",
    BudgetCategory.INFRASTRUCTURE: "ceiling_infrastructure",
    BudgetCategory.WEBSITE: "ceiling_website",
    BudgetCategory.CONTRACTS: "ceiling_contracts",
    BudgetCategory.CONTINGENCY: "ceiling_contingency",
}


class BudgetSettings(models.Model):
    """Singleton (pk=1): the speculative ceiling (blueprint DEC-011, AID-013) and category ceilings."""

    overall_ceiling = models.DecimalField(**MONEY, default=Decimal("1000"), validators=NON_NEGATIVE)
    ceiling_outreach = models.DecimalField(**MONEY, default=Decimal("200"), validators=NON_NEGATIVE)
    ceiling_ai_api = models.DecimalField(**MONEY, default=Decimal("150"), validators=NON_NEGATIVE)
    ceiling_infrastructure = models.DecimalField(**MONEY, default=Decimal("150"), validators=NON_NEGATIVE)
    ceiling_website = models.DecimalField(**MONEY, default=Decimal("100"), validators=NON_NEGATIVE)
    ceiling_contracts = models.DecimalField(**MONEY, default=Decimal("150"), validators=NON_NEGATIVE)
    ceiling_contingency = models.DecimalField(**MONEY, default=Decimal("250"), validators=NON_NEGATIVE)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "budget settings"

    def __str__(self):
        return "AI & Data budget settings"

    @classmethod
    def load(cls) -> "BudgetSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def ceiling_for(self, category: str) -> Decimal:
        return getattr(self, CEILING_FIELDS[category])


class CostKind(models.TextChoices):
    ACTUAL = "actual", "Actual"
    PLANNED = "planned", "Planned"
    COMMITMENT = "commitment", "Recurring commitment"


class Recurrence(models.TextChoices):
    NONE = "none", "None"
    MONTHLY = "monthly", "Monthly"
    ANNUAL = "annual", "Annual"


class CostEntry(models.Model):
    date = models.DateField()
    category = models.CharField(max_length=20, choices=BudgetCategory.choices)
    supplier = models.CharField(max_length=120)
    description = models.CharField(max_length=300)
    amount = models.DecimalField(**MONEY, validators=NON_NEGATIVE)
    kind = models.CharField(max_length=12, choices=CostKind.choices, default=CostKind.ACTUAL)
    recurrence = models.CharField(max_length=10, choices=Recurrence.choices, default=Recurrence.NONE)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    evidence_link = models.URLField(blank=True, max_length=500)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name_plural = "cost entries"

    def __str__(self):
        return f"{self.date} {self.supplier} £{self.amount}"
