"""Overdue-enquiry alerts, the overdue digest, smoke-test purge, sending-domain check and the email
allowance warning (findings E5 and E9)."""

import io
import json
import urllib.error
from datetime import timedelta
from unittest import mock

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN
from apps.content_sync import tick
from apps.core import email_usage, health
from apps.enquiries import domain, overdue, services
from apps.enquiries.models import Enquiry, InboxSettings, OutboundNotification
from apps.enquiries.providers import DomainCheckError, ResendOutbound
from apps.notifications import cleanup
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(make_user, settings):
    settings.NOTIFY_OWNER_EMAIL = "owner@example.test"
    settings.APP_BASE_URL = "https://admin.example.test"
    settings.SLACK_WEBHOOK_URL = ""
    return make_user(SUPERADMIN, email="owner@example.test")


@pytest.fixture
def second_admin(make_user):
    return make_user(SUPERADMIN, email="second@example.test")


def _overdue_enquiry(hours_ago=3, **extra) -> Enquiry:
    enquiry = services.create_enquiry(
        subject="Rates",
        from_name="Jane Customer",
        from_email="jane@customer.example",
        to_email="support@vitalos.co.uk",
        source=Enquiry.Source.EMAIL,
        snippet="Please send your rates.",
    )
    due = timezone.now() - timedelta(hours=hours_ago)
    Enquiry.objects.filter(pk=enquiry.pk).update(sla_due_at=due, **extra)
    enquiry.refresh_from_db()
    return enquiry


def _overdue_notes():
    return Notification.objects.filter(kind=overdue.OVERDUE_KIND)


def test_unassigned_overdue_enquiry_tells_every_super_admin_once(owner, second_admin, mailoutbox):
    enquiry = _overdue_enquiry()
    mailoutbox.clear()
    assert overdue.notify_overdue() == 1
    recipients = set(_overdue_notes().values_list("recipient__email", flat=True))
    assert recipients == {"owner@example.test", "second@example.test"}
    note = _overdue_notes().first()
    assert enquiry.ref in note.title and "Nobody is assigned" in note.body
    # Email follows "New enquiry" preferences: the owner is instant, other super admins are off by default.
    sent_to = [address for message in mailoutbox for address in message.to]
    assert "owner@example.test" in sent_to and "second@example.test" not in sent_to
    assert any("First response overdue" in message.body for message in mailoutbox)
    # Idempotent: a second run (or a second process) does nothing.
    assert overdue.notify_overdue() == 0
    assert _overdue_notes().count() == 2


def test_assigned_overdue_enquiry_tells_only_the_assignee(owner, make_user):
    lead = make_user(SERVICE_LEAD, email="lead@example.test")
    enquiry = _overdue_enquiry(assignee=lead)
    overdue.notify_overdue()
    assert list(_overdue_notes().values_list("recipient", flat=True)) == [lead.pk]
    assert OutboundNotification.objects.filter(
        enquiry=enquiry, event=overdue.OVERDUE_EVENT, recipient=lead
    ).exists()


def test_answered_spam_and_not_yet_due_enquiries_are_ignored(owner):
    _overdue_enquiry(first_response_at=timezone.now())
    _overdue_enquiry(status=Enquiry.Status.SPAM)
    _overdue_enquiry(hours_ago=-2)  # due in two hours
    assert overdue.notify_overdue() == 0
    assert not _overdue_notes().exists()


def test_overdue_digest_is_queued_once_a_day(owner):
    _overdue_enquiry()
    assert overdue.queue_overdue_digest() == 1
    assert overdue.queue_overdue_digest() == 0
    row = OutboundNotification.objects.get(event=overdue.OVERDUE_EVENT, mode="daily_digest")
    assert row.recipient == owner


def test_the_tick_runs_overdue_alerts_and_keeps_its_contract(owner):
    from apps.content_sync.models import TickState

    _overdue_enquiry()
    result = tick.run()
    assert set(result) == {"promoted", "closed", "delivered", "nextDueAt"}  # TickResponse is strict
    assert _overdue_notes().count() == 1
    assert TickState.load().last_result["overdue"] == 1


def test_overdue_inbox_filter(owner, client_for):
    enquiry = _overdue_enquiry()
    later = _overdue_enquiry(hours_ago=-5)
    response = client_for(owner).get("/enquiries/?f=overdue")
    assert response.status_code == 200
    assert enquiry.ref.encode() in response.content
    assert later.ref.encode() not in response.content


def test_command_runs_both_steps(owner):
    _overdue_enquiry()
    out = io.StringIO()
    call_command("notify_overdue_enquiries", "--digest", stdout=out)
    assert "Notified 1 newly overdue enquiry" in out.getvalue() and "Queued 1" in out.getvalue()


