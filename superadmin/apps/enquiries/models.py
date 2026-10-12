"""Enquiries: the support@vitalos.co.uk inbox and the website contact form, in one queue.

Business rules live in services.py (writes), ingest.py (inbound mail) and selectors.py (reads).
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class Tag(models.Model):
    name = models.CharField(max_length=40, unique=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Enquiry(models.Model):
    class Source(models.TextChoices):
        EMAIL = "email", "Email"
        WEB_FORM = "web_form", "Website form"

    class Status(models.TextChoices):
        NEW = "new", "New"
        OPEN = "open", "Open"
        PENDING = "pending", "Pending customer"
        RESOLVED = "resolved", "Resolved"
        SPAM = "spam", "Spam"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        NORMAL = "normal", "Normal"
        HIGH = "high", "High"
        URGENT = "urgent", "Urgent"

    number = models.PositiveIntegerField(unique=True, editable=False)
    subject = models.CharField(max_length=300, blank=True)
    from_name = models.CharField(max_length=200, blank=True)
    from_email = models.EmailField(db_index=True)
    to_email = models.EmailField(blank=True)
    source = models.CharField(max_length=10, choices=Source.choices, default=Source.EMAIL)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.NEW, db_index=True)
    priority = models.CharField(max_length=10, choices=Priority.choices, default=Priority.NORMAL)
    assignee = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="enquiries"
    )
    tags = models.ManyToManyField(Tag, blank=True, related_name="enquiries")
    unread = models.BooleanField(default=True)
    snippet = models.CharField(max_length=300, blank=True)
    first_response_at = models.DateTimeField(null=True, blank=True)
    last_message_at = models.DateTimeField(default=timezone.now, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    sla_due_at = models.DateTimeField(null=True, blank=True)
    anonymised_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-last_message_at", "-id"]
        verbose_name_plural = "enquiries"

    def __str__(self):
        return f"{self.ref} {self.subject}"

    def get_absolute_url(self):
        from django.urls import reverse

        return reverse("enquiries:detail", args=[self.ref])

    @property
    def ref(self) -> str:
        return f"VIT-{self.number:04d}"

    @property
    def is_open(self) -> bool:
        return self.status in (self.Status.NEW, self.Status.OPEN, self.Status.PENDING)


class Message(models.Model):
    class Direction(models.TextChoices):
        INBOUND = "inbound", "Inbound"
        OUTBOUND = "outbound", "Outbound"

    class Provider(models.TextChoices):
        CLOUDFLARE = "cloudflare", "Cloudflare Email Worker"
        RESEND = "resend", "Resend"
        WEB_FORM = "web_form", "Website form"
        LOG = "log", "Log transport (not sent)"

    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="messages")
    direction = models.CharField(max_length=10, choices=Direction.choices)
    # The RFC 5322 Message-ID (with angle brackets). Unique, so re-delivered mail is ignored.
    message_id_header = models.CharField(max_length=998, unique=True)
    in_reply_to = models.CharField(max_length=998, blank=True)
    references = models.TextField(blank=True)
    from_name = models.CharField(max_length=200, blank=True)
    from_email = models.EmailField()
    to_emails = models.JSONField(default=list, blank=True)
    cc_emails = models.JSONField(default=list, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    text_body = models.TextField(blank=True)
    html_body_raw = models.TextField(blank=True)
    html_body_sanitised = models.TextField(blank=True)
    headers_json = models.JSONField(default=dict, blank=True)
    provider = models.CharField(max_length=12, choices=Provider.choices)
    provider_message_id = models.CharField(max_length=200, blank=True, db_index=True)
    is_auto = models.BooleanField(default=False)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    delivery_status = models.CharField(max_length=20, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.direction} {self.message_id_header}"


class Attachment(models.Model):
    message = models.ForeignKey(Message, on_delete=models.CASCADE, related_name="attachments")
    filename = models.CharField(max_length=255)
    content_type = models.CharField(max_length=127)
    size_bytes = models.PositiveIntegerField()
    # Random key in the attachments storage; empty when the file was refused or not stored.
    storage_key = models.CharField(max_length=200, blank=True)
    sha256 = models.CharField(max_length=64)
    refused_reason = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["id"]

    def __str__(self):
        return self.filename


class EnquiryNote(models.Model):
    """Internal only. Never emailed to the customer."""

    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="notes")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    body = models.TextField()
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"Note on {self.enquiry_id}"


class CannedResponse(models.Model):
    title = models.CharField(max_length=120)
    body_text = models.TextField()
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class InboxSettings(models.Model):
    """Singleton (pk=1): reference counter, SLA, signature, retention and inbound health."""

    next_number = models.PositiveIntegerField(default=1)
    sla_first_response_hours = models.PositiveIntegerField(
        default=8, help_text="Working hours (Mon–Fri, 09:00–17:00 Europe/London). 8 = one working day."
    )
    signature = models.TextField(
        blank=True,
        default="Kind regards,\nVitalos Support\nVitalos Technologies Limited\nhttps://www.vitalos.co.uk",
    )
    retention_months = models.PositiveIntegerField(default=24)
    spam_retention_days = models.PositiveIntegerField(default=30)
    last_inbound_at = models.DateTimeField(null=True, blank=True)
    last_inbound_error = models.CharField(max_length=300, blank=True)
    last_inbound_error_at = models.DateTimeField(null=True, blank=True)
    domain_status = models.CharField(max_length=60, blank=True)
    domain_checked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name_plural = "inbox settings"

    def __str__(self):
        return "Inbox settings"

    @classmethod
    def load(cls) -> "InboxSettings":
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


class NotificationPreference(models.Model):
    class Event(models.TextChoices):
        NEW_ENQUIRY = "new_enquiry", "New enquiry"
        ASSIGNED = "assigned_to_me", "Assigned to me"
        CUSTOMER_REPLY = "customer_reply", "Customer reply on my enquiry"

    class Mode(models.TextChoices):
        INSTANT = "instant", "Instant"
        DIGEST = "daily_digest", "Daily digest (08:00)"
        OFF = "off", "Off"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="enquiry_prefs")
    channel = models.CharField(max_length=10, default="email")
    event = models.CharField(max_length=20, choices=Event.choices)
    mode = models.CharField(max_length=15, choices=Mode.choices, default=Mode.INSTANT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["user", "channel", "event"], name="enquiries_one_pref_per_event")
        ]

    def __str__(self):
        return f"{self.user_id} {self.event} {self.mode}"


class OutboundNotification(models.Model):
    """Outbox for internal notification emails: batched, rate-capped and rolled into digests."""

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    event = models.CharField(max_length=20, choices=NotificationPreference.Event.choices)
    enquiry = models.ForeignKey(Enquiry, on_delete=models.CASCADE, related_name="+")
    mode = models.CharField(max_length=15, choices=NotificationPreference.Mode.choices)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    sent_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]

    def __str__(self):
        return f"{self.event} → {self.recipient_id}"
