"""The Vitalos company architecture: Company → Service lines → Practices → Solutions → Offers."""

import re
from decimal import Decimal

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.urls import reverse
from django.utils.text import slugify

from apps.core.models import BusinessMode, Classification, GovernedModel

hex_colour_validator = RegexValidator(r"^#[0-9A-Fa-f]{6}$", "Use a six-digit hex colour such as #2457FF.")


def validate_business_modes(value):
    if not isinstance(value, list):
        raise ValidationError("Business modes must be a list.")
    unknown = [mode for mode in value if mode not in BusinessMode.values]
    if unknown:
        raise ValidationError(f"Unknown business mode(s): {', '.join(map(str, unknown))}.")
    if len(set(value)) != len(value):
        raise ValidationError("Business modes must not repeat.")


def ordered_modes(modes) -> list[str]:
    return [mode for mode in BusinessMode.values if mode in (modes or [])]


class AutoSlugMixin:
    """Fill a blank slug from the name before field validation runs."""

    def clean_fields(self, exclude=None):
        if not self.slug and self.name:
            self.slug = slugify(self.name)[:80]
        super().clean_fields(exclude=exclude)


class Company(GovernedModel):
    """Singleton describing Vitalos itself."""

    name = models.CharField(max_length=120)
    tagline = models.CharField(max_length=200, blank=True)
    vision = models.TextField(blank=True)
    mission = models.TextField(blank=True)
    business_modes = models.JSONField(default=list, blank=True, validators=[validate_business_modes])
    classification = models.CharField(
        max_length=16, choices=Classification.choices, default=Classification.PUBLIC
    )
    # Facts for email footers (UK company law: name, number and registered office on business email).
    legal_name = models.CharField(max_length=200, blank=True)
    company_number = models.CharField(max_length=20, blank=True)
    registered_office = models.CharField(max_length=300, blank=True)
    website = models.URLField(blank=True)
    support_email = models.EmailField(blank=True)
    linkedin_url = models.URLField("LinkedIn URL", blank=True)
    x_url = models.URLField("X URL", blank=True)
    instagram_url = models.URLField("Instagram URL", blank=True)
    facebook_url = models.URLField("Facebook URL", blank=True)

    class Meta:
        verbose_name_plural = "company"

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.pk = 1
        self.business_modes = ordered_modes(self.business_modes)
        super().save(*args, **kwargs)

    @classmethod
    def load(cls) -> "Company | None":
        return cls.objects.filter(pk=1).first()


class ServiceLine(AutoSlugMixin, GovernedModel):
    class Icon(models.TextChoices):
        COMPASS = "compass", "Compass"
        CODE = "code", "Code"
        SPARKLES = "sparkles", "Sparkles"
        PEN = "pen", "Pen"
        SHIELD = "shield", "Shield"
        FLASK = "flask", "Flask"
        LAYERS = "layers", "Layers"

    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=80, unique=True)
    tagline = models.CharField(max_length=200, blank=True)
    business_modes = models.JSONField(default=list, blank=True, validators=[validate_business_modes])
    colour = models.CharField(max_length=7, default="#2457FF", validators=[hex_colour_validator])
    icon = models.CharField(max_length=20, choices=Icon.choices, default=Icon.LAYERS)
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="owned_service_lines",
    )

    service_line_path = "pk"

    class Meta:
        ordering = ["order", "name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:80]
        self.business_modes = ordered_modes(self.business_modes)
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse("architecture:service_dashboard", args=[self.slug])

    @property
    def service_line(self):
        return self


class OfferingStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    RETIRED = "retired", "Retired"


class Maturity(models.TextChoices):
    EMERGING = "emerging", "Emerging"
    DEVELOPING = "developing", "Developing"
    ESTABLISHED = "established", "Established"
    LEADING = "leading", "Leading"


class Offering(AutoSlugMixin, GovernedModel):
    """Shared shape of Practice, Solution and Offer (the public taxonomy)."""

    name = models.CharField(max_length=150)
    slug = models.SlugField(max_length=80)
    summary = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=OfferingStatus.choices, default=OfferingStatus.DRAFT)
    maturity = models.CharField(max_length=16, choices=Maturity.choices, default=Maturity.EMERGING)
    order = models.PositiveIntegerField(default=0)
    # The page on the public website, filled by ``sync_architecture_from_web`` (ADR-049).
    public_url = models.URLField(max_length=300, blank=True)

    class Meta:
        abstract = True
        ordering = ["order", "name"]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name)[:80]
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        url = reverse("architecture:service_dashboard", args=[self.service_line.slug])
        return f"{url}?tab=structure#{self._meta.model_name}-{self.pk}"


class Practice(Offering):
    service_line = models.ForeignKey(ServiceLine, on_delete=models.PROTECT, related_name="practices")

    service_line_path = "service_line"

    class Meta(Offering.Meta):
        constraints = [
            models.UniqueConstraint(fields=["service_line", "slug"], name="practice_slug_unique_per_line")
        ]


class Solution(Offering):
    practice = models.ForeignKey(Practice, on_delete=models.PROTECT, related_name="solutions")

    service_line_path = "practice__service_line"

    class Meta(Offering.Meta):
        constraints = [
            models.UniqueConstraint(fields=["practice", "slug"], name="solution_slug_unique_per_practice")
        ]

    @property
    def service_line(self):
        return self.practice.service_line


class Offer(Offering):
    solution = models.ForeignKey(Solution, on_delete=models.PROTECT, related_name="offers")

    service_line_path = "solution__practice__service_line"

    class Meta(Offering.Meta):
        constraints = [
            models.UniqueConstraint(fields=["solution", "slug"], name="offer_slug_unique_per_solution")
        ]

    @property
    def service_line(self):
        return self.solution.practice.service_line


