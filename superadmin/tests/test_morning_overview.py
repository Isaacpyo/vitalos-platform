"""The morning Overview, website analytics card, architecture module flag and web sync, Help guides,
row action menus and the primary-owner transfer command (findings E3, E4, F1, F2, F5, F6, F7)."""

import io
from datetime import timedelta

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.urls import reverse
from django.utils import timezone
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.architecture import web_sync
from apps.architecture.models import Offer, Practice, Solution
from apps.core import analytics, morning
from apps.enquiries import services as enquiry_services
from apps.enquiries.models import Enquiry

pytestmark = pytest.mark.django_db


def _section(context, key):
    return next(section for section in context["sections"] if section.key == key)


def _count(section, key):
    return next(count for count in section.counts if count.key == key)


# --- Overview -----------------------------------------------------------------------------------


def test_overview_with_empty_data(superadmin, seeded, client_for, settings):
    settings.RELAY_API_BASE_URL = ""
    settings.RELAY_CLIENT = "http"
    html = client_for(superadmin).get(reverse("architecture:home")).content.decode()
    assert 'data-testid="attention-empty"' in html
    for key in ("enquiries", "careers", "insights", "sync", "health", "analytics"):
        assert f'data-section="{key}"' in html
    assert 'data-section="relay"' not in html  # Relay not configured
    assert 'data-count="enquiries-overdue">0<' in html
    # Service-line cards moved to the Service lines page.
    assert "Practices → Solutions → Offers, owned line by line." not in html
    lines = client_for(superadmin).get(reverse("architecture:service_lines")).content.decode()
    assert "Practices → Solutions → Offers, owned line by line." in lines


def test_overview_with_real_data_links_every_count(superadmin, seeded, client_for, relay):
    from apps.careers.models import Role, RoleStatus
    from apps.insights.models import Post, PostStatus

    enquiry = enquiry_services.create_enquiry(
        subject="Late one",
        from_name="A Customer",
        from_email="a@customer.example",
        to_email="support@vitalos.co.uk",
        source="email",
        snippet="Late",
    )
    Enquiry.objects.filter(pk=enquiry.pk).update(sla_due_at=timezone.now() - timedelta(hours=1))
    Role.objects.create(title="Draft role", status=RoleStatus.DRAFT)
    Post.objects.create(title="Waiting post", status=PostStatus.IN_REVIEW)
    context = morning.build(superadmin)
    enquiries = _section(context, "enquiries")
    assert _count(enquiries, "overdue").value == 1
    assert _count(enquiries, "overdue").url == reverse("enquiries:inbox") + "?f=overdue"
    assert _count(_section(context, "careers"), "drafts").value == 1
    assert _count(_section(context, "insights"), "review").value == 1
    relay_section = _section(context, "relay")
    assert not relay_section.error
    assert _count(relay_section, "waiting").value >= 1
    # GET /overview (ADR-048): Master FAQ entries plus drafted repo entries awaiting confirmation
    assert _count(relay_section, "awaiting").value == 5
    assert _count(relay_section, "waiting").url == reverse("relay:inbox") + "?tab=needs"
    for section in context["sections"]:
        for count in section.counts:
            assert count.url.startswith("/"), (section.key, count.key)
    html = client_for(superadmin).get(reverse("architecture:home")).content.decode()
    assert "Late one" in html and 'data-section="relay"' in html


def test_overview_relay_degrades_when_unreachable(superadmin, relay, client_for):
    from apps.relay.client import RelayError

    class Broken:
        def inbox(self, *args, **kwargs):
            raise RelayError("unavailable")

    from unittest import mock

    with mock.patch("apps.relay.client.get_client", return_value=Broken()):
        section = morning.relay_section(superadmin, timezone.now())
    assert section.error.startswith("Relay not reachable")
    assert section.counts == []


def test_overview_hides_sections_a_viewer_may_not_see(viewer, seeded, client_for):
    context = morning.build(viewer)
    keys = {section.key for section in context["sections"]}
    assert "enquiries" not in keys and "relay" not in keys
    assert context["attention"] == []


def test_analytics_card_links_out_and_uses_an_adapter_when_one_exists(settings):
    settings.ANALYTICS_PROVIDER = "vercel"
    settings.ANALYTICS_DASHBOARD_URL = "https://vercel.com/example/analytics"
    card = analytics.card()
    assert card.dashboard_url.endswith("/analytics") and card.metrics == [] and "read API" in card.note

    @analytics.register("example")
    class Example:
        name = "example"

        def summary(self, days):
            return [analytics.Metric("Visitors", "120")]

    try:
        settings.ANALYTICS_PROVIDER = "example"
        settings.ANALYTICS_API_KEY = ""
        assert "ANALYTICS_API_KEY" in analytics.card().note
        settings.ANALYTICS_API_KEY = "test-key"
        assert analytics.card().metrics == [analytics.Metric("Visitors", "120")]
    finally:
        analytics.ADAPTERS.pop("example", None)


# --- Architecture module ------------------------------------------------------------------------


def test_architecture_module_flag_hides_nav_pages_and_filters(superadmin, seeded, client_for, settings):
    client = client_for(superadmin)
    html = client.get(reverse("architecture:home")).content.decode()
    assert reverse("architecture:service_lines") in html and reverse("architecture:architecture") in html
    settings.ARCHITECTURE_MODULE_ENABLED = False
    html = client.get(reverse("architecture:home")).content.decode()
    assert f'href="{reverse("architecture:service_lines")}"' not in html
    assert f'href="{reverse("architecture:architecture")}"' not in html
    assert client.get(reverse("architecture:service_lines")).status_code == 404
    assert client.get(reverse("architecture:architecture")).status_code == 404
    assert client.get(reverse("architecture:service_dashboard", args=["consulting"])).status_code == 404
    assert 'id="filter-line"' not in client.get(reverse("architecture:activity")).content.decode()


