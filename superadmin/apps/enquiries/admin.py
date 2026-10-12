"""Django admin for enquiries: read-only, for investigation. Day-to-day work happens in the inbox."""

from django.contrib import admin

from .models import (
    Attachment,
    CannedResponse,
    Enquiry,
    EnquiryNote,
    InboxSettings,
    Message,
    NotificationPreference,
    OutboundNotification,
    Tag,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """Writes go through services.py so they are authorised and audited."""

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class MessageInline(admin.TabularInline):
    model = Message
    fields = ("direction", "from_email", "subject", "provider", "delivery_status", "is_auto", "created_at")
    readonly_fields = fields
    extra = 0
    can_delete = False
    show_change_link = True

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(Enquiry)
class EnquiryAdmin(ReadOnlyAdmin):
    list_display = ("ref", "subject", "from_email", "status", "priority", "assignee", "last_message_at")
    list_filter = ("status", "priority", "source")
    search_fields = ("subject", "from_email", "from_name")
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(ReadOnlyAdmin):
    list_display = ("message_id_header", "enquiry", "direction", "provider", "delivery_status", "created_at")
    list_filter = ("direction", "provider", "delivery_status", "is_auto")
    search_fields = ("message_id_header", "provider_message_id", "from_email")
    # The raw HTML is never shown; the inbox renders only the sanitised copy in a sandboxed frame.
    exclude = ("html_body_raw",)


@admin.register(Attachment)
class AttachmentAdmin(ReadOnlyAdmin):
    list_display = ("filename", "content_type", "size_bytes", "refused_reason", "created_at")


@admin.register(EnquiryNote)
class EnquiryNoteAdmin(ReadOnlyAdmin):
    list_display = ("enquiry", "author", "is_system", "created_at")


@admin.register(OutboundNotification)
class OutboundNotificationAdmin(ReadOnlyAdmin):
    list_display = ("event", "recipient", "enquiry", "mode", "created_at", "sent_at")
    list_filter = ("event", "mode")


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(ReadOnlyAdmin):
    list_display = ("user", "event", "channel", "mode")


@admin.register(InboxSettings)
class InboxSettingsAdmin(ReadOnlyAdmin):
    list_display = ("__str__", "next_number", "last_inbound_at", "last_inbound_error_at")


@admin.register(Tag)
class TagAdmin(ReadOnlyAdmin):
    list_display = ("name",)


@admin.register(CannedResponse)
class CannedResponseAdmin(ReadOnlyAdmin):
    list_display = ("title", "created_by", "updated_at")
