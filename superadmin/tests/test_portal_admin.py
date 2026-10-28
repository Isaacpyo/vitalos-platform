"""Super Admin side of the client portal: pages, forms, publication, previews, services, seed command."""

import datetime as dt
import io

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, VIEWER
from apps.audit.models import AuditEvent
from apps.portal import ai, selectors, services
from apps.portal.models import BriefStatus, Event, ManagedService, Organisation, ServiceStatusReport
from tests.conftest import login
from tests.portal_helpers import INTERNAL, build_world, client_for


@pytest.fixture
def world(db):
    return build_world()


@pytest.fixture
def staff(world):
    return client_for(world.staff)


def test_every_staff_page_renders_for_staff(world, staff):
    paths = [
        "/client-portal/",
        "/client-portal/deliveries/",
        "/client-portal/orgs/new/",
        f"/client-portal/orgs/{world.org_a.pk}/",
        f"/client-portal/orgs/{world.org_a.pk}/services/new/",
        f"/client-portal/challenges/{world.ch_a.pk}/",
        f"/client-portal/challenges/{world.ch_a.pk}/edit/",
        f"/client-portal/challenges/{world.ch_a.pk}/briefs/new/",
        f"/client-portal/challenges/{world.ch_a.pk}/projects/new/",
        f"/client-portal/projects/{world.project_a.pk}/",
        f"/client-portal/projects/{world.project_a.pk}/edit/",
        f"/client-portal/projects/{world.project_a.pk}/milestones/new/",
        f"/client-portal/milestones/{world.ms1.pk}/edit/",
        f"/client-portal/projects/{world.project_a.pk}/items/new/",
        f"/client-portal/items/{world.item.pk}/edit/",
        f"/client-portal/projects/{world.project_a.pk}/deliverables/new/",
        f"/client-portal/deliverables/{world.deliv_a.pk}/",
        f"/client-portal/deliverables/{world.deliv_a.pk}/edit/",
        f"/client-portal/deliverables/{world.deliv_a.pk}/versions/new/",
        f"/client-portal/challenges/{world.ch_a.pk}/updates/new/",
        f"/client-portal/updates/{world.draft_update.pk}/edit/",
        f"/client-portal/challenges/{world.ch_a.pk}/questions/new/",
        f"/client-portal/challenges/{world.ch_a.pk}/files/new/",
        f"/client-portal/services/{world.svc_a.pk}/edit/",
        f"/client-portal/services/{world.svc_a.pk}/report/",
        f"/client-portal/preview-draft/update/{world.draft_update.pk}/",
        f"/client-portal/preview-draft/brief/{world.draft_brief.pk}/",
        f"/client-portal/preview-draft/version/{world.v1.pk}/",
    ]
    for path in paths:
        assert staff.get(path).status_code == 200, path


def test_staff_pages_require_a_staff_role(world, make_user):
    viewer = make_user(VIEWER, email="viewer-role@example.test")
    assert (
        login(__import__("django.test", fromlist=["Client"]).Client(), viewer)
        .get("/client-portal/")
        .status_code
        == 403
    )
    lead = make_user(SERVICE_LEAD, email="lead-role@example.test")
    assert (
        login(__import__("django.test", fromlist=["Client"]).Client(), lead)
        .get("/client-portal/")
        .status_code
        == 200
    )


def test_navigation_shows_the_client_portal_area_to_staff_only(world, staff):
    assert b"Client portal" in staff.get("/").content
    assert b"/client-portal/" in staff.get("/").content


