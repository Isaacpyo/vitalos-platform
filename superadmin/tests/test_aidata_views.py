"""AI & Data pages: access, POST-only and CSRF, forms, audit and the enquiry button. Fictional data only."""

from datetime import date
from decimal import Decimal

import pytest
from django.test import Client

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN
from apps.aidata import selectors, services
from apps.aidata.models import BudgetSettings, CostEntry, OfferPrice, Opportunity, Stage
from apps.audit.models import AuditEvent
from apps.enquiries import services as enquiry_services
from apps.enquiries.models import Enquiry
from tests.conftest import HX, login


@pytest.fixture
def admin(make_user):
    return make_user(SUPERADMIN, email="owner@example.test")


@pytest.fixture
def service_lead(make_user):
    return make_user(SERVICE_LEAD, email="lead-ai@example.test")


@pytest.fixture
def opportunity(admin):
    return services.create_opportunity(
        {
            "title": "Reconciliation pilot",
            "organisation": "Example Ledger Ltd",
            "sector": "accounting-bookkeeping",
        },
        admin,
    )


@pytest.fixture
def enquiry(db):
    return enquiry_services.create_enquiry(
        subject="AI for our statements",
        from_name="Sam Example",
        from_email="sam@example-ledger.example",
        to_email="support@vitalos.co.uk",
        source=Enquiry.Source.EMAIL,
        snippet="Could AI help reconcile supplier statements?",
    )


PAGES = [
    "/ai-data/",
    "/ai-data/pipeline/",
    "/ai-data/pipeline/new/",
    "/ai-data/pipeline/OPP-0001/",
    "/ai-data/offers/",
    "/ai-data/budget/",
]


@pytest.mark.parametrize("path", PAGES)
def test_anonymous_users_go_to_sign_in(db, opportunity, path):
    response = Client().get(path)
    assert response.status_code == 302 and "/login/" in response["Location"]


@pytest.mark.parametrize("path", PAGES)
def test_viewers_and_users_without_a_role_are_refused(client_for, viewer, norole, opportunity, path):
    for user in (viewer, norole):
        assert client_for(user).get(path).status_code == 403


@pytest.mark.parametrize("path", PAGES)
def test_superadmin_and_service_lead_see_every_page(client_for, admin, service_lead, opportunity, path):
    for user in (admin, service_lead):
        assert client_for(user).get(path).status_code == 200


def test_overview_shows_counts_overdue_budget_and_links(client_for, admin, opportunity):
    from datetime import date

    services.update_details(
        opportunity, {"next_action": "Call back", "next_action_due": date(2026, 1, 5)}, admin
    )
    body = client_for(admin).get("/ai-data/").content.decode()
    for text in (
        "Pipeline by stage",
        "Overdue next actions",
        "Budget used",
        "/ai-data/demonstrator/",
        "£1,000",
    ):
        assert text in body
    assert opportunity.ref in body  # listed as overdue


def test_pipeline_filters(client_for, admin, opportunity):
    services.create_opportunity({"title": "Garage parts ordering", "sector": "automotive"}, admin)
    client = client_for(admin)
    body = client.get("/ai-data/pipeline/?sector=automotive").content.decode()
    assert "Garage parts ordering" in body and "Reconciliation pilot" not in body
    body = client.get("/ai-data/pipeline/?q=OPP-0001").content.decode()
    assert "Reconciliation pilot" in body and "Garage parts ordering" not in body
    body = client.get("/ai-data/pipeline/?stage=won").content.decode()
    assert "No opportunities here." in body
    body = client.get(f"/ai-data/pipeline/?owner={admin.pk}&overdue=1").content.decode()
    assert "No opportunities here." in body


def test_detail_shows_scorecard_customer_and_internal_labels(client_for, admin, opportunity):
    body = client_for(admin).get(opportunity.get_absolute_url() + "?tab=details").content.decode()
    for text in ("Qualification scorecard", "Not scored", "May be shared with the customer", "Internal only",
                 "Estimated value (GBP, estimate)", '<option value="reviewing">Reviewing</option>'):  # fmt: skip
        assert text in body
    assert '<option value="won">' not in body  # only allowed moves are offered
    assert "Assessment / Proposal" in client_for(admin).get("/ai-data/pipeline/").content.decode()


ACTIONS = [
    ("/ai-data/pipeline/OPP-0001/edit/", {"title": "x"}),
    ("/ai-data/pipeline/OPP-0001/score/", {}),
    ("/ai-data/pipeline/OPP-0001/stage/", {"stage": "reviewing"}),
    ("/ai-data/pipeline/OPP-0001/note/", {"body": "x"}),
    ("/ai-data/budget/costs/1/delete/", {}),
]


@pytest.mark.parametrize(("path", "data"), ACTIONS)
def test_actions_are_post_only(client_for, admin, opportunity, path, data):
    CostEntry.objects.create(
        pk=1, date="2026-10-28", category="ai-api", supplier="Example", description="x", amount=Decimal("1")
    )
    assert client_for(admin).get(path).status_code == 405


