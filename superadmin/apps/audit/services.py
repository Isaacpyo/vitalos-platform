"""Write audit events. Every caller goes through ``record`` so the shape stays consistent."""

import logging

from apps.core.http import client_ip

from .models import AuditEvent

logger = logging.getLogger(__name__)

# Action names: "<area>.<verb>". Listed here so the Activity filter and tests share one vocabulary.
ACTIONS = {
    "auth.sign_in": "Signed in",
    "auth.sign_in_failed": "Failed sign-in",
    "auth.sign_out": "Signed out",
    "auth.mfa_enrolled": "Enrolled an authenticator",
    "auth.mfa_reset": "Removed their authenticator",
    "auth.password_changed": "Changed their password",
    "auth.password_set": "Set a password from a one-time link",
    "auth.password_reset_requested": "Requested a password reset",
    "auth.setup_link_issued": "Issued a one-time set-password link",
    "users.created": "Created a user",
    "users.role_changed": "Changed a role",
    "users.activated": "Reactivated a user",
    "users.deactivated": "Deactivated a user",
    "users.owner_set": "Set the primary owner",
    "enquiries.viewed": "Viewed an enquiry",
    "enquiries.received": "Received an enquiry message",
    "enquiries.replied": "Replied to an enquiry",
    "enquiries.noted": "Added an internal note",
    "enquiries.status_changed": "Changed an enquiry's status",
    "enquiries.assigned": "Assigned an enquiry",
    "enquiries.updated": "Updated an enquiry",
    "enquiries.exported": "Exported an enquiry",
    "enquiries.anonymised": "Anonymised an enquiry",
    "audit.exported": "Exported the audit trail",
    "email_templates.created": "Created an email template",
    "email_templates.updated": "Edited an email template",
    "email_templates.duplicated": "Duplicated an email template",
    "email_templates.archived": "Archived an email template",
    "email_templates.unarchived": "Restored an archived email template",
    "email_templates.version_restored": "Restored an email template version",
    "email_templates.test_sent": "Sent a test email",
    "email_templates.seeded": "Seeded the email template library",
    "email_templates.unsubscribed": "Unsubscribed from Vitalos email",
    "insights.post_created": "Created an Insights post",
    "insights.post_edited": "Edited an Insights post",
    "insights.post_cover_changed": "Changed a post's cover image",
    "insights.check_ticked": "Ticked an editorial check",
    "insights.check_cleared": "Cleared an editorial check",
    "insights.post_submitted": "Submitted a post for review",
    "insights.post_approved": "Approved a post",
    "insights.post_returned": "Returned a post to draft",
    "insights.post_published": "Published a post",
    "insights.changes_published": "Published a post's changes",
    "insights.post_scheduled": "Scheduled a post",
    "insights.post_unscheduled": "Cancelled a post's schedule",
    "insights.post_unpublished": "Unpublished a post",
    "insights.post_archived": "Archived a post",
    "insights.post_restored": "Restored an archived post",
    "insights.post_deleted": "Deleted a draft post",
    "insights.post_duplicated": "Duplicated a post",
    "insights.revision_restored": "Restored a post revision",
    "insights.author_created": "Added an author",
    "insights.author_updated": "Edited an author",
    "insights.author_photo_changed": "Changed an author's photo",
    "insights.author_confirmed": "Confirmed an author as a real person",
    "insights.author_unconfirmed": "Withdrew an author's confirmation",
    "insights.author_activated": "Activated an author",
    "insights.author_deactivated": "Deactivated an author",
    "insights.topic_created": "Added a topic",
    "insights.topic_updated": "Edited a topic",
    "insights.topic_reordered": "Reordered topics",
    "insights.topic_deleted": "Deleted a topic",
    "insights.batch_imported": "Imported a batch of Insights",
    "careers.role_created": "Created a role",
    "careers.role_edited": "Edited a role",
    "careers.role_opened": "Opened a role",
    "careers.role_reopened": "Reopened a role",
    "careers.role_changes_published": "Published a role's changes",
    "careers.role_paused": "Paused a role",
    "careers.role_closed": "Closed a role",
    "careers.role_archived": "Archived a role",
    "careers.role_duplicated": "Duplicated a role",
    "careers.settings_updated": "Edited the careers settings",
    "careers.application_received": "Received an application",
    "careers.application_stage": "Changed an application's stage",
    "careers.application_assigned": "Assigned an application",
    "careers.application_noted": "Added a note to an application",
    "careers.cv_viewed": "Downloaded a CV",
    "careers.candidate_emailed": "Emailed a candidate",
    "careers.application_deleted": "Deleted an application",
    "careers.application_flagged": "Flagged a hired application for manual retention",
    "careers.upload_purged": "Deleted an unused CV upload",
    "content.imported": "Imported repository content as drafts",
    "content.site_opened": "Opened a section of the website",
    "content.site_closed": "Closed a section of the website",
    "content.resynced": "Resynced the website",
    "content.sync_retried": "Retried a website sync",
    "content.insights_copy_updated": "Edited the Insights page copy",
    "content.home_section_updated": "Edited a homepage section",
    # Relay: summaries never hold message text or visitor email addresses.
    "relay.joined": "Joined a Relay conversation",
    "relay.assigned": "Assigned a Relay conversation",
    "relay.handed_back": "Handed a Relay conversation back to Relay AI",
    "relay.closed": "Closed a Relay conversation",
    "relay.replied": "Replied in a Relay conversation",
    "relay.noted": "Added an internal note to a Relay conversation",
    "relay.deleted": "Deleted a Relay conversation",
    "relay.transcript_copied": "Copied a Relay transcript",
    "relay.knowledge_saved": "Saved a Relay knowledge entry",
    "relay.knowledge_published": "Published a Relay knowledge entry",
    "relay.knowledge_archived": "Archived a Relay knowledge entry",
    "relay.reindexed": "Re-indexed Relay knowledge",
    "relay.faq_synced": "Synced the Master FAQ into Relay",
    "relay.settings_changed": "Changed Relay settings",
    "relay.availability_changed": "Changed Relay availability",
    "relay.preferences_changed": "Changed Relay notification preferences",
}


def record(
    action, *, request=None, actor=None, entity=None, entity_type="", entity_id="", summary="", **metadata
):
    """Append one event. Never raises into the caller: a failed audit write is logged loudly."""
    if actor is None and request is not None and getattr(request, "user", None) is not None:
        actor = request.user if request.user.is_authenticated else None
    if entity is not None:
        entity_type = entity_type or entity._meta.label_lower
        entity_id = entity_id or str(entity.pk)
    ip = client_ip(request) if request is not None else None
    agent = (request.headers.get("User-Agent", "") if request is not None else "")[:300]
    try:
        return AuditEvent.objects.create(
            actor=actor,
            actor_email=getattr(actor, "email", ""),
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id),
            summary=summary[:300],
            metadata=metadata,
            ip=ip or None,
            user_agent=agent,
        )
    except Exception:  # noqa: BLE001 - auditing must not break the action, but must be visible
        logger.exception("Audit write failed", extra={"action": action})
        return None


def previous_sign_in(user):
    """The sign-in before the current one (shown in the user menu), or None."""
    events = AuditEvent.objects.filter(actor=user, action="auth.sign_in").only("created_at", "ip")[:2]
    events = list(events)
    return events[1] if len(events) > 1 else None
