"""Enquiry write rules: references, SLA, replies, triage, export, settings and retention."""

import io
import json
from datetime import timedelta
from pathlib import Path
from unittest import mock

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.files.storage import storages
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER
from apps.audit.models import AuditEvent
from apps.enquiries import ingest, services, sla
from apps.enquiries.models import (
    Attachment,
    CannedResponse,
    Enquiry,
    InboxSettings,
    Message,
    OutboundNotification,
    Tag,
)

FIXTURES = Path(__file__).parent / "fixtures" / "eml"
PDF = b"%PDF-1.4\n%test\n%%EOF\n"


def eml(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


@pytest.fixture
def agent(make_user, settings):
    settings.NOTIFY_OWNER_EMAIL = "owner@example.test"
    make_user(SUPERADMIN, email="owner@example.test")
    return make_user(SUPERADMIN, email="agent@example.test")


@pytest.fixture
def lead(make_user):
    return make_user(SERVICE_LEAD, email="lead@example.test")


def _new(**overrides) -> Enquiry:
    fields = {
        "subject": "Hello",
        "from_name": "Jane",
        "from_email": "jane@customer.example",
        "to_email": "support@vitalos.co.uk",
        "source": Enquiry.Source.EMAIL,
        "snippet": "Hi",
    }
    return services.create_enquiry(**{**fields, **overrides})


def _ingested(name="plain.eml") -> Enquiry:
    message, _ = ingest.ingest(eml(name), provider="cloudflare")
    return message.enquiry


# --- References and SLA -------------------------------------------------------------------------


def test_references_are_allocated_sequentially(db):
    refs = [_new().ref for _ in range(3)]
    assert refs == ["VIT-0001", "VIT-0002", "VIT-0003"]
    assert InboxSettings.load().next_number == 4


def test_reference_counter_never_reuses_a_number(db):
    _new()
    InboxSettings.objects.filter(pk=1).update(next_number=1)
    assert _new().ref == "VIT-0002"


def test_sla_due_is_set_except_for_spam(db):
    enquiry = _new()
    hours = InboxSettings.load().sla_first_response_hours
    assert enquiry.sla_due_at == sla.due_at(enquiry.created_at, hours)
    assert _new(status=Enquiry.Status.SPAM).sla_due_at is None


# --- Replies ------------------------------------------------------------------------------------


def test_reply_threads_and_is_stored(agent, mailoutbox):
    enquiry = _ingested()
    mailoutbox.clear()  # The owner's new-enquiry notification.
    message = services.send_reply(enquiry, body_text="Thanks <Jane>.\n\nHere you go.", actor=agent)
    assert len(mailoutbox) == 1
    sent = mailoutbox[0]
    assert sent.subject == "Re: Question about your consulting services [VIT-0001]"
    assert sent.to == ["jane@customer.example"]
    assert sent.reply_to == ["support@vitalos.co.uk"]
    assert sent.from_email == "Vitalos Support <support@vitalos.co.uk>"
    assert sent.extra_headers["Message-ID"] == message.message_id_header
    assert message.message_id_header.endswith("@vitalos.co.uk>")
    assert sent.extra_headers["In-Reply-To"] == "<plain-1@customer.example>"
    assert sent.extra_headers["References"] == "<plain-1@customer.example>"
    assert "Kind regards" in sent.body
    html, mimetype = sent.alternatives[0]
    assert mimetype == "text/html"
    assert "&lt;Jane&gt;" in html
    assert message.direction == Message.Direction.OUTBOUND
    assert message.provider == Message.Provider.LOG
    assert message.delivery_status == "logged"
    assert message.sent_by == agent
    enquiry.refresh_from_db()
    assert enquiry.status == Enquiry.Status.PENDING
    assert enquiry.first_response_at is not None
    assert not enquiry.unread
    assert AuditEvent.objects.filter(action="enquiries.replied", entity_id="VIT-0001").exists()


def test_reply_to_a_reply_extends_references_without_doubling_the_subject(agent, mailoutbox):
    enquiry = _ingested()
    ingest.ingest(eml("reply.eml"), provider="cloudflare")
    mailoutbox.clear()
    enquiry.subject = "RE: re: Question [VIT-0001]"
    enquiry.save()
    services.send_reply(enquiry, body_text="Yes, we do.", actor=agent, resolve=True)
    sent = mailoutbox[0]
    assert sent.subject == "Re: Question [VIT-0001]"
    assert sent.extra_headers["In-Reply-To"] == "<reply-1@customer.example>"
    assert sent.extra_headers["References"] == "<plain-1@customer.example> <reply-1@customer.example>"
    enquiry.refresh_from_db()
    assert enquiry.status == Enquiry.Status.RESOLVED
    assert enquiry.resolved_at is not None


def test_references_are_capped(db):
    parent = mock.Mock(references=" ".join(f"<id-{n}@x>" for n in range(30)), message_id_header="<last@x>")
    ids = services._references(parent)
    assert len(ids) == services.MAX_REFERENCES
    assert ids[0] == "<id-0@x>"
    assert ids[-1] == "<last@x>"


def test_replies_to_automated_senders_are_refused(agent, mailoutbox):
    auto = _ingested("auto_reply.eml")
    auto.status = Enquiry.Status.OPEN  # Even moved out of spam, the only message is automated.
    auto.save()
    with pytest.raises(ValidationError):
        services.send_reply(auto, body_text="Hello", actor=agent)
    noreply = _new(from_email="noreply@service.example")
    with pytest.raises(ValidationError):
        services.send_reply(noreply, body_text="Hello", actor=agent)
    spam = _new(status=Enquiry.Status.SPAM)
    with pytest.raises(ValidationError):
        services.send_reply(spam, body_text="Hello", actor=agent)
    assert mailoutbox == []
    assert not Message.objects.filter(direction=Message.Direction.OUTBOUND).exists()


def test_reply_attachments_are_checked(agent, mailoutbox):
    enquiry = _ingested()
    mailoutbox.clear()
    good = SimpleUploadedFile("quote.pdf", PDF, content_type="application/pdf")
    bad = SimpleUploadedFile("quote2.pdf", b"MZ\x90\x00 not a pdf", content_type="application/pdf")
    message = services.send_reply(enquiry, body_text="Attached.", actor=agent, files=[good, bad])
    assert [name for name, _, _ in mailoutbox[0].attachments] == ["quote.pdf"]
    stored = Attachment.objects.get(message=message, filename="quote.pdf")
    assert storages["attachments"].exists(stored.storage_key)
    refused = Attachment.objects.get(message=message, filename="quote2.pdf")
    assert refused.refused_reason


def test_send_failures_are_stored_and_raised(agent):
    enquiry = _ingested()
    with (
        mock.patch("django.core.mail.EmailMultiAlternatives.send", side_effect=OSError("down")),
        pytest.raises(services.SendError),
    ):
        services.send_reply(enquiry, body_text="Hello", actor=agent)
    failed = Message.objects.get(direction=Message.Direction.OUTBOUND)
    assert failed.delivery_status == "failed"
    enquiry.refresh_from_db()
    assert enquiry.first_response_at is None
    assert enquiry.status == Enquiry.Status.NEW


def test_viewers_cannot_write(make_user, agent):
    viewer = make_user(VIEWER)
    enquiry = _new()
    with pytest.raises(PermissionDenied):
        services.send_reply(enquiry, body_text="Hi", actor=viewer)
    with pytest.raises(PermissionDenied):
        services.add_note(enquiry, "note", viewer)
    with pytest.raises(PermissionDenied):
        services.record_view(enquiry, viewer, None)


# --- Triage -------------------------------------------------------------------------------------


def test_status_changes_track_resolution(agent):
    enquiry = _new()
    services.set_status(enquiry, Enquiry.Status.RESOLVED, agent)
    assert enquiry.resolved_at is not None
    services.set_status(enquiry, Enquiry.Status.OPEN, agent)
    assert enquiry.resolved_at is None
    with pytest.raises(ValidationError):
        services.set_status(enquiry, "closed", agent)
    assert AuditEvent.objects.filter(action="enquiries.status_changed").count() == 2


def test_assignment_notifies_the_assignee_unless_self_assigned(agent, lead):
    enquiry = _new()
    services.assign(enquiry, agent, agent)
    assert not OutboundNotification.objects.filter(event="assigned_to_me").exists()
    services.assign(enquiry, lead, agent)
    assert OutboundNotification.objects.filter(event="assigned_to_me", recipient=lead).exists()
    assert AuditEvent.objects.filter(action="enquiries.assigned").count() == 2


def test_assignment_requires_an_eligible_user(agent, make_user):
    with pytest.raises(ValidationError):
        services.assign(_new(), make_user(VIEWER), agent)


def test_tags_are_normalised_and_limited(agent):
    enquiry = _new()
    assert services.set_tags(enquiry, ["  Sales ", "sales", "Urgent  Lead"], agent) == [
        "sales",
        "urgent lead",
    ]
    assert sorted(enquiry.tags.values_list("name", flat=True)) == ["sales", "urgent lead"]
    with pytest.raises(ValidationError):
        services.set_tags(enquiry, [f"tag{n}" for n in range(11)], agent)
    with pytest.raises(ValidationError):
        services.set_tags(enquiry, ["x" * 41], agent)
    assert Tag.objects.count() == 2


def test_viewing_is_audited_and_marks_read(agent):
    enquiry = _new()
    services.record_view(enquiry, agent, None)
    enquiry.refresh_from_db()
    assert not enquiry.unread
    assert AuditEvent.objects.filter(action="enquiries.viewed", actor=agent).count() == 1
    services.mark_unread(enquiry, agent)
    enquiry.refresh_from_db()
    assert enquiry.unread


def test_notes_and_priority(agent):
    enquiry = _new()
    note = services.add_note(enquiry, "  Called them  ", agent)
    assert note.body == "Called them"
    with pytest.raises(ValidationError):
        services.add_note(enquiry, "   ", agent)
    services.set_priority(enquiry, Enquiry.Priority.URGENT, agent)
    enquiry.refresh_from_db()
    assert enquiry.priority == "urgent"


def test_export_is_json_serialisable_and_audited(agent):
    enquiry = _ingested("attachment.eml")
    services.add_note(enquiry, "Internal", agent)
    data = services.export_enquiry(enquiry, agent, None)
    json.dumps(data)
    assert data["ref"] == "VIT-0001"
    assert data["messages"][0]["text"].startswith("Please see")
    assert {item["filename"] for item in data["messages"][0]["attachments"]} == {"brief.pdf", "invoice.pdf"}
    assert data["notes"][0]["body"] == "Internal"
    assert AuditEvent.objects.filter(action="enquiries.exported").exists()


# --- Web form -----------------------------------------------------------------------------------


def test_web_form_enquiries_are_rate_limited(db):
    for _ in range(services.WEB_FORM_LIMIT_PER_HOUR):
        enquiry = services.create_web_form_enquiry(
            name="Sam", email="Sam@Example.com", company="Acme", message="Hello"
        )
        assert enquiry is not None
    assert (
        services.create_web_form_enquiry(name="Sam", email="sam@example.com", company="", message="x") is None
    )
    message = Message.objects.filter(provider=Message.Provider.WEB_FORM).first()
    assert message.message_id_header.startswith("<webform-")
    assert message.message_id_header.endswith("@vitalos.co.uk>")
    assert Enquiry.objects.filter(source=Enquiry.Source.WEB_FORM).count() == 5


# --- Settings and canned responses --------------------------------------------------------------


def test_settings_and_canned_responses_need_superadmin(agent, lead):
    with pytest.raises(PermissionDenied):
        services.update_inbox_settings(
            sla_first_response_hours=4, signature="", retention_months=12, spam_retention_days=30, actor=lead
        )
    with pytest.raises(PermissionDenied):
        services.save_canned_response(title="Hi", body_text="Hello", actor=lead)
    inbox = services.update_inbox_settings(
        sla_first_response_hours=4,
        signature="Thanks",
        retention_months=12,
        spam_retention_days=14,
        actor=agent,
    )
    assert (inbox.sla_first_response_hours, inbox.retention_months, inbox.spam_retention_days) == (4, 12, 14)
    with pytest.raises(ValidationError):
        services.update_inbox_settings(
            sla_first_response_hours=0, signature="", retention_months=12, spam_retention_days=30, actor=agent
        )
    canned = services.save_canned_response(title="Pricing", body_text="Our rates…", actor=agent)
    services.save_canned_response(title="Pricing 2", body_text="Updated", actor=agent, pk=canned.pk)
    canned.refresh_from_db()
    assert canned.title == "Pricing 2"
    with pytest.raises(PermissionDenied):
        services.delete_canned_response(canned.pk, lead)
    services.delete_canned_response(canned.pk, agent)
    assert not CannedResponse.objects.exists()


# --- Retention ----------------------------------------------------------------------------------


def test_anonymise_removes_personal_data_and_files(agent):
    enquiry = _ingested("attachment.eml")
    services.add_note(enquiry, "Jane's phone is 0123", agent)
    key = Attachment.objects.get(filename="brief.pdf").storage_key
    services.anonymise_enquiry(enquiry)
    enquiry.refresh_from_db()
    assert enquiry.anonymised_at is not None
    assert enquiry.from_email == services.REMOVED
    assert enquiry.subject == services.REMOVED
    message = enquiry.messages.get()
    assert message.text_body == services.REMOVED
    assert message.from_email == services.REMOVED
    assert enquiry.notes.get().body == services.REMOVED
    assert not storages["attachments"].exists(key)
    assert not Attachment.objects.exclude(storage_key="").exists()
    assert AuditEvent.objects.filter(action="enquiries.anonymised").exists()


def test_retention_is_a_dry_run_until_enforced(agent, settings):
    old = _new()
    Enquiry.objects.filter(pk=old.pk).update(
        status=Enquiry.Status.RESOLVED, resolved_at=timezone.now() - timedelta(days=800)
    )
    recent = _new()
    Enquiry.objects.filter(pk=recent.pk).update(status=Enquiry.Status.RESOLVED, resolved_at=timezone.now())
    spam = _new(status=Enquiry.Status.SPAM)
    Enquiry.objects.filter(pk=spam.pk).update(created_at=timezone.now() - timedelta(days=31))

    settings.RETENTION_ENFORCE = False
    out = io.StringIO()
    call_command("enforce_enquiry_retention", stdout=out)
    assert "Dry run" in out.getvalue()
    assert "VIT-0001" in out.getvalue() and "VIT-0003" in out.getvalue()
    assert Enquiry.objects.filter(anonymised_at__isnull=False).count() == 0
    assert Enquiry.objects.count() == 3

    settings.RETENTION_ENFORCE = True
    call_command("enforce_enquiry_retention", stdout=io.StringIO())
    assert list(Enquiry.objects.filter(anonymised_at__isnull=False).values_list("number", flat=True)) == [1]
    assert not Enquiry.objects.filter(pk=spam.pk).exists()
    assert Enquiry.objects.get(pk=recent.pk).anonymised_at is None