def test_org_invite_revoke_restore_role_flow(world, staff, mailoutbox):
    staff.post("/client-portal/orgs/new/", {"name": "Fabrikam Synthetic Ltd", "is_synthetic": "on"})
    org = Organisation.objects.get(name="Fabrikam Synthetic Ltd")
    assert org.is_synthetic
    mailoutbox.clear()
    staff.post(
        f"/client-portal/orgs/{org.pk}/invite/",
        {"email": "new@fabrikam.example.test", "full_name": "New", "role": "viewer"},
    )
    assert len(mailoutbox) == 1
    member = org.memberships.get()
    assert b"Invited" in staff.get(f"/client-portal/orgs/{org.pk}/").content
    staff.post(f"/client-portal/members/{member.pk}/role/", {"role": "approver"})
    member.refresh_from_db()
    assert member.role == "approver"
    staff.post(f"/client-portal/members/{member.pk}/revoke/")
    member.refresh_from_db()
    assert member.revoked_at and not member.is_active
    staff.post(f"/client-portal/members/{member.pk}/restore/")
    member.refresh_from_db()
    assert member.is_active
    for action in (
        "portal.org_created",
        "portal.member_invited",
        "portal.member_role_changed",
        "portal.member_revoked",
        "portal.member_restored",
    ):
        assert AuditEvent.objects.filter(action=action).exists(), action


def test_invitation_to_an_existing_staff_address_is_refused_in_the_ui(world, staff):
    response = staff.post(
        f"/client-portal/orgs/{world.org_a.pk}/invite/",
        {"email": world.staff.email, "full_name": "x", "role": "viewer"},
        follow=True,
    )
    assert b"staff account" in response.content.lower()


def test_brief_form_requires_provenance_tags_and_drafts_stay_internal(world, staff):
    bad = staff.post(
        f"/client-portal/challenges/{world.ch_a.pk}/briefs/new/",
        {"summary": "s", "change_note": "", "segments": "no tag here"},
    )
    assert bad.status_code == 200 and b"must start with customer:" in bad.content
    ok = staff.post(
        f"/client-portal/challenges/{world.ch_a.pk}/briefs/new/",
        {
            "summary": "Weekly check",
            "change_note": "Added",
            "segments": "customer: We check statements weekly.\nfact: Statements arrive as PDF.\nai: Flag duplicate invoices.",
        },
    )
    assert ok.status_code == 302
    brief = world.ch_a.briefs.order_by("-number").first()
    assert [s["provenance"] for s in brief.segments] == ["customer_statement", "agreed_fact", "ai_suggestion"]
    assert brief.status == BriefStatus.DRAFT
    assert (
        b"Flag duplicate invoices"
        not in client_for(world.approver.user).get(f"/portal/challenges/{world.ch_a.pk}/").content
    )
    preview = staff.get(f"/client-portal/preview-draft/brief/{brief.pk}/").content.decode()
    assert (
        "Preview: not published" in preview
        and "AI suggestion" in preview
        and "Flag duplicate invoices" in preview
    )
    staff.post(f"/client-portal/briefs/{brief.pk}/propose/")
    page = client_for(world.approver.user).get(f"/portal/challenges/{world.ch_a.pk}/").content.decode()
    assert (
        "Flag duplicate invoices" in page and "AI suggestion" in page
    )  # labelled, and only after a person proposed it


def test_draft_update_preview_then_publish(world, staff, mailoutbox):
    preview = staff.get(f"/client-portal/preview-draft/update/{world.draft_update.pk}/").content.decode()
    assert "Preview: not published" in preview and INTERNAL["draft_update"] in preview
    assert INTERNAL["draft_update"] not in client_for(world.approver.user).get("/portal/").content.decode()
    mailoutbox.clear()
    staff.post(f"/client-portal/updates/{world.draft_update.pk}/publish/")
    world.draft_update.refresh_from_db()
    assert world.draft_update.status == "published" and world.draft_update.published_by == world.staff
    assert (
        INTERNAL["draft_update"]
        in client_for(world.approver.user).get(f"/portal/updates/{world.draft_update.pk}/").content.decode()
    )
    assert mailoutbox  # members were notified
    with pytest.raises(services.PortalError):
        services.publish_update(world.draft_update, actor=world.staff)  # not twice
    with pytest.raises(services.PortalError):
        services.save_update(
            world.ch_a, title="t", body="b", actor=world.staff, update=world.draft_update
        )  # published = frozen


