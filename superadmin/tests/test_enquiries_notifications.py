"""Enquiry notifications: preferences, coalescing, caps, digests, Slack and the actor rule."""

import io
import json
from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.management import call_command

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER
from apps.audit.models import AuditEvent
from apps.enquiries import notifications, services
from apps.enquiries.models import Enquiry, Message, OutboundNotification
from apps.enquiries.sla import LONDON
from apps.notifications.models import Notification

INSTANT = "instant"
DIGEST = "daily_digest"


@pytest.fixture
def owner(make_user, settings):
    settings.NOTIFY_OWNER_EMAIL = "owner@example.test"
    settings.APP_BASE_URL = "https://admin.example.test"
    settings.SLACK_WEBHOOK_URL = ""
    return make_user(SUPERADMIN, email="owner@example.test")


@pytest.fixture
def colleague(make_user):
    return make_user(SERVICE_LEAD, email="colleague@example.test")


def _enquiry(subject="Pricing question", body="Please send your rates. " * 30) -> Enquiry:
    enquiry = services.create_enquiry(
        subject=subject,
        from_name="Jane Customer",
        from_email="jane@customer.example",
        to_email="support@vitalos.co.uk",
        source=Enquiry.Source.EMAIL,
        snippet=body[:300],
    )
    Message.objects.create(
        enquiry=enquiry,
        direction=Message.Direction.INBOUND,
        message_id_header=f"<n-{enquiry.number}@customer.example>",
        from_email="jane@customer.example",
        text_body=body,
        provider="cloudflare",
    )
    return enquiry


def _row(user, enquiry, created_at, *, mode=INSTANT, sent_at=None, event="new_enquiry"):
    return OutboundNotification.objects.create(
        recipient=user, event=event, enquiry=enquiry, mode=mode, created_at=created_at, sent_at=sent_at
    )


# --- Preferences --------------------------------------------------------------------------------


def test_default_preferences(owner, colleague):
    assert notifications.get_preferences(owner) == {
        "new_enquiry": INSTANT,
        "assigned_to_me": INSTANT,
        "customer_reply": INSTANT,
    }
    assert notifications.get_preferences(colleague)["new_enquiry"] == "off"


def test_setting_preferences_is_validated_and_audited(owner, colleague, make_user):
    notifications.set_preferences(colleague, {"new_enquiry": DIGEST})
    assert notifications.get_preferences(colleague)["new_enquiry"] == DIGEST
    assert AuditEvent.objects.filter(actor=colleague, action="enquiries.updated").exists()
    with pytest.raises(ValidationError):
        notifications.set_preferences(colleague, {"new_enquiry": "hourly"})
    with pytest.raises(PermissionDenied):
        notifications.set_preferences(make_user(VIEWER), {"new_enquiry": INSTANT})


def test_new_enquiry_goes_to_the_owner_at_once(owner, colleague, mailoutbox):
    enquiry = _enquiry()
    queued = notifications.queue("new_enquiry", enquiry)
    assert queued == 1
    assert len(mailoutbox) == 1
    sent = mailoutbox[0]
    assert sent.to == ["owner@example.test"]
    assert sent.from_email == "Vitalos Admin <notifications@vitalos.co.uk>"
    assert sent.extra_headers["Auto-Submitted"] == "auto-generated"
    assert sent.attachments == []
    assert "VIT-0001" in sent.subject
    assert "Jane Customer <jane@customer.example>" in sent.body
    assert f"https://admin.example.test{enquiry.get_absolute_url()}" in sent.body
    assert ("Please send your rates. " * 30)[:300].strip() in sent.body
    assert ("Please send your rates. " * 30)[:320] not in sent.body
    assert Notification.objects.filter(recipient=owner, kind=Notification.Kind.ENQUIRY_NEW).count() == 1
    assert not Notification.objects.filter(recipient=colleague, kind__startswith="enquiry").exists()


def test_preferences_are_respected(owner, colleague, mailoutbox):
    notifications.set_preferences(owner, {"new_enquiry": "off"})
    notifications.set_preferences(colleague, {"new_enquiry": DIGEST})
    notifications.queue("new_enquiry", _enquiry())
    assert mailoutbox == []
    rows = OutboundNotification.objects.all()
    assert [(row.recipient, row.mode) for row in rows] == [(colleague, DIGEST)]
    # The owner still sees it in the app.
    assert Notification.objects.filter(recipient=owner, kind=Notification.Kind.ENQUIRY_NEW).exists()


def test_the_actor_is_never_notified(owner, colleague, mailoutbox):
    enquiry = _enquiry()
    notifications.queue("new_enquiry", enquiry, actor=owner)
    assert not OutboundNotification.objects.exists()
    enquiry.assignee = colleague
    enquiry.save()
    notifications.queue("customer_reply", enquiry, actor=colleague)
    assert not OutboundNotification.objects.exists()
    notifications.queue("assigned_to_me", enquiry, actor=owner)
    assert OutboundNotification.objects.get().recipient == colleague


def test_customer_reply_goes_to_the_assignee_else_the_owner(owner, colleague):
    enquiry = _enquiry()
    notifications.queue("customer_reply", enquiry)
    assert OutboundNotification.objects.get().recipient == owner
    OutboundNotification.objects.all().delete()
    enquiry.assignee = colleague
    enquiry.save()
    notifications.queue("customer_reply", enquiry)
    assert OutboundNotification.objects.get().recipient == colleague


