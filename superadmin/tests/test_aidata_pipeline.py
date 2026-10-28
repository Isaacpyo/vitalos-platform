"""AI & Data pipeline write rules: creation, stage transitions, scorecard, notes and audit. Fictional data."""

from datetime import date
from decimal import Decimal

import pytest
from django.core.exceptions import PermissionDenied, ValidationError

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN
from apps.aidata import services
from apps.aidata.models import Draft, DraftKind, DraftState, OfferPrice, Opportunity, Stage, StageChange
from apps.audit.models import AuditEvent


@pytest.fixture
def admin(make_user):
    return make_user(SUPERADMIN, email="owner@example.test")


@pytest.fixture
def service_lead(make_user):
    return make_user(SERVICE_LEAD, email="lead-ai@example.test")


def make(actor, **extra):
    data = {"title": "Statement reconciliation for Example Ledger Ltd", "organisation": "Example Ledger Ltd"}
    return services.create_opportunity({**data, **extra}, actor)


def approve_discovery(opportunity, actor):
    """A proposal needs approved discovery (ADR-055): give the opportunity one, as a person would."""
    Draft.objects.get_or_create(
        opportunity=opportunity,
        kind=DraftKind.DISCOVERY,
        version=1,
        defaults={"state": DraftState.APPROVED, "decided_by": actor, "payload": {"workflow_steps": []}},
    )


def move(opportunity, *stages, actor, **kwargs):
    for stage in stages:
        if stage == Stage.PROPOSAL:
            approve_discovery(opportunity, actor)
        services.change_stage(opportunity, stage, actor, **kwargs)
    return opportunity


def test_create_allocates_opp_references_in_order(admin):
    first, second = make(admin), make(admin)
    assert (first.ref, second.ref) == ("OPP-0001", "OPP-0002")
    assert first.stage == Stage.NEW and first.created_by == admin
    assert StageChange.objects.filter(opportunity=first, to_stage=Stage.NEW).exists()
    assert AuditEvent.objects.filter(action="aidata.opportunity_created", entity_id="OPP-0001").exists()


def test_create_needs_pipeline_access(viewer, norole):
    for user in (viewer, norole):
        with pytest.raises(PermissionDenied):
            make(user)


def test_offer_price_is_the_default_estimated_value(admin):
    opportunity = make(admin, offer="ai-opportunity-assessment")
    assert opportunity.estimated_value == Decimal("350.00")
    explicit = make(admin, offer="ai-proof-of-value", estimated_value=Decimal("2200"))
    assert explicit.estimated_value == Decimal("2200")
    services.update_details(explicit, {"estimated_value": None, "offer": "production-ai-engineering"}, admin)
    explicit.refresh_from_db()
    assert explicit.estimated_value == Decimal("3000.00")


def test_update_details_audits_field_names_not_values(admin):
    opportunity = make(admin)
    changed = services.update_details(opportunity, {"contact_email": "pat@example-ledger.example"}, admin)
    assert changed == ["contact_email"]
    event = AuditEvent.objects.get(action="aidata.opportunity_updated")
    assert event.metadata["fields"] == ["contact_email"]
    assert "pat@example-ledger.example" not in str(event.metadata) + event.summary
    assert services.update_details(opportunity, {"contact_email": "pat@example-ledger.example"}, admin) == []


@pytest.mark.parametrize(
    ("path", "allowed"),
    [
        ((Stage.REVIEWING,), True),
        ((Stage.DISCOVERY, Stage.QUALIFIED, Stage.PROPOSAL), True),
        ((Stage.QUALIFIED,), False),  # New cannot skip to Qualified
        ((Stage.PROPOSAL,), False),
        ((Stage.WON,), False),  # Won only from Assessment / Proposal
    ],
)
def test_transition_map(admin, path, allowed):
    opportunity = make(admin)
    if allowed:
        move(opportunity, *path, actor=admin)
        assert opportunity.stage == path[-1]
    else:
        with pytest.raises(ValidationError):
            move(opportunity, *path, actor=admin, reason="r", signed_scope_reference="SCOPE-1")
        opportunity.refresh_from_db()
        assert opportunity.stage == Stage.NEW


def test_invalid_and_same_stage_are_refused(admin):
    opportunity = make(admin)
    with pytest.raises(ValidationError):
        services.change_stage(opportunity, "bogus", admin)
    with pytest.raises(ValidationError):
        services.change_stage(opportunity, Stage.NEW, admin)


@pytest.mark.parametrize("stage", [Stage.LOST, Stage.ON_HOLD])
def test_lost_and_on_hold_need_a_reason(admin, stage):
    opportunity = make(admin)
    with pytest.raises(ValidationError) as error:
        services.change_stage(opportunity, stage, admin, reason="  ")
    assert "reason" in error.value.message_dict
    services.change_stage(opportunity, stage, admin, reason="No budget this year")
    opportunity.refresh_from_db()
    assert opportunity.stage == stage and opportunity.outcome_reason == "No budget this year"
    assert opportunity.closed_at is not None


def test_won_needs_a_reason_and_a_typed_signed_scope_reference(admin):
    opportunity = move(make(admin), Stage.DISCOVERY, Stage.QUALIFIED, Stage.PROPOSAL, actor=admin)
    with pytest.raises(ValidationError) as error:
        services.change_stage(opportunity, Stage.WON, admin, reason="Signed")
    assert "signed_scope_reference" in error.value.message_dict
    with pytest.raises(ValidationError):
        services.change_stage(opportunity, Stage.WON, admin, signed_scope_reference="SOW-2026-001")
    assert opportunity.signed_scope_reference == ""  # never filled in automatically
    services.change_stage(
        opportunity, Stage.WON, admin, reason="Signed", signed_scope_reference="SOW-2026-001"
    )
    opportunity.refresh_from_db()
    assert opportunity.stage == Stage.WON and opportunity.signed_scope_reference == "SOW-2026-001"
    assert opportunity.closed_at is not None


