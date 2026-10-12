"""System health (page footer and page) and the Needs attention tab on Notifications."""

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.core import health
from apps.enquiries.models import Enquiry, InboxSettings, OutboundNotification

from .conftest import HX


def _by_key(results):
    return {check.key: check for check in results}


@pytest.fixture
def mail_ready(settings):
    settings.INBOUND_WEBHOOK_SECRET = "configured"
    settings.EMAIL_TRANSPORT = "resend"
    settings.RESEND_API_KEY = "configured"
    settings.APP_ENVIRONMENT = "production"


@pytest.mark.django_db
def test_all_normal_when_mail_is_configured(mail_ready):
    results = health.checks()
    assert {"database", "inbound", "outbound", "queue", "storage", "domain"} <= set(_by_key(results))
    assert health.overall(results) == {"status": "ok", "summary": "All systems normal", "problems": []}


@pytest.mark.django_db
def test_missing_inbound_secret_fails(mail_ready, settings):
    settings.INBOUND_WEBHOOK_SECRET = ""
    results = health.checks()
    assert _by_key(results)["inbound"].status == "fail"
    summary = health.overall(results)
    assert summary["status"] == "fail" and summary["summary"].startswith("Inbound mail:")


@pytest.mark.django_db
def test_log_transport_warns_only_in_production(settings):
    settings.INBOUND_WEBHOOK_SECRET = "configured"
    settings.EMAIL_TRANSPORT = "log"
    settings.APP_ENVIRONMENT = "production"
    assert _by_key(health.checks())["outbound"].status == "warn"
    settings.APP_ENVIRONMENT = "development"
    assert _by_key(health.checks())["outbound"].status == "info"


@pytest.mark.django_db
def test_rejected_latest_message_warns(mail_ready):
    inbox = InboxSettings.load()
    inbox.last_inbound_at = timezone.now() - timedelta(hours=2)
    inbox.last_inbound_error = "Could not parse the message"
    inbox.last_inbound_error_at = timezone.now() - timedelta(hours=1)
    inbox.save()
    assert _by_key(health.checks())["inbound"].status == "warn"
    InboxSettings.objects.filter(pk=1).update(last_inbound_at=timezone.now())
    assert _by_key(health.checks())["inbound"].status == "ok"


@pytest.mark.django_db
def test_stale_notification_queue_warns(mail_ready, superadmin):
    enquiry = Enquiry.objects.create(number=1, from_email="a@example.test")
    item = OutboundNotification.objects.create(
        recipient=superadmin, event="new_enquiry", enquiry=enquiry, mode="instant"
    )
    OutboundNotification.objects.filter(pk=item.pk).update(created_at=timezone.now() - timedelta(minutes=30))
    check = _by_key(health.checks())["queue"]
    assert check.status == "warn" and ("Waiting (instant)", "1") in check.details


@pytest.mark.django_db
def test_info_checks_never_lower_the_overall_status(mail_ready, settings):
    settings.ATTACHMENTS_STORAGE_ENABLED = False
    results = health.checks()
    assert _by_key(results)["storage"].status == "info"
    assert health.overall(results)["status"] == "ok"


def test_footer_is_loaded_after_the_page_and_links_to_health(client_for, superadmin, seeded, mail_ready):
    client = client_for(superadmin)
    page = client.get("/").content.decode()
    assert 'hx-get="/system/health/footer/"' in page and "Access is logged" in page
    footer = client.get("/system/health/footer/", **HX).content.decode()
    assert (
        'href="/system/health/"' in footer and "All systems normal" in footer and 'data-health="ok"' in footer
    )


def test_health_page_lists_checks_for_any_role(client_for, viewer, mail_ready):
    response = client_for(viewer).get("/system/health/")
    body = response.content.decode()
    assert response.status_code == 200
    for label in ("Database", "Inbound mail", "Outbound email", "Notification emails"):
        assert label in body
    assert 'aria-current="page" data-nav="health"' in body
    assert 'data-testid="health-footer"' not in body  # No footer link to the page you are on.


def test_health_requires_a_role(client, client_for, norole):
    assert client.get("/system/health/").status_code == 302
    assert client_for(norole).get("/system/health/").status_code == 403


def test_needs_attention_tab(client_for, superadmin, viewer, seeded):
    Enquiry.objects.create(
        number=7,
        from_email="late@example.test",
        subject="Overdue thing",
        sla_due_at=timezone.now() - timedelta(hours=1),
    )
    client = client_for(superadmin)
    listing = client.get("/notifications/").content.decode()
    assert 'data-testid="attention-tab"' in listing and ">1<" in listing
    body = client.get("/notifications/attention/").content.decode()
    assert "Overdue thing" in body and "VIT-0007" in body
    # Viewers cannot see enquiries: no tab, and the page is refused.
    viewer_client = client_for(viewer)
    assert 'data-testid="attention-tab"' not in viewer_client.get("/notifications/").content.decode()
    assert viewer_client.get("/notifications/attention/").status_code == 403


def test_pages_can_set_their_own_breadcrumbs_and_actions(client_for, superadmin, seeded):
    """Regression: the top bar was an {% include %}, so page-level breadcrumb blocks were ignored."""
    client = client_for(superadmin)
    enquiry = Enquiry.objects.create(number=42, from_email="crumb@example.test", subject="Crumbs")
    body = client.get(enquiry.get_absolute_url()).content.decode()
    assert 'font-mono text-[13px] font-medium" aria-current="page">VIT-0042</li>' in body
    assert "Manage architecture" in client.get("/service-lines/").content.decode().split("</header>")[0]
    assert ">Audit trail</li>" in client.get("/audit/").content.decode()