@pytest.mark.parametrize(("path", "data"), ACTIONS)
def test_actions_need_a_csrf_token(admin, opportunity, path, data):
    client = login(Client(enforce_csrf_checks=True), admin)
    assert client.post(path, data).status_code == 403


def test_stage_change_through_the_page_is_audited(client_for, service_lead, opportunity):
    client = client_for(service_lead)
    response = client.post(f"{opportunity.get_absolute_url()}stage/", {"stage": "reviewing"})
    assert response.status_code == 302
    opportunity.refresh_from_db()
    assert opportunity.stage == Stage.REVIEWING
    assert AuditEvent.objects.filter(action="aidata.stage_changed", actor=service_lead).exists()


def test_stage_errors_are_shown_on_the_form(client_for, admin, opportunity):
    client = client_for(admin)
    response = client.post(f"{opportunity.get_absolute_url()}stage/", {"stage": "lost", "reason": ""})
    assert response.status_code == 400 and "Give a reason" in response.content.decode()
    response = client.post(f"{opportunity.get_absolute_url()}stage/", {"stage": "won"})
    assert response.status_code == 400  # not an allowed choice from New
    opportunity.refresh_from_db()
    assert opportunity.stage == Stage.NEW


def test_details_scorecard_and_note_forms(client_for, admin, opportunity):
    client = client_for(admin)
    url = opportunity.get_absolute_url()
    response = client.post(
        f"{url}edit/",
        {"title": "Reconciliation pilot", "source": "referral", "offer": "ai-proof-of-value",
         "contact_email": "not-an-email"},
    )  # fmt: skip
    assert response.status_code == 400 and "Enter a valid email address." in response.content.decode()
    response = client.post(
        f"{url}edit/", {"title": "Reconciliation pilot", "source": "referral", "offer": "ai-proof-of-value"}
    )
    assert response.status_code == 302
    opportunity.refresh_from_db()
    assert opportunity.offer == "ai-proof-of-value" and opportunity.estimated_value == Decimal("1500.00")
    scores = {"score_problem": "5", "score_economic": "4", "score_budget": "4", "score_data": "3",
              "score_feasibility": "4", "score_reuse": "3"}  # fmt: skip
    response = client.post(f"{url}score/", scores)
    assert response.status_code == 302
    opportunity.refresh_from_db()
    assert opportunity.score == Decimal("80.0")
    response = client.post(f"{url}score/", {**scores, "risk_override": "on"})
    assert (
        response.status_code == 400 and "Give the reason for the risk override." in response.content.decode()
    )
    assert client.post(f"{url}note/", {"body": "Spoke to the owner."}).status_code == 302
    assert opportunity.notes.count() == 1


def test_score_preview_is_computed_on_the_server_and_changes_nothing(client_for, admin, opportunity):
    url = f"{opportunity.get_absolute_url()}score/preview/"
    query = "score_problem=4&score_economic=4&score_budget=4&score_data=4&score_feasibility=4&score_reuse=4"
    body = client_for(admin).get(f"{url}?{query}", **HX).content.decode()
    assert "80.0" in body and "Proposal candidate" in body and "Preview" in body
    body = client_for(admin).get(f"{url}?{query}&risk_override=on", **HX).content.decode()
    assert "Blocked by risk" in body
    opportunity.refresh_from_db()
    assert opportunity.score is None


def test_service_lead_cannot_edit_prices_or_budget(client_for, service_lead):
    client = client_for(service_lead)
    assert client.get("/ai-data/offers/ai-proof-of-value/edit/").status_code == 403
    assert client.post("/ai-data/offers/ai-proof-of-value/edit/", {"price": "1"}).status_code == 403
    assert client.get("/ai-data/budget/ceilings/").status_code == 403
    assert client.post("/ai-data/budget/costs/new/", {"amount": "1"}).status_code == 403
    entry = CostEntry.objects.create(
        date="2026-10-28", category="ai-api", supplier="Example", description="x", amount=Decimal("1")
    )
    assert client.post(f"/ai-data/budget/costs/{entry.pk}/delete/").status_code == 403
    assert CostEntry.objects.filter(pk=entry.pk).exists()
    assert OfferPrice.objects.get(key="ai-proof-of-value").price == Decimal("1500.00")
    offers = client.get("/ai-data/offers/").content.decode()
    assert "/edit/" not in offers and "Only a super admin can change prices." in offers


def test_superadmin_edits_a_price_and_it_is_audited(client_for, admin):
    response = client_for(admin).post(
        "/ai-data/offers/ai-opportunity-assessment/edit/",
        {
            "name": "AI Opportunity Assessment",
            "price": "395.00",
            "basis": "fixed",
            "status": "proposed",
            "notes": "",
        },
    )
    assert response.status_code == 302
    assert OfferPrice.objects.get(key="ai-opportunity-assessment").price == Decimal("395.00")
    assert AuditEvent.objects.filter(action="aidata.offer_price_changed", actor=admin).exists()


