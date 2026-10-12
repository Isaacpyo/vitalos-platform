"""Enquiries inbox UI: access, three panes, actions, sandboxed message bodies, settings pages."""

import json

import pytest
from django.core.files.base import ContentFile
from django.core.files.storage import storages

from apps.audit.models import AuditEvent
from apps.enquiries import services
from apps.enquiries.models import Attachment, CannedResponse, Enquiry, Message

from .conftest import HX


@pytest.fixture
def enquiry(db):
    item = services.create_enquiry(
        subject="Cloud migration proposal",
        from_name="Jo Client",
        from_email="jo@client.example",
        to_email="support@vitalos.co.uk",
        source=Enquiry.Source.EMAIL,
        snippet="We would like a proposal",
    )
    Message.objects.create(
        enquiry=item,
        direction=Message.Direction.INBOUND,
        message_id_header="<first@client.example>",
        from_email="jo@client.example",
        to_emails=["support@vitalos.co.uk"],
        subject=item.subject,
        text_body="We would like a proposal for a cloud migration.",
        html_body_raw='<p>Hello</p><script>alert(1)</script><img src="https://tracker.example/p.gif">',
        html_body_sanitised='<p>Hello</p><img src="https://tracker.example/p.gif">',
        provider=Message.Provider.CLOUDFLARE,
    )
    return item


def _thread(client, enquiry, **extra):
    return client.get(enquiry.get_absolute_url(), HTTP_HX_TARGET="enquiry-thread", **HX, **extra)


def test_viewers_cannot_see_enquiries(client_for, viewer, enquiry):
    client = client_for(viewer)
    assert client.get("/enquiries/").status_code == 403
    assert client.get(enquiry.get_absolute_url()).status_code == 403
    assert 'data-nav="enquiries"' not in client.get("/help/").content.decode()


def test_inbox_lists_and_filters(client_for, superadmin, enquiry):
    client = client_for(superadmin)
    body = client.get("/enquiries/").content.decode()
    assert 'data-nav="enquiries"' in body and enquiry.ref in body and "Cloud migration proposal" in body
    assert 'data-filter="unassigned"' in body
    partial = client.get("/enquiries/?f=resolved", HTTP_HX_TARGET="enquiry-list", **HX).content.decode()
    assert "<html" not in partial and enquiry.ref not in partial
    found = client.get(f"/enquiries/?q={enquiry.ref}", HTTP_HX_TARGET="enquiry-list", **HX).content.decode()
    assert enquiry.ref in found


def test_opening_an_enquiry_is_audited_and_marks_it_read(client_for, superadmin, enquiry):
    client = client_for(superadmin)
    response = client.get(enquiry.get_absolute_url())
    body = response.content.decode()
    assert response.status_code == 200
    assert 'aria-current="page" data-enquiry-row' in body
    assert "<script>alert(1)</script>" not in body
    enquiry.refresh_from_db()
    assert enquiry.unread is False
    assert AuditEvent.objects.filter(action="enquiries.viewed", actor=superadmin).exists()
    partial = _thread(client, enquiry)
    assert "<html" not in partial.content.decode() and "vsa-enquiries-changed" in partial["HX-Trigger"]


def test_message_body_is_sandboxed_with_its_own_csp(client_for, superadmin, enquiry):
    message = enquiry.messages.get()
    client = client_for(superadmin)
    response = client.get(f"/enquiries/messages/{message.pk}/body/")
    policy = response["Content-Security-Policy"]
    assert "sandbox" in policy and "default-src 'none'" in policy and "img-src data:;" in policy
    assert "https:" not in policy
    assert response["X-Frame-Options"] == "SAMEORIGIN"
    assert "<script" not in response.content.decode().split("</style>")[1]
    with_images = client.get(f"/enquiries/messages/{message.pk}/body/?images=1")
    assert "img-src data: https:" in with_images["Content-Security-Policy"]


def test_status_assign_and_tags_actions(client_for, superadmin, enquiry):
    client = client_for(superadmin)
    url = enquiry.get_absolute_url()
    response = client.post(url + "assign/", {"assignee": "me"}, HTTP_HX_TARGET="enquiry-thread", **HX)
    assert response.status_code == 200 and "Assigned to" in response["HX-Trigger"]
    client.post(url + "tags/", {"tags": "Proposal, cloud"}, **HX)
    client.post(url + "status/", {"status": "resolved"}, **HX)
    enquiry.refresh_from_db()
    assert enquiry.assignee == superadmin and enquiry.status == "resolved"
    assert sorted(enquiry.tags.values_list("name", flat=True)) == ["cloud", "proposal"]
    bad = client.post(url + "assign/", {"assignee": "999999"}, **HX)
    assert "cannot be assigned" in bad["HX-Trigger"]


