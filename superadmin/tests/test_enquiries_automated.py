"""Automated inbound mail stays out of the enquiry queue (ADR-046). Every address here is fictional."""

import io

import pytest
from django.core.management import call_command

from apps.accounts.roles import SUPERADMIN
from apps.enquiries import automated, ingest
from apps.enquiries.models import Enquiry, InboxSettings, Message, OutboundNotification
from apps.notifications.models import Notification


@pytest.fixture
def owner(make_user, settings):
    settings.NOTIFY_OWNER_EMAIL = "owner@example.test"
    return make_user(SUPERADMIN, email="owner@example.test")


def raw(from_header, subject="Hello", *, message_id=None, body="Hello there.", **headers) -> bytes:
    lines = [
        f"From: {from_header}",
        "To: support@vitalos.co.uk",
        f"Subject: {subject}",
        f"Message-ID: <{message_id or abs(hash((from_header, subject, body, tuple(headers.items()))))}@x.example>",
        "Date: Mon, 26 Oct 2026 09:00:00 +0000",
        *[f"{name.replace('_', '-')}: {value}" for name, value in headers.items()],
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
    ]
    return "\r\n".join(lines).encode()


def file(data: bytes) -> Enquiry:
    message, created = ingest.ingest(data, provider="cloudflare")
    assert created
    return message.enquiry


def alerts() -> int:
    return (
        OutboundNotification.objects.count() + Notification.objects.filter(kind__startswith="enquiry").count()
    )


def test_a_person_is_an_enquiry_even_with_a_noreply_like_display_name(owner):
    enquiry = file(raw('"No Reply (Alex Example)" <alex@example.test>'))
    assert enquiry.status == Enquiry.Status.NEW and enquiry.sla_due_at is not None
    assert alerts() > 0


@pytest.mark.parametrize(
    ("sender", "headers"),
    [
        ("Askbridge <no-reply@askbridge.vitalos.co.uk>", {}),
        ("Example Tool <noreply@tool.example>", {}),
        ("Cal.com <hello@cal.com>", {}),
        ("Example Shop <news@shop.example>", {"Auto_Submitted": "auto-generated"}),
        ("Example List <list@lists.example>", {"List_Id": "<news.lists.example>"}),
    ],
)
def test_machine_mail_is_filed_under_automated_with_no_alert_and_no_sla(owner, sender, headers):
    enquiry = file(raw(sender, **headers))
    assert enquiry.status == Enquiry.Status.AUTOMATED
    assert enquiry.sla_due_at is None and enquiry.messages.get().is_auto
    assert alerts() == 0


def test_auto_submitted_no_is_a_person(owner):
    assert file(raw("Alex <alex@example.test>", Auto_Submitted="no")).status == Enquiry.Status.NEW


def test_the_sender_list_is_editable(owner):
    inbox = InboxSettings.load()
    inbox.automated_senders = "@bookings.example"
    inbox.save()
    assert file(raw("Bookings <confirm@bookings.example>")).status == Enquiry.Status.AUTOMATED
    # hello@cal.com is no longer listed, so it is a person again.
    assert file(raw("Cal <hello@cal.com>", subject="Hi")).status == Enquiry.Status.NEW


def test_automated_mail_is_searchable_in_its_own_view_and_not_in_all(owner, client_for):
    file(raw("Askbridge <no-reply@askbridge.vitalos.co.uk>", subject="Domain verified elsewhere"))
    from apps.enquiries import selectors

    assert selectors.inbox(owner, "all").count() == 0
    assert selectors.inbox(owner, "automated", "verified elsewhere").count() == 1
    body = client_for(owner).get("/enquiries/?f=automated").content.decode()
    assert "Domain verified elsewhere" in body


def test_our_own_alert_is_linked_to_the_enquiry_it_describes(owner):
    enquiry = file(raw("Alex <alex@example.test>", subject="Website rebuild"))
    before = (enquiry.status, alerts())
    copy = file(
        raw(
            "Vitalos Admin <notifications@vitalos.co.uk>",
            subject=f"New enquiry: {enquiry.ref} Website rebuild",
            Auto_Submitted="auto-generated",
            X_Vitalos_Notification="enquiries.update",
            X_Vitalos_Reference=enquiry.ref,
        )
    )
    assert copy == enquiry and Enquiry.objects.count() == 1
    enquiry.refresh_from_db()
    assert (enquiry.status, alerts()) == before
    assert enquiry.messages.filter(is_auto=True).count() == 1