def test_publish_toggle_hides_and_shows(world, staff):
    client = client_for(world.approver.user)
    assert b"Prototype review" in client.get(f"/portal/projects/{world.project_a.pk}/").content
    staff.post(f"/client-portal/publish/milestone/{world.ms2.pk}/off/")
    assert b"Prototype review" not in client.get(f"/portal/projects/{world.project_a.pk}/").content
    staff.post(f"/client-portal/publish/milestone/{world.ms_hidden.pk}/on/")
    assert b"Hidden internal milestone" in client.get(f"/portal/projects/{world.project_a.pk}/").content
    assert staff.post("/client-portal/publish/nonsense/1/on/").status_code == 404
    assert AuditEvent.objects.filter(action__in=["portal.published", "portal.unpublished"]).exists()


def test_staff_post_actions_need_post_and_csrf_free_gets_are_refused(world, staff):
    assert staff.get(f"/client-portal/challenges/{world.ch_a.pk}/share/").status_code == 405
    assert staff.get(f"/client-portal/versions/{world.v1.pk}/share/").status_code == 405
    assert staff.get(f"/client-portal/publish/project/{world.project_a.pk}/on/").status_code == 405


def test_outstanding_decisions_dashboard(world, staff):
    page = staff.get("/client-portal/").content.decode()
    assert "Prototype report v1" in page and "Which ledger system do you use?" in page
    services.approve_version(world.approver, world.v1)
    page = staff.get("/client-portal/").content.decode()
    assert (
        "Prototype report v1"
        not in page.split("Deliverable versions awaiting approval")[1].split("Briefs awaiting review")[0]
    )
    services.request_change(
        world.contrib, world.project_a, title="Move the date", description="d", affects="dates"
    )
    assert "Move the date" in staff.get("/client-portal/").content.decode()
    assert Event.objects.filter(actor_is_customer=True).exists()
    assert "Alma Approver approved" in staff.get("/client-portal/").content.decode()


def test_internal_notes_are_visible_to_staff_only(world, staff):
    admin_body = staff.get(f"/client-portal/projects/{world.project_a.pk}/").content.decode()
    assert INTERNAL["project"] in admin_body
    assert INTERNAL["challenge"] in staff.get(f"/client-portal/challenges/{world.ch_a.pk}/").content.decode()
    assert (
        INTERNAL["version"] in staff.get(f"/client-portal/deliverables/{world.deliv_a.pk}/").content.decode()
    )


def test_staff_can_post_internal_notes_that_customers_never_see(world, staff):
    staff.post(
        f"/client-portal/challenges/{world.ch_a.pk}/messages/",
        {"body": "Internal: pricing thoughts", "internal": "on"},
    )
    staff.post(f"/client-portal/challenges/{world.ch_a.pk}/messages/", {"body": "Hello from Vitalos"})
    customer = client_for(world.approver.user).get(f"/portal/challenges/{world.ch_a.pk}/").content.decode()
    assert "Hello from Vitalos" in customer and "pricing thoughts" not in customer
    assert (
        "Internal: pricing thoughts"
        in staff.get(f"/client-portal/challenges/{world.ch_a.pk}/").content.decode()
    )


def test_file_visibility_toggle(world, staff):
    staff.post(f"/client-portal/files/{world.internal_file.file_id}/visibility/", {"visibility": "customer"})
    assert b"INTERNAL-FILE-TITLE" in client_for(world.approver.user).get("/portal/files/").content
    staff.post(f"/client-portal/files/{world.internal_file.file_id}/visibility/", {"visibility": "internal"})
    assert b"INTERNAL-FILE-TITLE" not in client_for(world.approver.user).get("/portal/files/").content


# --- managed services -------------------------------------------------------------------------------------------


def test_managed_service_shows_source_last_updated_and_never_pretends_to_be_live(world):
    client = client_for(world.approver.user)
    page = client.get("/portal/").content.decode()
    assert (
        "Manually reported by Vitalos" in page
        and "Last updated" in page
        and "does not have live monitoring" in page
    )
    assert "Live" not in page.replace("Live monitoring", "")  # no live label anywhere
    assert "Stale" not in page