def test_reply_in_log_transport_is_threaded(client_for, superadmin, enquiry, settings, mailoutbox):
    settings.EMAIL_TRANSPORT = "log"
    client = client_for(superadmin)
    response = client.post(enquiry.get_absolute_url() + "reply/", {"body_text": "Thanks, Jo."}, **HX)
    assert response.status_code == 200
    reply = enquiry.messages.get(direction="outbound")
    assert reply.in_reply_to == "<first@client.example>"
    assert enquiry.ref in reply.subject and reply.subject.startswith("Re:")
    assert "Logged, not sent" in response.content.decode()
    assert len(mailoutbox) == 1 and mailoutbox[0].extra_headers["In-Reply-To"] == "<first@client.example>"


def test_notes_are_internal(client_for, superadmin, enquiry, mailoutbox):
    client = client_for(superadmin)
    response = client.post(enquiry.get_absolute_url() + "note/", {"body": "Call them on Monday."}, **HX)
    assert (
        "Internal note" in response.content.decode() and "Call them on Monday." in response.content.decode()
    )
    assert mailoutbox == []


def test_export_downloads_json(client_for, superadmin, enquiry):
    response = client_for(superadmin).get(enquiry.get_absolute_url() + "export/")
    assert response["Content-Disposition"] == f'attachment; filename="{enquiry.ref}.json"'
    assert json.loads(response.content)
    assert AuditEvent.objects.filter(action="enquiries.exported").exists()


def test_attachment_downloads_never_inline(client_for, superadmin, enquiry):
    key = storages["attachments"].save("enquiries/test.pdf", ContentFile(b"%PDF-1.4 test"))
    attachment = Attachment.objects.create(
        message=enquiry.messages.get(), filename="brief.pdf", content_type="application/pdf",
        size_bytes=13, storage_key=key, sha256="0" * 64,
    )  # fmt: skip
    response = client_for(superadmin).get(f"/enquiries/attachments/{attachment.pk}/")
    assert response["Content-Disposition"].startswith("attachment")
    assert response["Content-Type"] == "application/octet-stream"
    assert "sandbox" in response["Content-Security-Policy"]


def test_badge_counts_unread_open_enquiries(client_for, superadmin, enquiry):
    body = client_for(superadmin).get("/enquiries/badge/", **HX).content.decode()
    assert 'data-testid="enquiries-badge"' in body and ">1<" in body


def test_palette_finds_enquiries_by_reference(client_for, superadmin, viewer, enquiry):
    body = client_for(superadmin).get(f"/palette/?q={enquiry.ref}", **HX).content.decode()
    assert "Cloud migration proposal" in body
    assert (
        "Cloud migration proposal"
        not in client_for(viewer).get(f"/palette/?q={enquiry.ref}", **HX).content.decode()
    )


def test_email_settings_are_superadmin_only(client_for, superadmin, lead, db):
    assert client_for(lead).get("/settings/email/").status_code == 403
    client = client_for(superadmin)
    assert b"Inbound mail" in client.get("/settings/email/").content
    client.post("/settings/email/", {"action": "canned", "title": "Thanks", "body_text": "Thank you."})
    assert CannedResponse.objects.filter(title="Thanks").exists()


def test_notification_preferences_page(client_for, lead, db):
    client = client_for(lead)
    assert client.get("/settings/notifications/").status_code == 200
    response = client.post(
        "/settings/notifications/",
        {"new_enquiry": "daily_digest", "assigned_to_me": "instant", "customer_reply": "off"},
    )
    assert response.status_code == 302
    from apps.enquiries import notifications

    assert notifications.get_preferences(lead)["new_enquiry"] == "daily_digest"


def test_details_panel_collapse_is_remembered(client_for, superadmin, enquiry):
    client = client_for(superadmin)
    body = client.get(enquiry.get_absolute_url()).content.decode()
    assert 'data-details="expanded"' in body and 'aria-controls="enquiry-details-body"' in body
    client.cookies["enquiry_details"] = "collapsed"
    body = client.get(enquiry.get_absolute_url()).content.decode()
    assert 'data-details="collapsed"' in body and "Show details" in body
