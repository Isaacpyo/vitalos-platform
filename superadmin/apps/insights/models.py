"""Insights (brief 4.1): posts with a working copy, a published snapshot and immutable revisions.

The editor changes the working copy. ``published_snapshot`` is the exact ``PostDetail`` JSON of the
contract at publish time (``published_summary`` its ``PostSummary``), which is all the read API serves.
Editing a live post never changes the site until someone presses Publish changes.
"""

import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.content_sync.choices import Practice


class PostStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    IN_REVIEW = "in_review", "In review"
    APPROVED = "approved", "Approved"
    SCHEDULED = "scheduled", "Scheduled"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class PostFormat(models.TextChoices):
    EXECUTIVE_BRIEFING = "executive_briefing", "Executive briefing"
    INSIGHT_ARTICLE = "insight_article", "Insight article"
    POINT_OF_VIEW = "point_of_view", "Point of view"
    ENGINEERING_NOTE = "engineering_note", "Engineering note"
    GUIDE = "guide", "Guide"
    RESEARCH_REPORT = "research_report", "Research report"
    CASE_DERIVED_INSIGHT = "case_derived_insight", "Case-derived insight"


FORMAT_PLURALS = {
    PostFormat.EXECUTIVE_BRIEFING: "Executive briefings",
    PostFormat.INSIGHT_ARTICLE: "Insight articles",
    PostFormat.POINT_OF_VIEW: "Points of view",
    PostFormat.ENGINEERING_NOTE: "Engineering notes",
    PostFormat.GUIDE: "Guides",
    PostFormat.RESEARCH_REPORT: "Research reports",
    PostFormat.CASE_DERIVED_INSIGHT: "Case-derived insights",
}


class AuthorKind(models.TextChoices):
    """A person, or an organisation (the Vitalos team) that is accountable for the post as a whole."""

    PERSON = "person", "Person"
    ORGANISATION = "organisation", "Organisation"


class TopicKind(models.TextChoices):
    TOPIC = "topic", "Topic"
    SECTOR = "sector", "Sector"


class CheckKey(models.TextChoices):
    """Editorial checks (brief 4.5). Each is valid only for the revision hash it was ticked on."""

    AUTHORS = "authors", "Authors"
    CLAIMS = "claims", "Claims and figures"
    CITATIONS = "citations", "Citations and links"
    IMAGES = "images", "Images"
    SEO = "seo", "Excerpt and SEO"


CHECK_TEXT = {
    CheckKey.AUTHORS: (
        "A named author is assigned. Every person is confirmed as a real person, and an organisation "
        "author has a recorded founder approval."
    ),
    CheckKey.CLAIMS: "Claims and figures are checked; there are no invented statistics.",
    CheckKey.CITATIONS: "Citations and links are checked.",
    CheckKey.IMAGES: "Images have alt text, and we have the rights to use them.",
    CheckKey.SEO: "The SEO title and SEO description are written (or the defaults accepted).",
}


def _user_fk(**extra):
    return models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+", **extra
    )


class Author(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=12, choices=AuthorKind.choices, default=AuthorKind.PERSON)
    role_title = models.CharField(max_length=120, blank=True)
    bio_md = models.TextField(blank=True)
    avatar_path = models.CharField(max_length=300, blank=True)
    avatar_width = models.PositiveIntegerField(null=True, blank=True)
    avatar_height = models.PositiveIntegerField(null=True, blank=True)
    linkedin_url = models.URLField(max_length=300, blank=True)
    admin_user = _user_fk()
    # A person must be confirmed as real and to have approved their profile before any post with them
    # publishes. For an organisation author the same fields record the founder's approval.
    confirmed_real_by = _user_fk()
    confirmed_real_at = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)
    created_by = _user_fk()
    updated_by = _user_fk()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name

    @property
    def is_confirmed(self) -> bool:
        return self.confirmed_real_at is not None

    @property
    def is_organisation(self) -> bool:
        return self.kind == AuthorKind.ORGANISATION


class Topic(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=80, unique=True)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    kind = models.CharField(max_length=10, choices=TopicKind.choices, default=TopicKind.TOPIC)
    sort = models.IntegerField(default=0)
    # The approved seeds (brief section 2) cannot be deleted while posts use them.
    is_seeded = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["sort", "name"]

    def __str__(self):
        return self.name