def test_spam_is_never_notified(owner, mailoutbox):
    enquiry = _enquiry()
    enquiry.status = Enquiry.Status.SPAM
    enquiry.save()
    assert notifications.queue("new_enquiry", enquiry) == 0
    assert mailoutbox == []


# --- Batching -----------------------------------------------------------------------------------


def test_bursts_within_two_minutes_coalesce(owner, mailoutbox):
    first, second, third = _enquiry("One"), _enquiry("Two"), _enquiry("Three")
    t0 = datetime(2026, 10, 12, 10, 0, tzinfo=LONDON)
    _row(owner, first, t0)
    assert notifications.flush(t0) == 1
    _row(owner, second, t0 + timedelta(seconds=30))
    _row(owner, third, t0 + timedelta(seconds=40))
    assert notifications.flush(t0 + timedelta(seconds=45)) == 0
    assert notifications.flush(t0 + timedelta(seconds=90)) == 0
    assert notifications.flush(t0 + timedelta(minutes=2)) == 1
    assert len(mailoutbox) == 2
    combined = mailoutbox[1]
    assert combined.subject == "2 enquiry updates"
    assert "VIT-0002" in combined.body and "VIT-0003" in combined.body
    assert not OutboundNotification.objects.filter(sent_at__isnull=True).exists()


def test_hourly_cap_rolls_into_the_digest(owner, mailoutbox):
    enquiry = _enquiry()
    now = datetime(2026, 10, 12, 12, 0, tzinfo=LONDON)
    for minute in range(notifications.HOURLY_CAP):
        sent = now - timedelta(minutes=59 - minute * 2)
        _row(owner, enquiry, sent, sent_at=sent)
    pending = _row(owner, enquiry, now - timedelta(minutes=5))
    assert notifications.flush(now) == 0
    pending.refresh_from_db()
    assert pending.mode == DIGEST
    assert pending.sent_at is None
    assert mailoutbox == []


def test_daily_limit_rolls_remaining_instants_into_the_digest(owner, colleague, settings, mailoutbox, caplog):
    settings.RESEND_DAILY_LIMIT = 3
    enquiry = _enquiry()
    now = datetime(2026, 10, 12, 15, 0, tzinfo=LONDON)
    for hour in range(3):
        sent = now - timedelta(hours=hour + 1)
        _row(colleague, enquiry, sent, sent_at=sent)
    pending = _row(owner, enquiry, now)
    assert notifications.flush(now) == 0
    pending.refresh_from_db()
    assert pending.mode == DIGEST
    assert mailoutbox == []


def test_digest_goes_once_a_day_from_eight(owner, mailoutbox):
    enquiry = _enquiry()
    _row(owner, enquiry, datetime(2026, 10, 11, 20, 0, tzinfo=LONDON), mode=DIGEST)
    assert notifications.send_digests(datetime(2026, 10, 12, 7, 59, tzinfo=LONDON)) == 0
    assert notifications.send_digests(datetime(2026, 10, 12, 8, 0, tzinfo=LONDON)) == 1
    assert mailoutbox[0].subject.startswith("Enquiries digest")
    assert mailoutbox[0].extra_headers["Auto-Submitted"] == "auto-generated"
    _row(owner, enquiry, datetime(2026, 10, 12, 9, 0, tzinfo=LONDON), mode=DIGEST)
    assert notifications.send_digests(datetime(2026, 10, 12, 10, 0, tzinfo=LONDON)) == 0
    assert notifications.send_digests(datetime(2026, 10, 13, 8, 5, tzinfo=LONDON)) == 1
    assert len(mailoutbox) == 2


def test_flush_if_due_is_one_query_when_idle(owner, django_assert_num_queries):
    with django_assert_num_queries(1):
        assert notifications.flush_if_due() == 0


def test_command_runs(owner):
    out = io.StringIO()
    call_command("send_enquiry_notifications", stdout=out)
    assert "Sent 0 notification email(s)" in out.getvalue()


# --- Slack --------------------------------------------------------------------------------------


def test_slack_only_when_configured(owner, settings):
    enquiry = _enquiry(subject="Partnership", body="Secret body text")
    with mock.patch("apps.enquiries.notifications.urllib.request.urlopen") as urlopen:
        notifications.queue("new_enquiry", enquiry)
        assert not urlopen.called
        settings.SLACK_WEBHOOK_URL = "https://hooks.slack.example/services/T/B/X"
        notifications.queue("new_enquiry", enquiry)
        assert urlopen.call_count == 1
        request = urlopen.call_args.args[0]
        assert urlopen.call_args.kwargs["timeout"] == 5
        text = json.loads(request.data)["text"]
        assert "VIT-0001" in text and "Partnership" in text
        assert "Secret body" not in text


def test_slack_failures_do_not_raise(owner, settings):
    settings.SLACK_WEBHOOK_URL = "https://hooks.slack.example/services/T/B/X"
    with mock.patch("apps.enquiries.notifications.urllib.request.urlopen", side_effect=OSError("down")):
        assert notifications.queue("new_enquiry", _enquiry()) == 1
