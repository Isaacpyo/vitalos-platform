"""Mail > Outreach: a paced queue of cold emails to leads loaded from a Notion export (DECISIONS 121-126)."""

from django.conf import settings
from django.db import models


class OutreachSettings(models.Model):
    """Single row. The queue is paused until a person presses Start."""

    paused = models.BooleanField(default=True)
    template = models.ForeignKey(
        "email_templates.EmailTemplate", null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    daily_cap = models.PositiveSmallIntegerField(default=15)
    #: The earliest time the next email may go: the last send plus a random gap.
    next_send_at = models.DateTimeField(null=True, blank=True)
    #: Whoever pressed Start: the email goes out under their name, from the outreach mailbox.
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    consecutive_failures = models.PositiveSmallIntegerField(default=0)
    #: Why the queue last paused itself, shown on the page until the next Start.
    last_error = models.CharField(max_length=300, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return "Outreach settings"

    @classmethod
    def load(cls) -> "OutreachSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class Contact(models.Model):
    """One lead's address. An address is held once, ever, so outreach never emails anyone twice."""

    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        SENDING = "sending", "Sending"
        SENT = "sent", "Sent"
        FAILED = "failed", "Failed"
        REMOVED = "removed", "Removed"

    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=60, blank=True)
    business = models.CharField(max_length=200, blank=True)
    entity_type = models.CharField(max_length=40, blank=True)
    #: The Notion "Lead ID", so a sent list can be matched back to Notion.
    lead_ref = models.CharField(max_length=40, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.QUEUED, db_index=True)
    note = models.CharField(max_length=200, blank=True)
    template_key = models.CharField(max_length=100, blank=True)
    imported_at = models.DateTimeField(auto_now_add=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    sent_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["imported_at", "id"]

    def __str__(self):
        return self.business or f"Contact {self.pk}"