def test_our_own_notification_without_a_reference_is_automated(owner):
    enquiry = file(
        raw(
            "Vitalos Admin <notifications@vitalos.co.uk>",
            subject="Enquiries digest: 3 updates",
            Auto_Submitted="auto-generated",
            X_Vitalos_Notification="enquiries.digest",
        )
    )
    assert enquiry.status == Enquiry.Status.AUTOMATED and alerts() == 0


def test_website_notification_is_filed_as_the_person_and_linked_when_repeated(owner):
    headers = {
        "Reply_To": "Alex Example <alex@example-care.example>",
        "Auto_Submitted": "auto-generated",
        "X_Vitalos_Notification": "web.enquiry-notification",
        "X_Vitalos_Reference": "VIT-0F867CE48552",
    }
    subject = "New enquiry: New project · Alex Example, Example Care Group · VIT-0F867CE48552"
    enquiry = file(raw("Vitalos <support@vitalos.co.uk>", subject, message_id="web-1", **headers))
    assert enquiry.status == Enquiry.Status.NEW and enquiry.source == Enquiry.Source.WEB_FORM
    assert (enquiry.from_name, enquiry.from_email) == ("Alex Example", "alex@example-care.example")
    assert not enquiry.messages.get().is_auto
    first_alerts = alerts()
    assert first_alerts > 0
    again = file(raw("Vitalos <support@vitalos.co.uk>", subject, message_id="web-2", **headers))
    assert again == enquiry and Enquiry.objects.count() == 1 and alerts() == first_alerts


def test_askbridge_help_form_is_filed_as_the_person(owner):
    enquiry = file(
        raw(
            "Askbridge <no-reply@askbridge.vitalos.co.uk>",
            "Askbridge help centre: Billing",
            Reply_To="Sam Example <sam@example.test>",
            Auto_Submitted="auto-generated",
            X_Vitalos_Form="askbridge-help-centre",
        )
    )
    assert enquiry.status == Enquiry.Status.NEW and enquiry.from_email == "sam@example.test"


def test_a_form_header_from_outside_vitalos_does_not_change_the_sender(owner):
    enquiry = file(
        raw(
            "Mallory <mallory@evil.example>",
            Reply_To="victim@example.test",
            X_Vitalos_Form="askbridge-help-centre",
        )
    )
    assert enquiry.from_email == "mallory@evil.example"


def test_form_relay_without_a_usable_reply_to_is_automated(owner):
    enquiry = file(
        raw(
            "Askbridge <no-reply@askbridge.vitalos.co.uk>",
            Reply_To="no-reply@askbridge.vitalos.co.uk",
            X_Vitalos_Form="askbridge-help-centre",
        )
    )
    assert enquiry.status == Enquiry.Status.AUTOMATED


def test_classify_reasons():
    assert (
        automated.classify(from_email="a@b.example", headers={}, is_auto=False, senders=[]).kind == "person"
    )
    assert automated.is_own_address("x@askbridge.vitalos.co.uk") and not automated.is_own_address(
        "x@vitalos.co"
    )


def test_list_automated_enquiries_is_read_only(owner):
    file(raw("Alex <alex@example.test>"))
    old = file(raw("Alex <alex@example.test>", subject="Second"))
    # An enquiry filed before the rules: cal.com mail that became a normal enquiry.
    Message.objects.filter(enquiry=old).update(from_email="hello@cal.com")
    out = io.StringIO()
    call_command("list_automated_enquiries", stdout=out)
    text = out.getvalue()
    assert "VIT-0002  [New]  automated: Booking or notification sender" in text
    assert "VIT-0001" not in text and "alex@" not in text
    old.refresh_from_db()
    assert old.status == Enquiry.Status.NEW