def test_superadmin_records_edits_and_deletes_costs(client_for, admin):
    client = client_for(admin)
    data = {"date": "2026-10-28", "category": "ai-api", "supplier": "Example Model Co", "description": "Test credits",
            "amount": "20.00", "kind": "actual", "recurrence": "none", "owner": "", "evidence_link": ""}  # fmt: skip
    assert client.post("/ai-data/budget/costs/new/", data).status_code == 302
    entry = CostEntry.objects.get()
    assert entry.created_by == admin
    assert (
        client.post(f"/ai-data/budget/costs/{entry.pk}/edit/", {**data, "amount": "25.00"}).status_code == 302
    )
    entry.refresh_from_db()
    assert entry.amount == Decimal("25.00")
    bad = client.post("/ai-data/budget/costs/new/", {**data, "evidence_link": "javascript:alert(1)"})
    assert bad.status_code == 200 and CostEntry.objects.count() == 1
    assert client.post(f"/ai-data/budget/costs/{entry.pk}/delete/").status_code == 302
    assert not CostEntry.objects.exists()
    actions = set(AuditEvent.objects.filter(actor=admin).values_list("action", flat=True))
    assert {"aidata.cost_added", "aidata.cost_changed", "aidata.cost_deleted"} <= actions


def test_superadmin_changes_ceilings(client_for, admin):
    data = {"overall_ceiling": "1000", "ceiling_outreach": "150", "ceiling_ai_api": "200",
            "ceiling_infrastructure": "150", "ceiling_website": "100", "ceiling_contracts": "150",
            "ceiling_contingency": "250"}  # fmt: skip
    assert client_for(admin).post("/ai-data/budget/ceilings/", data).status_code == 302
    assert BudgetSettings.load().ceiling_ai_api == Decimal("200")
    assert AuditEvent.objects.filter(action="aidata.budget_changed").exists()


def test_budget_page_notes_a_cloud_alert_is_not_a_cap(client_for, service_lead):
    body = client_for(service_lead).get("/ai-data/budget/").content.decode()
    assert "A cloud budget alert is not a spending cap." in body
    assert "Known spend is £0." in body and "View only." in body


def test_enquiry_detail_offers_create_opportunity_then_links_it(client_for, service_lead, enquiry):
    client = client_for(service_lead)
    body = client.get(enquiry.get_absolute_url()).content.decode()
    assert 'data-testid="create-opportunity"' in body and f"/ai-data/from-enquiry/{enquiry.ref}/" in body
    assert client.get(f"/ai-data/from-enquiry/{enquiry.ref}/").status_code == 405
    response = client.post(f"/ai-data/from-enquiry/{enquiry.ref}/")
    opportunity = Opportunity.objects.get(enquiry=enquiry)
    assert response.status_code == 302 and response["Location"] == opportunity.get_absolute_url()
    assert client.post(f"/ai-data/from-enquiry/{enquiry.ref}/").status_code == 302
    assert Opportunity.objects.count() == 1
    body = client.get(enquiry.get_absolute_url()).content.decode()
    assert f"Opportunity {opportunity.ref}" in body and 'data-testid="create-opportunity"' not in body
    detail = client.get(opportunity.get_absolute_url()).content.decode()
    assert f"Enquiry {enquiry.ref}" in detail


def test_create_opportunity_from_enquiry_needs_access(client_for, viewer, enquiry):
    assert client_for(viewer).post(f"/ai-data/from-enquiry/{enquiry.ref}/").status_code == 403
    assert not Opportunity.objects.exists()


def test_new_opportunity_form(client_for, service_lead):
    client = client_for(service_lead)
    assert client.post("/ai-data/pipeline/new/", {"source": "referral"}).status_code == 200  # title required
    response = client.post(
        "/ai-data/pipeline/new/",
        {"title": "Referral from Example Partners", "source": "referral", "owner": service_lead.pk},
    )
    opportunity = Opportunity.objects.get()
    assert response["Location"] == opportunity.get_absolute_url() and opportunity.owner == service_lead


def test_nav_shows_ai_and_data_only_to_roles_with_access(client_for, admin, viewer, seeded):
    assert 'data-nav="aidata"' in client_for(admin).get("/").content.decode()
    assert 'data-nav="aidata"' not in client_for(viewer).get("/").content.decode()


def test_unknown_reference_is_404(client_for, admin):
    assert client_for(admin).get("/ai-data/pipeline/OPP-9999/").status_code == 404
    assert client_for(admin).post("/ai-data/from-enquiry/VIT-9999/").status_code == 404


def test_dates_render_in_iso_format_for_the_native_date_picker(client_for, admin, opportunity):
    services.update_details(opportunity, {"next_action_due": date(2026, 11, 3)}, admin)
    body = client_for(admin).get(opportunity.get_absolute_url() + "?tab=details").content.decode()
    assert 'type="date" name="next_action_due" value="2026-11-03"' in body


def test_pipeline_lists_open_work_first_and_undated_last(admin):
    dated = services.create_opportunity({"title": "Dated", "next_action_due": date(2026, 11, 3)}, admin)
    undated = services.create_opportunity({"title": "Undated"}, admin)
    lost = services.create_opportunity({"title": "Lost", "next_action_due": date(2026, 1, 1)}, admin)
    services.change_stage(lost, Stage.LOST, admin, reason="No budget")
    assert list(selectors.pipeline()) == [dated, undated, lost]