class Post(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    slug = models.CharField(max_length=80, unique=True)
    status = models.CharField(max_length=12, choices=PostStatus.choices, default=PostStatus.DRAFT)
    format = models.CharField(max_length=24, choices=PostFormat.choices, default=PostFormat.INSIGHT_ARTICLE)
    title = models.CharField(max_length=200)
    excerpt = models.CharField(max_length=220, blank=True)
    body_md = models.TextField(blank=True)
    cover_path = models.CharField(max_length=300, blank=True)
    cover_alt = models.CharField(max_length=300, blank=True)
    cover_caption = models.CharField(max_length=300, blank=True)
    cover_width = models.PositiveIntegerField(null=True, blank=True)
    cover_height = models.PositiveIntegerField(null=True, blank=True)
    practice = models.CharField(max_length=20, choices=Practice.choices, blank=True)
    featured = models.BooleanField(default=False)
    pin_home = models.BooleanField(default=False)
    cta_label = models.CharField(max_length=80, blank=True)
    cta_href = models.CharField(max_length=300, blank=True)
    seo_title = models.CharField(max_length=200, blank=True)
    seo_description = models.CharField(max_length=320, blank=True)
    canonical_url = models.URLField(max_length=500, blank=True)
    noindex = models.BooleanField(default=False)
    # Ticked by the editor; sets the public "Updated" date on the next publish, then clears.
    material_update = models.BooleanField(default=False)
    publish_at = models.DateTimeField(null=True, blank=True)
    first_published_at = models.DateTimeField(null=True, blank=True)
    last_published_at = models.DateTimeField(null=True, blank=True)
    public_updated_at = models.DateTimeField(null=True, blank=True)
    published_snapshot = models.JSONField(null=True, blank=True)
    published_summary = models.JSONField(null=True, blank=True)
    # The slug the snapshot is served under (it changes only when changes are published).
    published_slug = models.CharField(max_length=80, blank=True, db_index=True)
    published_hash = models.CharField(max_length=64, blank=True)
    published_pin_home = models.BooleanField(default=False)
    published_revision = models.ForeignKey(
        "PostRevision", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    has_unpublished_changes = models.BooleanField(default=False)
    reading_minutes = models.PositiveIntegerField(default=1)
    authors = models.ManyToManyField(Author, through="PostAuthor", related_name="posts", blank=True)
    topics = models.ManyToManyField(Topic, through="PostTopic", related_name="posts", blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    # The working copy's last save, used for conflict detection ("This post changed since you opened it").
    updated_at = models.DateTimeField(default=timezone.now)
    created_by = _user_fk()
    updated_by = _user_fk()
    # Set by `manage.py import_repo_content`: the repo file the draft came from (idempotency key).
    source_path = models.CharField(max_length=300, blank=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        permissions = [("publish_post", "Can approve, publish, schedule and unpublish posts")]
        indexes = [models.Index(fields=["status", "-updated_at"], name="insights_post_status_idx")]

    def __str__(self):
        return self.title

    @property
    def ever_published(self) -> bool:
        return self.first_published_at is not None or bool(self.published_slug)


class PostAuthor(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="author_links")
    author = models.ForeignKey(Author, on_delete=models.PROTECT, related_name="post_links")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position"]
        constraints = [models.UniqueConstraint(fields=["post", "author"], name="insights_post_author_unique")]

    def __str__(self):
        return f"{self.post_id} by {self.author_id}"


class PostTopic(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="topic_links")
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, related_name="post_links")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["post", "topic"], name="insights_post_topic_unique")]

    def __str__(self):
        return f"{self.post_id} in {self.topic_id}"


class PostRelated(models.Model):
    """Manual related posts; without any, related posts fall back to shared topics."""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="related_links")
    related_post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="+")
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["post", "related_post"], name="insights_post_related_unique")
        ]

    def __str__(self):
        return f"{self.post_id} related {self.related_post_id}"


class ImmutableError(Exception):
    pass


class ImmutableQuerySet(models.QuerySet):
    def update(self, **kwargs):
        raise ImmutableError("Revisions are immutable.")

    def delete(self):
        raise ImmutableError("Revisions are immutable.")


class PostRevision(models.Model):
    """One publish: the snapshot as published, who published it and when. Never updated or deleted."""

    post = models.ForeignKey(Post, on_delete=models.PROTECT, related_name="revisions")
    snapshot = models.JSONField()
    body_hash = models.CharField(max_length=64)
    revision_hash = models.CharField(max_length=64)
    published_by = _user_fk()
    published_at = models.DateTimeField(default=timezone.now)
    note = models.CharField(max_length=200, blank=True)

    objects = ImmutableQuerySet.as_manager()

    class Meta:
        ordering = ["-published_at", "-id"]

    def __str__(self):
        return f"{self.post_id} at {self.published_at:%Y-%m-%d %H:%M}"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ImmutableError("Revisions are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ImmutableError("Revisions are immutable.")


class EditorialCheck(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="checks")
    revision_hash = models.CharField(max_length=64)
    check_key = models.CharField(max_length=20, choices=CheckKey.choices)
    checked_by = _user_fk()
    checked_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["checked_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["post", "revision_hash", "check_key"], name="insights_check_unique"
            )
        ]

    def __str__(self):
        return f"{self.check_key} for {self.post_id}"