WEB = {
    "practices": [
        {
            "slug": "consulting",
            "title": "Consulting",
            "summary": "Clarity.",
            "path": "/what-we-do/consulting",
            "order": 0,
            "solutions": ["ai-transformation"],
        },
        {
            "slug": "labs",
            "title": "Vitalos Labs",
            "summary": "",
            "path": "/labs",
            "order": 5,
            "solutions": [],
        },
        {"slug": "unknown", "title": "Unknown", "summary": "", "path": "/x", "order": 6, "solutions": []},
    ],
    "solutions": [
        {
            "slug": "ai-transformation",
            "title": "AI Transformation",
            "summary": "Value.",
            "path": "/solutions/ai-transformation",
            "order": 0,
            "practices": ["consulting"],
            "offers": ["ai-opportunity-assessment"],
        },
    ],
    "offers": [
        {
            "slug": "ai-opportunity-assessment",
            "title": "AI Opportunity Assessment",
            "summary": "Find it.",
            "path": "/offers/ai-opportunity-assessment",
            "order": 0,
            "solutions": ["ai-transformation"],
            "practices": ["consulting"],
        },
        {
            "slug": "orphan",
            "title": "Orphan",
            "summary": "",
            "path": "/offers/orphan",
            "order": 1,
            "solutions": ["missing"],
            "practices": [],
        },
    ],
}


def test_sync_architecture_dry_run_then_apply(seeded, settings):
    settings.CONTENT_WEB_TARGETS = ["https://vitalos.co.uk"]
    report = web_sync.sync(WEB)
    assert len(report.created) == 4 and Practice.objects.count() == 0  # rolled back
    assert any("unknown" in line for line in report.skipped)
    assert any("orphan" in line for line in report.skipped)
    web_sync.sync(WEB, apply=True)
    labs = Practice.objects.get(slug="labs")
    assert labs.service_line.slug == "labs" and labs.public_url == "https://vitalos.co.uk/labs"
    offer = Offer.objects.get(slug="ai-opportunity-assessment")
    assert offer.solution.practice.slug == "consulting" and offer.status == "active"
    assert Solution.objects.get().public_url == "https://vitalos.co.uk/solutions/ai-transformation"
    again = web_sync.sync(WEB, apply=True)
    assert again.created == [] and again.updated == [] and len(again.unchanged) == 4


def test_sync_architecture_command_reads_the_committed_export(seeded):
    data = web_sync.load()
    assert len(data["practices"]) == 6 and data["practices"][-1]["slug"] == "labs"
    out = io.StringIO()
    call_command("sync_architecture_from_web", stdout=out)
    assert "Dry run" in out.getvalue() and Practice.objects.count() == 0


# --- Help ---------------------------------------------------------------------------------------


def test_help_has_six_workflow_guides(viewer, client_for):
    html = client_for(viewer).get(reverse("core:help")).content.decode()
    for slug in (
        "answer-an-enquiry",
        "review-and-publish-an-insight",
        "review-an-application",
        "confirm-a-faq-entry",
        "answer-a-gap",
        "take-over-a-conversation",
    ):
        assert f'data-guide="{slug}"' in html and f'href="#{slug}"' in html


# --- Row actions (E3) ---------------------------------------------------------------------------


def test_post_and_role_tables_use_one_primary_action_and_a_menu(superadmin, client_for):
    from apps.careers.models import Role, RoleStatus
    from apps.insights.models import Post, PostStatus

    Post.objects.create(title="Menu post", status=PostStatus.DRAFT)
    Role.objects.create(title="Menu role", status=RoleStatus.OPEN)
    client = client_for(superadmin)
    posts = client.get(reverse("insights:posts")).content.decode()
    assert 'class="col-actions"' in posts and 'aria-label="More actions for Menu post"' in posts
    assert "Duplicate</button>" in posts and "Archive</summary>" in posts
    roles = client.get(reverse("careers:roles")).content.decode()
    assert 'class="col-actions"' in roles and "Menu role" in roles
    applications = client.get(reverse("careers:applications")).content.decode()
    assert 'class="col-actions"' in applications


# --- Primary owner (F7) -------------------------------------------------------------------------


def test_transfer_primary_owner_is_a_dry_run_and_needs_two_factor(make_user):
    from apps.accounts.roles import SUPERADMIN
    from apps.accounts.services import ensure_primary_owner, primary_owner

    ensure_primary_owner("admin@example.test")
    person = make_user(SUPERADMIN, email="temitope.agbola@example.test", full_name="Temitope Agbola")
    with pytest.raises(CommandError, match="authenticator"):
        call_command("transfer_primary_owner", "--to", person.email, stdout=io.StringIO())
    TOTPDevice.objects.create(user=person, name="phone", confirmed=True)
    out = io.StringIO()
    call_command("transfer_primary_owner", "--to", person.email, stdout=out)
    assert "Dry run" in out.getvalue() and primary_owner().email == "admin@example.test"
    call_command("transfer_primary_owner", "--to", person.email, "--apply", stdout=io.StringIO())
    assert primary_owner() == person
    with pytest.raises(CommandError, match="No user"):
        call_command("transfer_primary_owner", "--to", "nobody@example.test", stdout=io.StringIO())