def test_stale_manual_report_is_labelled_stale(world, settings):
    settings.PORTAL_STATUS_STALE_HOURS = 24
    service = services.save_service(world.org_a, name="Old feed", actor=world.staff)
    services.set_published(service, True, actor=world.staff)
    services.report_status(
        service,
        status="degraded",
        summary="Slow",
        actor=world.staff,
        reported_at=timezone.now() - dt.timedelta(days=5),
    )
    freshness = selectors.report_freshness(selectors.latest_report(service))
    assert freshness["stale"] and freshness["is_manual"]
    page = client_for(world.approver.user).get("/portal/").content.decode()
    assert "Stale" in page and "may no longer be accurate" in page
    fresh = selectors.report_freshness(selectors.latest_report(world.svc_a))
    assert not fresh["stale"]


def test_unpublished_service_and_report_are_hidden_and_internal_notes_never_shown(world, staff):
    service = services.save_service(
        world.org_a, name="Secret service", actor=world.staff, internal_notes=INTERNAL["service"]
    )
    client = client_for(world.approver.user)
    assert b"Secret service" not in client.get("/portal/").content
    services.set_published(service, True, actor=world.staff)
    services.report_status(service, status="incident", summary="Down", actor=world.staff, publish=False)
    body = client.get("/portal/").content.decode()
    assert "Secret service" in body and "No report yet" in body and INTERNAL["service"] not in body
    assert (
        ManagedService.objects.filter(pk=service.pk).exists()
        and ServiceStatusReport.objects.filter(service=service, published_at__isnull=True).exists()
    )


def test_no_percentage_complete_exists_anywhere():
    from apps.portal import models

    for model in (models.Milestone, models.Project, models.Deliverable):
        names = {f.name for f in model._meta.get_fields()}
        assert not {n for n in names if "percent" in n or "progress" in n or "complete_pct" in n}


# --- seed command -------------------------------------------------------------------------------------------------


def test_seed_refuses_outside_debug_and_in_production(db, settings):
    settings.DEBUG = False
    with pytest.raises(CommandError, match="DEBUG"):
        call_command("portal_seed_demo", stdout=io.StringIO())
    settings.DEBUG = True
    settings.APP_ENVIRONMENT = "production"
    with pytest.raises(CommandError, match="production|DEBUG"):
        call_command("portal_seed_demo", stdout=io.StringIO())
    assert not Organisation.objects.exists()


def test_seed_creates_labelled_synthetic_data_and_sends_no_email(db, settings, mailoutbox):
    settings.DEBUG = True
    settings.APP_ENVIRONMENT = "development"
    out = io.StringIO()
    call_command("portal_seed_demo", password="Seed-Synthetic-Pass-1!", stdout=out)
    assert mailoutbox == []
    names = set(Organisation.objects.values_list("name", flat=True))
    assert names == {"Northwind Synthetic Ltd", "Contoso Synthetic plc"}
    assert all(Organisation.objects.values_list("is_synthetic", flat=True))
    with pytest.raises(CommandError, match="already exists"):
        call_command("portal_seed_demo", stdout=io.StringIO())
    call_command("portal_seed_demo", reset=True, password="Seed-Synthetic-Pass-1!", stdout=io.StringIO())
    assert Organisation.objects.count() == 2
    from django.test import Client

    client = Client()
    assert (
        client.post(
            "/portal/sign-in/",
            {"email": "approver@northwind.example.test", "password": "Seed-Synthetic-Pass-1!"},
        ).status_code
        == 302
    )
    home = client.get("/portal/").content.decode()
    assert "Synthetic demonstration organisation" in home and "Prototype review" in home
    # The replayed demonstration answer cites seeded records and says it is simulated.
    settings.PORTAL_AI_REPLAY = True
    member = selectors.get_membership(
        __import__("apps.accounts.models", fromlist=["User"]).User.objects.get(
            email="approver@northwind.example.test"
        )
    )
    project = selectors.projects(member).first()
    answer = ai.answer("summarise_project", member, project=project, use_replay=True)
    assert answer.mode == "simulated" and answer.label.startswith("Simulated answer for demonstration")
    assert len(answer.points) >= 4 and all(p.sources for p in answer.points)
    needed = ai.answer("what_needed", member, use_replay=True)
    assert needed.mode == "simulated" and needed.points
    clarify = ai.answer(
        "clarify_challenge", member, challenge=selectors.challenges(member).first(), use_replay=True
    )
    assert clarify.draft
