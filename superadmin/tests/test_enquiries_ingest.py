"""Inbound email through the signed Cloudflare Worker endpoint."""

import time
from pathlib import Path

import pytest
from django.core.files.storage import storages

from apps.accounts.roles import SUPERADMIN
from apps.enquiries import providers
from apps.enquiries.models import (
    Attachment,
    Enquiry,
    EnquiryNote,
    InboxSettings,
    Message,
    OutboundNotification,
)
from apps.notifications.models import Notification

SECRET = "test-inbound-secret-0123456789"
FIXTURES = Path(__file__).parent / "fixtures" / "eml"
URL = "/api/inbound/email"


def eml(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


@pytest.fixture
def owner(make_user, settings):
    settings.NOTIFY_OWNER_EMAIL = "owner@example.test"
    return make_user(SUPERADMIN, email="owner@example.test")


@pytest.fixture
def post(client, settings, db):
    settings.INBOUND_WEBHOOK_SECRET = SECRET

    def _post(raw: bytes, *, ts=None, secret=SECRET, signature=None, **headers):
        ts = str(int(time.time()) if ts is None else ts)
        return client.post(
            URL,
            data=raw,
            content_type="message/rfc822",
            HTTP_X_VITALOS_TIMESTAMP=ts,
            HTTP_X_VITALOS_SIGNATURE=signature if signature is not None else providers.sign(secret, ts, raw),
            **headers,
        )

    return _post


def test_plain_email_creates_an_enquiry_and_notifies_the_owner(post, owner, mailoutbox):
    response = post(eml("plain.eml"), HTTP_X_VITALOS_ENVELOPE_TO="support@vitalos.co.uk")
    assert response.status_code == 200
    assert response.json() == {"status": "stored", "ref": "VIT-0001"}
    enquiry = Enquiry.objects.get()
    assert enquiry.from_email == "jane@customer.example"
    assert enquiry.to_email == "support@vitalos.co.uk"
    assert enquiry.status == Enquiry.Status.NEW
    assert enquiry.unread
    assert enquiry.sla_due_at is not None
    assert "cloud consulting" in enquiry.snippet
    message = enquiry.messages.get()
    assert message.provider == "cloudflare"
    assert message.message_id_header == "<plain-1@customer.example>"
    assert InboxSettings.load().last_inbound_at is not None
    assert Notification.objects.filter(recipient=owner, kind=Notification.Kind.ENQUIRY_NEW).count() == 1
    assert len(mailoutbox) == 1
    assert mailoutbox[0].to == ["owner@example.test"]
    assert mailoutbox[0].extra_headers["Auto-Submitted"] == "auto-generated"


def test_duplicates_are_ignored(post, owner):
    first = post(eml("plain.eml"))
    second = post(eml("plain.eml"))
    assert first.json()["status"] == "stored"
    assert second.status_code == 200
    assert second.json() == {"status": "duplicate", "ref": "VIT-0001"}
    assert Message.objects.count() == 1
    assert Enquiry.objects.count() == 1


def test_replies_join_the_thread_and_reopen_it(post, owner):
    post(eml("plain.eml"))
    enquiry = Enquiry.objects.get()
    enquiry.status = Enquiry.Status.RESOLVED
    enquiry.unread = False
    enquiry.save()
    response = post(eml("reply.eml"))
    assert response.json() == {"status": "stored", "ref": "VIT-0001"}
    enquiry.refresh_from_db()
    assert enquiry.messages.count() == 2
    assert enquiry.status == Enquiry.Status.OPEN
    assert enquiry.resolved_at is None
    assert enquiry.unread
    assert "charities" in enquiry.snippet
    assert OutboundNotification.objects.filter(event="customer_reply", recipient=owner).exists()


def test_subject_token_threads_only_for_the_same_sender(post, owner):
    post(eml("plain.eml"))
    same = eml("plain.eml").replace(b"<plain-1@", b"<plain-2@").replace(b"Subject: ", b"Subject: [VIT-0001] ")
    other = same.replace(b"<plain-2@", b"<plain-3@").replace(b"jane@customer.example", b"eve@other.example")
    assert post(same).json()["ref"] == "VIT-0001"
    assert post(other).json()["ref"] == "VIT-0002"


def test_auto_reply_is_flagged_as_spam_without_notifications(post, owner, mailoutbox):
    response = post(eml("auto_reply.eml"))
    assert response.status_code == 200
    enquiry = Enquiry.objects.get()
    assert enquiry.status == Enquiry.Status.SPAM
    assert enquiry.sla_due_at is None
    assert enquiry.messages.get().is_auto
    assert not OutboundNotification.objects.exists()
    assert not Notification.objects.filter(kind__startswith="enquiry").exists()
    assert mailoutbox == []


def test_bounce_adds_a_note_and_does_not_reopen(post, owner):
    post(eml("plain.eml"))
    enquiry = Enquiry.objects.get()
    enquiry.status = Enquiry.Status.PENDING
    enquiry.save()
    OutboundNotification.objects.all().delete()
    post(eml("bounce.eml"))
    enquiry.refresh_from_db()
    assert enquiry.messages.count() == 2
    assert enquiry.status == Enquiry.Status.PENDING
    note = EnquiryNote.objects.get(enquiry=enquiry)
    assert note.is_system
    assert note.body.startswith("Delivery failure:")
    assert not OutboundNotification.objects.exists()


def test_bounce_without_a_thread_is_spam(post, owner):
    post(eml("bounce.eml"))
    assert Enquiry.objects.get().status == Enquiry.Status.SPAM


def test_html_is_sanitised(post, owner):
    post(eml("html.eml"))
    message = Message.objects.get()
    assert "<script" in message.html_body_raw
    safe = message.html_body_sanitised
    assert "<script" not in safe
    assert "alert('xss')" not in safe
    assert "onerror" not in safe
    assert "onclick" not in safe
    assert "javascript:" not in safe
    assert "Hello" in safe
    # Remote images survive sanitising; the viewer's CSP blocks them until the reader opts in.
    assert "https://tracker.example/pixel.gif" in safe


def test_attachments_are_checked_and_disguised_executables_refused(post, owner):
    post(eml("attachment.eml"))
    brief = Attachment.objects.get(filename="brief.pdf")
    disguised = Attachment.objects.get(filename="invoice.pdf")
    assert brief.refused_reason == ""
    assert brief.storage_key
    assert storages["attachments"].exists(brief.storage_key)
    assert disguised.refused_reason == "File contents do not match the declared type"
    assert disguised.storage_key == ""


@pytest.mark.parametrize(
    "kwargs",
    [
        {"signature": "0" * 64},
        {"secret": "wrong-secret"},
        {"ts": int(time.time()) - 1000},
        {"ts": int(time.time()) + 1000},
        {"ts": "not-a-number"},
        {"signature": ""},
    ],
)
def test_bad_or_stale_signatures_are_rejected(post, kwargs):
    response = post(eml("plain.eml"), **kwargs)
    assert response.status_code == 401
    assert not Enquiry.objects.exists()


def test_tampered_body_is_rejected(post, client):
    ts = str(int(time.time()))
    signature = providers.sign(SECRET, ts, eml("plain.eml"))
    response = client.post(
        URL,
        data=eml("plain.eml").replace(b"Jane", b"Eve"),
        content_type="message/rfc822",
        HTTP_X_VITALOS_TIMESTAMP=ts,
        HTTP_X_VITALOS_SIGNATURE=signature,
    )
    assert response.status_code == 401


def test_missing_secret_fails_closed(post, settings):
    settings.INBOUND_WEBHOOK_SECRET = ""
    response = post(eml("plain.eml"), secret="anything")
    assert response.status_code == 503
    assert not Enquiry.objects.exists()


def test_oversize_messages_are_refused(post):
    raw = eml("plain.eml") + b"x" * (providers.MAX_INBOUND_BYTES)
    response = post(raw)
    assert response.status_code == 413
    assert not Enquiry.objects.exists()


def test_parse_failures_record_the_error_without_content(post):
    response = post(b"Subject: secret details\n\nno sender here")
    assert response.status_code == 400
    inbox = InboxSettings.load()
    assert inbox.last_inbound_error == "Message has no sender address"
    assert inbox.last_inbound_error_at is not None
    assert "secret details" not in inbox.last_inbound_error


def test_only_post_is_allowed(client, settings):
    settings.INBOUND_WEBHOOK_SECRET = SECRET
    assert client.get(URL).status_code == 405