class TeamMember(GovernedModel):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="team_member",
    )
    name = models.CharField(max_length=150)
    role_title = models.CharField(max_length=150, blank=True)
    email = models.EmailField(blank=True)
    service_lines = models.ManyToManyField(ServiceLine, blank=True, related_name="team_members")

    service_line_path = "service_lines"

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["email"], condition=~models.Q(email=""), name="team_member_email_unique"
            )
        ]

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        line = self.service_lines.order_by("order").first() if self.pk else None
        if line is None:
            return reverse("architecture:architecture")
        url = reverse("architecture:service_dashboard", args=[line.slug])
        return f"{url}?tab=team#teammember-{self.pk}"


class Project(GovernedModel):
    class Status(models.TextChoices):
        PIPELINE = "pipeline", "Pipeline"
        ACTIVE = "active", "Active"
        ON_HOLD = "on_hold", "On hold"
        COMPLETED = "completed", "Completed"
        CANCELLED = "cancelled", "Cancelled"

    name = models.CharField(max_length=200)
    client = models.CharField(max_length=200, blank=True)
    service_line = models.ForeignKey(ServiceLine, on_delete=models.PROTECT, related_name="projects")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PIPELINE)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    lead = models.ForeignKey(
        TeamMember, null=True, blank=True, on_delete=models.SET_NULL, related_name="led_projects"
    )
    value = models.DecimalField(
        max_digits=14, decimal_places=2, null=True, blank=True, help_text="Contract value in GBP."
    )
    classification = models.CharField(
        max_length=16, choices=Classification.choices, default=Classification.CONFIDENTIAL
    )

    service_line_path = "service_line"

    class Meta:
        ordering = ["-start_date", "name"]

    def __str__(self):
        return self.name

    def clean(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "End date cannot be before the start date."})
        if self.value is not None and self.value < 0:
            raise ValidationError({"value": "Value cannot be negative."})

    def get_absolute_url(self):
        url = reverse("architecture:service_dashboard", args=[self.service_line.slug])
        return f"{url}?tab=projects#project-{self.pk}"


class KPI(GovernedModel):
    class Direction(models.TextChoices):
        HIGHER = "higher", "Higher is better"
        LOWER = "lower", "Lower is better"

    service_line = models.ForeignKey(ServiceLine, on_delete=models.PROTECT, related_name="kpis")
    name = models.CharField(max_length=150)
    unit = models.CharField(max_length=30, blank=True, help_text="For example %, £k, days, NPS.")
    target = models.DecimalField(max_digits=14, decimal_places=2, null=True, blank=True)
    direction = models.CharField(max_length=8, choices=Direction.choices, default=Direction.HIGHER)
    is_headline = models.BooleanField(default=False, help_text="Shown on the homepage card.")
    order = models.PositiveIntegerField(default=0)

    service_line_path = "service_line"

    class Meta:
        verbose_name = "KPI"
        verbose_name_plural = "KPIs"
        ordering = ["order", "name"]
        constraints = [
            models.UniqueConstraint(fields=["service_line", "name"], name="kpi_name_unique_per_line")
        ]

    def __str__(self):
        return self.name

    def get_absolute_url(self):
        url = reverse("architecture:service_dashboard", args=[self.service_line.slug])
        return f"{url}?tab=kpis#kpi-{self.pk}"

    def is_breach(self, value: Decimal | None) -> bool:
        if value is None or self.target is None:
            return False
        if self.direction == self.Direction.LOWER:
            return value > self.target
        return value < self.target


class KPIValue(GovernedModel):
    kpi = models.ForeignKey(KPI, on_delete=models.PROTECT, related_name="values")
    date = models.DateField()
    value = models.DecimalField(max_digits=14, decimal_places=2)

    service_line_path = "kpi__service_line"

    class Meta:
        verbose_name = "KPI value"
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["kpi", "date"], name="kpi_value_unique_per_date")]

    def __str__(self):
        return f"{self.kpi.name} {self.date:%Y-%m-%d}: {self.value}"

    @property
    def service_line(self):
        return self.kpi.service_line

    def get_absolute_url(self):
        return self.kpi.get_absolute_url()


class Decision(GovernedModel):
    title = models.CharField(max_length=200)
    rationale = models.TextField(blank=True)
    date = models.DateField()
    service_line = models.ForeignKey(
        ServiceLine,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="decisions",
        help_text="Leave empty for a company-wide decision.",
    )
    notion_url = models.URLField(blank=True, verbose_name="Notion URL")

    service_line_path = "service_line"

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return self.title

    def clean(self):
        if self.notion_url and not re.match(r"^https://([a-z0-9-]+\.)?notion\.(so|site)/", self.notion_url):
            raise ValidationError({"notion_url": "Use an https://notion.so or notion.site link."})

    def get_absolute_url(self):
        if self.service_line_id is None:
            return reverse("architecture:architecture")
        url = reverse("architecture:service_dashboard", args=[self.service_line.slug])
        return f"{url}?tab=overview#decision-{self.pk}"


#: Models governed by archive/restore, history, visibility and the activity feed, keyed by name.
GOVERNED_MODELS = {
    "serviceline": ServiceLine,
    "practice": Practice,
    "solution": Solution,
    "offer": Offer,
    "teammember": TeamMember,
    "project": Project,
    "kpi": KPI,
    "kpivalue": KPIValue,
    "decision": Decision,
}