def test_won_and_lost_are_terminal_except_superadmin_reopen(admin, service_lead):
    opportunity = make(admin)
    services.change_stage(opportunity, Stage.LOST, admin, reason="Chose a competitor")
    for stage in (Stage.NEW, Stage.DISCOVERY, Stage.PROPOSAL):
        with pytest.raises(ValidationError):
            services.change_stage(opportunity, stage, admin, reason="x")
    with pytest.raises(PermissionDenied):
        services.change_stage(opportunity, Stage.REVIEWING, service_lead, reason="They came back")
    assert services.allowed_stages(opportunity, service_lead) == []
    with pytest.raises(ValidationError):
        services.change_stage(opportunity, Stage.REVIEWING, admin)  # reopening needs a reason
    services.change_stage(opportunity, Stage.REVIEWING, admin, reason="They came back")
    opportunity.refresh_from_db()
    assert opportunity.stage == Stage.REVIEWING and opportunity.closed_at is None
    event = AuditEvent.objects.filter(action="aidata.stage_changed").first()
    assert event.metadata == {"previous": "lost", "stage": "reviewing", "reopened": True}


def test_on_hold_returns_to_active_stages(admin, service_lead):
    opportunity = make(admin)
    services.change_stage(opportunity, Stage.ON_HOLD, service_lead, reason="Waiting for year end")
    services.change_stage(opportunity, Stage.DISCOVERY, service_lead)
    opportunity.refresh_from_db()
    assert opportunity.stage == Stage.DISCOVERY and opportunity.closed_at is None
    assert opportunity.discovery_date is not None


def test_each_stage_change_records_who_when_from_to_and_an_audit_event(admin):
    opportunity = make(admin)
    services.change_stage(opportunity, Stage.REVIEWING, admin)
    change = opportunity.stage_changes.first()
    assert (change.from_stage, change.to_stage, change.actor) == (Stage.NEW, Stage.REVIEWING, admin)
    event = AuditEvent.objects.filter(action="aidata.stage_changed", entity_id=opportunity.ref).get()
    assert event.actor == admin and event.metadata["previous"] == "new"


def test_scorecard_is_stored_and_audited(admin):
    opportunity = make(admin)
    services.update_scorecard(
        opportunity,
        {"score_problem": 4, "score_economic": 4, "score_budget": 4, "score_data": 4, "score_feasibility": 4,
         "score_reuse": 4},
        risk_override=False,
        risk_reason="ignored",
        actor=admin,
    )  # fmt: skip
    opportunity.refresh_from_db()
    assert opportunity.score == Decimal("80.0") and opportunity.scorecard.label == "Proposal candidate"
    assert opportunity.risk_reason == ""
    event = AuditEvent.objects.get(action="aidata.scorecard_updated")
    assert event.metadata["score"] == "80.0" and event.metadata["band"] == "proposal_candidate"


def test_risk_override_needs_a_reason(admin):
    opportunity = make(admin)
    with pytest.raises(ValidationError):
        services.update_scorecard(opportunity, {}, risk_override=True, risk_reason="", actor=admin)
    services.update_scorecard(opportunity, {}, risk_override=True, risk_reason="Health data", actor=admin)
    opportunity.refresh_from_db()
    assert opportunity.scorecard.label == "Blocked by risk" and opportunity.score is None


def test_scores_out_of_range_are_refused(admin):
    with pytest.raises(ValidationError):
        services.update_scorecard(
            make(admin), {"score_problem": 6}, risk_override=False, risk_reason="", actor=admin
        )


def test_notes_are_internal_and_audited_without_their_text(admin):
    opportunity = make(admin)
    with pytest.raises(ValidationError):
        services.add_note(opportunity, "   ", admin)
    services.add_note(opportunity, "Owner sounded keen; check their ledger export", admin)
    assert opportunity.notes.get().author == admin
    event = AuditEvent.objects.get(action="aidata.noted")
    assert "ledger" not in event.summary


def test_next_working_day_skips_weekends():
    assert services.next_working_day(date(2026, 10, 26)) == date(2026, 10, 27)  # Mon -> Tue
    assert services.next_working_day(date(2026, 10, 30)) == date(2026, 11, 2)  # Fri -> Mon
    assert services.next_working_day(date(2026, 10, 31)) == date(2026, 11, 2)  # Sat -> Mon
    assert services.next_working_day(date(2026, 11, 1)) == date(2026, 11, 2)  # Sun -> Mon


def test_offer_prices_are_superadmin_only_and_audited(admin, service_lead):
    price = OfferPrice.objects.get(key="ai-proof-of-value")
    with pytest.raises(PermissionDenied):
        services.update_offer_price(price, {"price": Decimal("1")}, service_lead)
    services.update_offer_price(price, {"price": Decimal("1750"), "status": "validated"}, admin)
    price.refresh_from_db()
    assert price.price == Decimal("1750") and price.updated_by == admin
    event = AuditEvent.objects.get(action="aidata.offer_price_changed")
    assert event.metadata["previous"]["price"] == "1500.00" and event.metadata["price"] == "1750"


def test_score_is_kept_in_step_with_the_criteria_on_save(admin):
    opportunity = make(admin)
    Opportunity.objects.filter(pk=opportunity.pk).update(score=Decimal("99.9"))
    opportunity.refresh_from_db()
    opportunity.title = "Renamed"
    opportunity.save(update_fields=["title"])
    opportunity.refresh_from_db()
    assert opportunity.score is None
