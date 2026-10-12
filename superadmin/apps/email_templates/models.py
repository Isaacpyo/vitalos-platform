"""Email templates: the branded library under Mail, with version history and an opt-out list."""

from django.conf import settings
from django.db import models


class Category(models.TextChoices):
    ENQUIRIES = "enquiries", "Enquiries and system"
    SALES = "sales", "Sales pipeline"
    OUTREACH = "outreach", "Outreach"
    SERVICE = "service", "Service-specific"
    DELIVERY = "delivery", "Onboarding and delivery"
    FINANCE = "finance", "Finance"
    RETENTION = "retention", "Retention and growth"
    MARKETING = "marketing", "Marketing"
    INTERNAL = "internal", "Internal notifications"


class Kind(models.TextChoices):
    TRANSACTIONAL = "transactional", "Transactional"
    OUTREACH = "outreach", "Outreach (unsubscribe link)"
    MARKETING = "marketing", "Marketing (unsubscribe link)"
    INTERNAL = "internal", "Internal"


#: Kinds that need a reason-for-contact line and a working unsubscribe link (UK GDPR / PECR).
OPT_OUT_KINDS = (Kind.OUTREACH, Kind.MARKETING)


class Status(models.TextChoices):
    DRAFT = "draft", "Draft"
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class ManagedBy(models.TextChoices):
    LIBRARY = "library", "This library"
    WEBSITE = "website", "Website code"


#: Fields copied into every version snapshot (and restored from it).
CONTENT_FIELDS = (
    "name",
    "category",
    "kind",
    "description",
    "header_label",
    "subject",
    "preheader",
    "reason",
    "footer_notice",
    "blocks",
)


class EmailTemplate(models.Model):
    key = models.SlugField(max_length=100, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=16, choices=Category.choices)
    kind = models.CharField(max_length=16, choices=Kind.choices, default=Kind.TRANSACTIONAL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.DRAFT)
    description = models.CharField(max_length=300, blank=True)
    header_label = models.CharField(max_length=40)
    subject = models.CharField(max_length=200)
    preheader = models.CharField(max_length=200, blank=True)
    reason = models.CharField(
        "reason for contact",
        max_length=300,
        blank=True,
        help_text="Required for outreach and marketing: why the recipient is getting this email.",
    )
    footer_notice = models.CharField(max_length=300, blank=True)
    blocks = models.JSONField(default=list, blank=True)
    managed_by = models.CharField(max_length=10, choices=ManagedBy.choices, default=ManagedBy.LIBRARY)
    seeded = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["category", "name"]

    def __str__(self):
        return self.name

    @property
    def needs_opt_out(self) -> bool:
        return self.kind in OPT_OUT_KINDS

    def content(self) -> dict:
        return {name: getattr(self, name) for name in CONTENT_FIELDS}


class EmailTemplateVersion(models.Model):
    """An immutable snapshot of a template's content, written on every save."""

    template = models.ForeignKey(EmailTemplate, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField()
    content = models.JSONField()
    note = models.CharField(max_length=120, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-number"]
        constraints = [
            models.UniqueConstraint(fields=["template", "number"], name="email_template_version_unique")
        ]

    def __str__(self):
        return f"{self.template.key} v{self.number}"


class EmailSuppression(models.Model):
    """Addresses that unsubscribed from outreach and marketing email. Never emailed by those kinds."""

    email = models.EmailField(unique=True)
    template_key = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.email
