"""Careers (brief 4.2): roles (working copy, published snapshot, immutable revisions), applications,
notes, events and the careers settings row. The roles and applications admin comes in Phase 4.

Applications hold personal data and CVs can hold special-category data (ADR-041): CVs live only in the
private ``careers_cvs`` storage, original filenames are never storage keys, and nothing here is logged.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.content_sync.choices import Practice


class RoleStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    OPEN = "open", "Open"
    PAUSED = "paused", "Paused"
    CLOSED = "closed", "Closed"
    ARCHIVED = "archived", "Archived"


class WorkModel(models.TextChoices):
    REMOTE = "remote", "Remote"
    HYBRID = "hybrid", "Hybrid"
    ON_SITE = "on_site", "On-site"


class EmploymentType(models.TextChoices):
    PERMANENT_FULL_TIME = "permanent_full_time", "Permanent"
    PERMANENT_PART_TIME = "permanent_part_time", "Permanent part-time"
    FIXED_TERM = "fixed_term", "Fixed term"
    CONTRACT = "contract", "Contract"
    ASSOCIATE = "associate", "Associate"


class Level(models.TextChoices):
    L1_ASSOCIATE = "l1_associate", "Associate"
    L2_PROFESSIONAL = "l2_professional", "Professional"
    L3_SENIOR = "l3_senior", "Senior"
    L4_LEAD_STAFF = "l4_lead_staff", "Lead"
    L5_PRINCIPAL = "l5_principal", "Principal"
    L6_DIRECTOR = "l6_director", "Director"
    L7_PARTNER = "l7_partner", "Partner"


class SalaryPeriod(models.TextChoices):
    YEAR = "year", "A year"
    DAY = "day", "A day"


class Sponsorship(models.TextChoices):
    AVAILABLE = "available", "Available"
    NOT_AVAILABLE = "not_available", "Not available"
    NOT_STATED = "not_stated", "Not stated"


class ApplyMode(models.TextChoices):
    FORM = "form", "Application form"
    EXTERNAL = "external", "External URL"


class ApplicationStage(models.TextChoices):
    NEW = "new", "New"
    REVIEWING = "reviewing", "Reviewing"
    INTERVIEW = "interview", "Interview"
    OFFER = "offer", "Offer"
    HIRED = "hired", "Hired"
    REJECTED = "rejected", "Rejected"
    WITHDRAWN = "withdrawn", "Withdrawn"


class RightToWork(models.TextChoices):
    YES = "yes", "Yes"
    NEEDS_SPONSORSHIP = "needs_sponsorship", "I would need sponsorship"
    PREFER_TO_DISCUSS = "prefer_to_discuss", "I'd prefer to discuss"


class ApplicationSource(models.TextChoices):
    CAREERS_PAGE = "careers_page", "Careers page"
    HOMEPAGE = "homepage", "Homepage"
    ROLE_PAGE = "role_page", "Role page"


class ApplicationEventType(models.TextChoices):
    STAGE_CHANGED = "stage_changed", "Stage changed"
    CV_VIEWED = "cv_viewed", "CV viewed"
    ASSIGNED = "assigned", "Assigned"
    NOTE_ADDED = "note_added", "Note added"
    EMAIL_SENT = "email_sent", "Email sent"


def _user_fk(**extra):
    return models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", **extra
    )


class Role(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=80, unique=True)
    status = models.CharField(max_length=10, choices=RoleStatus.choices, default=RoleStatus.DRAFT)
    title = models.CharField(max_length=200)
    practice = models.CharField(max_length=20, choices=Practice.choices, blank=True)
    level = models.CharField(max_length=20, choices=Level.choices, blank=True)
    show_level = models.BooleanField(default=True)
    # Free text entered by the admin; there is no default location.
    location_text = models.CharField(max_length=120, blank=True)
    work_model = models.CharField(max_length=10, choices=WorkModel.choices, blank=True)
    employment_type = models.CharField(max_length=24, choices=EmploymentType.choices, blank=True)
    salary_min = models.PositiveIntegerField(null=True, blank=True)
    salary_max = models.PositiveIntegerField(null=True, blank=True)
    salary_currency = models.CharField(max_length=3, default="GBP")
    salary_period = models.CharField(max_length=4, choices=SalaryPeriod.choices, default=SalaryPeriod.YEAR)
    show_salary = models.BooleanField(default=False)
    summary = models.CharField(max_length=220, blank=True)
    about_md = models.TextField(blank=True)
    responsibilities_md = models.TextField(blank=True)
    requirements_md = models.TextField(blank=True)
    nice_to_have_md = models.TextField(blank=True)
    # Falls back to the careers settings' default hiring process when empty.
    process_md = models.TextField(blank=True)
    sponsorship = models.CharField(max_length=14, choices=Sponsorship.choices, default=Sponsorship.NOT_STATED)
    opens_at = models.DateTimeField(null=True, blank=True)
    closes_at = models.DateTimeField(null=True, blank=True)
    apply_mode = models.CharField(max_length=10, choices=ApplyMode.choices, default=ApplyMode.FORM)
    external_apply_url = models.URLField(max_length=500, blank=True)
    hiring_manager = _user_fk()
    show_on_home = models.BooleanField(default=False)
    sort = models.IntegerField(default=0)
    published_snapshot = models.JSONField(null=True, blank=True)
    published_slug = models.CharField(max_length=80, blank=True, db_index=True)
    published_hash = models.CharField(max_length=64, blank=True)
    # The closing date the public sees (the working copy's changes only count once published).
    published_closes_at = models.DateTimeField(null=True, blank=True)
    published_revision = models.ForeignKey(
        "RoleRevision", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    has_unpublished_changes = models.BooleanField(default=False)
    first_opened_at = models.DateTimeField(null=True, blank=True)
    last_published_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    created_by = _user_fk()
    updated_by = _user_fk()
    # Set by `manage.py import_repo_content`: the repo file the draft came from (idempotency key).
    source_path = models.CharField(max_length=300, blank=True, db_index=True)

    class Meta:
        ordering = ["sort", "-updated_at"]
        permissions = [("publish_role", "Can open, pause, close and publish roles")]
        indexes = [models.Index(fields=["status", "published_closes_at"], name="careers_role_status_idx")]

    def __str__(self):
        return self.title


class ImmutableError(Exception):
    pass


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableError("Revisions are immutable.")

    def delete(self):
        raise ImmutableError("Revisions are immutable.")


class RoleRevision(models.Model):
    role = models.ForeignKey(Role, on_delete=models.PROTECT, related_name="revisions")
    snapshot = models.JSONField()
    revision_hash = models.CharField(max_length=64)
    published_by = _user_fk()
    published_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=200, blank=True)

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        ordering = ["-published_at", "-id"]

    def __str__(self):
        return f"{self.role_id} at {self.published_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ImmutableError("Revisions are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableError("Revisions are immutable.")


class Application(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Null only when speculative applications are enabled (off; CAR-01).
    role = models.ForeignKey(
        Role, null=True, blank=True, on_delete=models.PROTECT, related_name="applications"
    )
    stage = models.CharField(max_length=10, choices=ApplicationStage.choices, default=ApplicationStage.NEW)
    name = models.CharField(max_length=200)
    email = models.EmailField(max_length=254)
    phone = models.CharField(max_length=40, blank=True)
    location_text = models.CharField(max_length=120, blank=True)
    linkedin_url = models.CharField(max_length=300, blank=True)
    portfolio_url = models.CharField(max_length=300, blank=True)
    right_to_work = models.CharField(max_length=20, choices=RightToWork.choices)
    notice_period = models.CharField(max_length=100, blank=True)
    cover_note = models.TextField(blank=True)
    cv_path = models.CharField(max_length=300, blank=True)
    cv_filename = models.CharField(max_length=200, blank=True)
    cv_mime = models.CharField(max_length=100, blank=True)
    cv_size = models.PositiveIntegerField(null=True, blank=True)
    consent_at = models.DateTimeField()
    notice_version = models.CharField(max_length=40, blank=True)
    source = models.CharField(max_length=14, choices=ApplicationSource.choices)
    # Idempotency key from the website (same submission id = same application).
    submission_id = models.UUIDField(unique=True)
    duplicate_of = models.ForeignKey(
        "self", null=True, blank=True, on_delete=models.SET_NULL, related_name="duplicates"
    )
    assigned_admin = _user_fk()
    seen_at = models.DateTimeField(null=True, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    ip_hash = models.CharField(max_length=64, blank=True)
    user_agent = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    # When the hiring team's alert email listed this application (one email per role per 10 minutes).
    alert_emailed_at = models.DateTimeField(null=True, blank=True)
    # Hired applications past retention are flagged for manual handling instead of being deleted.
    retention_flagged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        permissions = [("view_cv", "Can download CVs")]
        indexes = [
            models.Index(fields=["role", "stage", "-created_at"], name="careers_app_role_stage_idx"),
            models.Index(fields=["email"], name="careers_app_email_idx"),
            models.Index(fields=["ip_hash", "created_at"], name="careers_app_ip_idx"),
        ]

    def __str__(self):
        return f"Application {self.pk}"


class ApplicationNote(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="notes")
    admin = _user_fk()
    body = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"Note on {self.application_id}"


class ApplicationEvent(models.Model):
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name="events")
    actor_admin = _user_fk()
    type = models.CharField(max_length=20, choices=ApplicationEventType.choices)
    meta = models.JSONField(default=dict, blank=True)
    at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["at"]

    def __str__(self):
        return f"{self.type} on {self.application_id}"


class CareersSettings(models.Model):
    """Single row: careers page copy and policies (brief 4.2). ``config`` is validated in settings.py."""

    config = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)
    updated_by = _user_fk()

    class Meta:
        verbose_name = "careers settings"
        verbose_name_plural = "careers settings"

    def __str__(self):
        return "Careers settings"


class UploadTicket(models.Model):
    """A single-use permission to upload one CV to ``pending/{id}.{ext}`` (amendment A9, ADR-041).

    ``id`` is the contract's ``uploadId``. With a CV bucket the browser PUTs to a pre-signed URL; without
    one (development) it PUTs to the admin's fallback endpoint with a token whose hash is kept here.
    """

    class Mode(models.TextChoices):
        BUCKET = "bucket", "Pre-signed object storage URL"
        FALLBACK = "fallback", "Admin upload endpoint"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="upload_tickets")
    mode = models.CharField(max_length=10, choices=Mode.choices)
    mime = models.CharField(max_length=100)
    extension = models.CharField(max_length=5)
    size = models.PositiveIntegerField()
    # Sanitised original name, kept for the application; never used as a storage key.
    filename = models.CharField(max_length=200)
    key = models.CharField(max_length=200)
    token_hash = models.CharField(max_length=64, blank=True)
    # Salted hash of the applicant's IP (from the website), for the per-IP ticket cap. Never the raw IP.
    ip_hash = models.CharField(max_length=64, blank=True, db_index=True)
    created_at = models.DateTimeField(default=timezone.now)
    expires_at = models.DateTimeField()
    uploaded_at = models.DateTimeField(null=True, blank=True)
    consumed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=["consumed_at", "created_at"], name="careers_ticket_purge_idx")]

    def __str__(self):
        return f"Upload ticket {self.pk}"


class CareersAlertEmail(models.Model):
    """One internal alert email about new applications to a role (deduplicated to one per 10 minutes)."""

    role = models.ForeignKey(Role, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    sent_at = models.DateTimeField(default=timezone.now, db_index=True)
    recipients = models.PositiveIntegerField(default=0)
    applications = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Careers alert {self.sent_at:%Y-%m-%d %H:%M}"