# --- Smoke-test leftovers -----------------------------------------------------------------------


def test_purge_smoke_test_is_a_dry_run_by_default(owner, seeded):
    from apps.architecture.models import Practice

    line = seeded["consulting"]
    Notification.objects.create(recipient=owner, kind="project_status", title="Smoke test project 1: New")
    Notification.objects.create(recipient=owner, kind="kpi_breach", title="KPI breach: Real KPI (Consulting)")
    archived = Practice.objects.create(service_line=line, name="Smoke test practice 1", is_archived=True)
    live = Practice.objects.create(service_line=line, name="Smoke test practice live")
    before = Notification.objects.count()
    out = io.StringIO()
    call_command("notifications_cleanup", "--purge-smoke-test", stdout=out)
    assert "notifications: 1" in out.getvalue() and "Dry run" in out.getvalue()
    assert Notification.objects.count() == before
    report = cleanup.purge_smoke_test(apply=True)
    assert report.counts["notifications"] == 1 and report.counts["archived practices"] == 1
    assert Notification.objects.count() == before - 1
    assert Notification.objects.filter(title__startswith="KPI breach: Real KPI").exists()
    assert not Practice.objects.filter(pk=archived.pk).exists()
    assert Practice.objects.filter(pk=live.pk).exists()


# --- Sending domain -----------------------------------------------------------------------------


class _Response(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_resend_domain_status_reads_the_domains_api(settings):
    settings.RESEND_API_KEY = "re_test_key"
    body = json.dumps({"data": [{"name": "vitalos.co.uk", "status": "verified"}]}).encode()
    with mock.patch("urllib.request.urlopen", side_effect=lambda *a, **k: _Response(body)) as opened:
        assert ResendOutbound().domain_status("vitalos.co.uk") == "verified"
        assert ResendOutbound().domain_status("other.example") == "missing"
    request = opened.call_args.args[0]
    assert request.full_url == "https://api.resend.com/domains"


def test_resend_domain_status_explains_a_sending_only_key(settings):
    settings.RESEND_API_KEY = "re_test_key"
    error = urllib.error.HTTPError("https://api.resend.com/domains", 401, "Unauthorized", {}, None)
    with mock.patch("urllib.request.urlopen", side_effect=error):
        with pytest.raises(DomainCheckError, match="sending-only"):
            ResendOutbound().domain_status("vitalos.co.uk")


def test_domain_check_is_recorded_and_shown_in_health(settings):
    settings.NOTIFY_FROM = "notifications@vitalos.co.uk"
    provider = mock.Mock(domain_status=mock.Mock(return_value="verified"))
    assert domain.check_sending_domain(provider=provider) == "vitalos.co.uk: Verified"
    assert InboxSettings.load().domain_checked_at is not None
    check = next(c for c in health.checks() if c.key == "domain")
    assert check.status == "ok" and check.summary == "vitalos.co.uk: Verified"
    provider.domain_status.side_effect = DomainCheckError("not reachable")
    domain.check_sending_domain(provider=provider)
    check = next(c for c in health.checks() if c.key == "domain")
    assert check.status == "warn" and "check failed" in check.summary


def test_domain_check_with_log_transport_asks_nobody(settings):
    settings.EMAIL_TRANSPORT = "log"
    assert "log transport" in domain.check_sending_domain()


def test_attachment_storage_is_a_setup_task_with_steps(settings):
    settings.ATTACHMENTS_STORAGE_ENABLED = False
    check = health._storage()
    assert check.steps and any("OBJECT_STORAGE_BUCKET" in step for step in check.steps)


def test_health_page_shows_setup_steps(owner, client_for, settings):
    settings.ATTACHMENTS_STORAGE_ENABLED = False
    html = client_for(owner).get("/system/health/").content.decode()
    assert 'data-testid="setup-steps-storage"' in html and "OBJECT_STORAGE_ACCESS_KEY_ID" in html


# --- Email allowance ----------------------------------------------------------------------------


def test_email_allowance_warning_once_a_day(owner, second_admin, settings):
    settings.RESEND_DAILY_LIMIT = 10
    with mock.patch.object(email_usage, "sent_today", return_value=7):
        assert email_usage.warn_if_near_limit() is False
    with mock.patch.object(email_usage, "sent_today", return_value=8):
        assert email_usage.warn_if_near_limit() is True
        assert email_usage.warn_if_near_limit() is False
    notes = Notification.objects.filter(kind=email_usage.WARNING_KIND)
    assert notes.count() == 2 and "8 of 10" in notes.first().title
