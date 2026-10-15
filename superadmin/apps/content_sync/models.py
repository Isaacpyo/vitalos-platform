"""Outbox, site state, homepage sections, slug redirects and uploaded media (ADR-035, ADR-036).

``SyncEvent`` is the transactional outbox: every content mutation inserts one in the same transaction as
the change, its revision and its audit row, and it is delivered to the website after commit.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from . import copy
from .choices import Entity, RedirectEntity


class SyncEvent(models.Model):
    class Kind(models.TextChoices):
        PUBLISH = "publish", "Publish"
        REMOVE = "remove", "Remove"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity = models.CharField(max_length=20, choices=Entity.choices)
    entity_id = models.CharField(max_length=64, blank=True)
    action = models.CharField(max_length=40)
    kind = models.CharField(max_length=10, choices=Kind.choices)
    # Shown in alerts ("Site sync failed for {title}") and on the sync page. Never personal data.
    title = models.CharField(max_length=200, blank=True)
    tags = models.JSONField(default=list)
    paths = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    attempts = models.PositiveIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    # An error code only ("timeout", "http_502"), never a response body.
    last_error = models.CharField(max_length=60, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    delivered_targets = models.JSONField(default=list, blank=True)
    alerted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["delivered_at", "next_attempt_at"], name="content_syn_pending_idx"),
            models.Index(fields=["entity", "entity_id", "-created_at"], name="content_syn_entity_idx"),
        ]

    def __str__(self):
        return f"{self.action} {self.entity_id}"

    @property
    def is_delivered(self) -> bool:
        return self.delivered_at is not None


class SlugRedirect(models.Model):
    """An old public slug and the item it now belongs to; the website answers 308 to the current slug."""

    entity = models.CharField(max_length=10, choices=RedirectEntity.choices)
    from_slug = models.CharField(max_length=80)
    to_id = models.UUIDField()
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["entity", "from_slug"], name="content_sync_redirect_unique")
        ]

    def __str__(self):
        return f"{self.entity}:{self.from_slug} -> {self.to_id}"


class SiteSettings(models.Model):
    """Single row: whether Insights and Careers are public (both off), and the Insights page copy."""

    insights_open = models.BooleanField(default=False)
    careers_open = models.BooleanField(default=False)
    # Seeded with the approved copy (brief section 2). No model defaults, so copy edits need no migration.
    insights_heading = models.CharField(max_length=200, blank=True)
    insights_intro = models.CharField(max_length=500, blank=True)
    insights_editorial_note = models.CharField(max_length=1000, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        verbose_name = "site settings"
        verbose_name_plural = "site settings"

    def __str__(self):
        return "Site settings"

    @classmethod
    def load(cls) -> "SiteSettings":
        obj, _ = cls.objects.get_or_create(
            pk=1,
            defaults={
                "insights_heading": copy.INSIGHTS_HEADING,
                "insights_intro": copy.INSIGHTS_INTRO,
                "insights_editorial_note": copy.EDITORIAL_NOTE,
            },
        )
        return obj


class SiteSection(models.Model):
    """Homepage sections (brief 5.6 and 6.5). ``config`` is validated with defaults in sections.py."""

    class Key(models.TextChoices):
        HOME_INSIGHTS = "home_insights", "Homepage: Insights"
        HOME_CAREERS = "home_careers", "Homepage: Careers"

    key = models.CharField(max_length=20, choices=Key.choices, unique=True)
    config = models.JSONField(default=dict, blank=True)
    updated_at = models.DateTimeField(default=timezone.now)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    def __str__(self):
        return self.get_key_display()


class TickState(models.Model):
    """Single row: when the content tick last ran, so the opportunistic tick runs at most once a minute."""

    last_run_at = models.DateTimeField(null=True, blank=True)
    last_finished_at = models.DateTimeField(null=True, blank=True)
    last_result = models.JSONField(default=dict, blank=True)
    # The nightly part of the tick (retention, orphan purge) runs once per London day.
    last_daily_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return "Tick state"

    @classmethod
    def load(cls) -> "TickState":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class MediaAsset(models.Model):
    """A post or author image in public media storage, with the dimensions read at upload."""

    class Purpose(models.TextChoices):
        COVER = "cover", "Cover"
        INLINE = "inline", "Body image"
        AVATAR = "avatar", "Author photo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=200, unique=True)
    content_type = models.CharField(max_length=40)
    size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    purpose = models.CharField(max_length=10, choices=Purpose.choices)
    alt = models.CharField(max_length=300, blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.key
