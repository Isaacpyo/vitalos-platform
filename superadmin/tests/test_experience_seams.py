"""The seams between the admin workspace and the portal (W9): brief continuity, proposal to project, the
work queue, stage visibility and the status staff see. Synthetic data only."""

import datetime as dt
import json

import pytest
from django.test import Client
from django.utils import timezone

from apps.aidata import ai, workqueue, workspace
from apps.aidata import services as aidata_services
from apps.aidata.models import Draft, DraftKind, DraftMode, DraftState, Opportunity
from apps.audit.models import AuditEvent
from apps.portal import continuity, services
from apps.portal.models import (
    BriefStatus,
    DeliverableVersion,
    EmailDelivery,
    InformationResponse,
    Journey,
    Milestone,
    Project,
)
from tests.experience_helpers import (
    approved_brief,
    approved_proposal,
    file_guided_enquiry,
    scripted_provider,
    two_orgs,
)
from tests.portal_helpers import client_for, make_staff

SECRET = {
    "notes": "INTERNAL-NOTE-margin-31pc",
    "internal": "INTERNAL-OPP-NOTES-qualification",
    "unapproved": "UNAPPROVED-W7-DRAFT-TEXT",
    "price": "1500",
}


@pytest.fixture(autouse=True)
def _ai_reset():
    yield
    ai.set_provider_override(None)


def opportunity_from_enquiry(staff):
    message, created = file_guided_enquiry()
    assert created
    opportunity = Opportunity.objects.get(enquiry=message.enquiry)
    aidata_services.add_note(opportunity, SECRET["notes"], staff)
    aidata_services.update_details(opportunity, {"internal_notes": SECRET["internal"]}, staff)
    aidata_services.update_scorecard(
        opportunity,
        {"score_problem": 5, "score_economic": 4},
        risk_override=False,
        risk_reason="",
        actor=staff,
    )
    return opportunity


def all_text(challenge) -> str:
    """Every customer-facing text field of the challenge and its first-level records, as one string."""
    parts = [challenge.title, challenge.submitted_problem, challenge.submitted_outcome, challenge.status_note]
    for brief in challenge.briefs.all():
        parts += [brief.summary, brief.change_note, json.dumps(brief.segments)]
    return "\n".join(parts)


# --- 1. Opportunity -> challenge continuity ------------------------------------------------------------------


def test_linking_carries_the_original_enquiry_and_the_approved_brief_as_a_draft(db):
    w = two_orgs()
    opportunity = opportunity_from_enquiry(w.staff)
    scripted_provider()
    # An earlier, never-approved brief must not travel.
    stray, _ = workspace.prepare_brief_from_enquiry(
        opportunity, key="stray", actor=w.staff, mode=DraftMode.RULES
    )
    Draft.objects.filter(pk=stray.pk).update(
        payload={"fields": {"problem_summary": SECRET["unapproved"]}}, state=DraftState.DRAFT
    )
    approved = approved_brief(
        opportunity,
        w.staff,
        key="approved",
        edit={"current_tools": "Xero and one person re-keying PDFs (edited by staff)."},
    )
    # Unapproved workspace records of every other kind exist too.
    pack, _ = workspace.start_discovery(
        opportunity, notes=SECRET["unapproved"], key="stray-d", actor=w.staff, mode=DraftMode.RULES
    )
    assert approved.state == DraftState.APPROVED and pack.state == DraftState.DRAFT

    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=w.staff)

    brief = challenge.briefs.get(number=1)
    assert brief.status == BriefStatus.DRAFT and brief.proposed_at is None  # never auto-published
    statements = [s for s in brief.segments if s["provenance"] == "customer_statement"]
    original = opportunity.enquiry.messages.filter(direction="inbound").first().text_body
    assert "[vitalos-brief v1" in original and "You said:" in original
    # Only what the visitor wrote, unchanged: their description and answers. Not the marker, not the
    # checklist's suggestions, not the website's contact rows, sector or budget.
    said = "".join(s["text"] for s in statements)
    assert said == continuity.original_statement(opportunity)
    assert "You said: We match supplier statements" in said and "A: Xero and a shared spreadsheet" in said
    for absent in (
        "[vitalos-brief",
        "Read the statements",
        "suggested from our checklist",
        "Work email",
        "Source page",
        "Indicative budget",
        "Sector:",
        "Re-keys each line",
    ):
        assert absent.lower() not in said.lower()
    assert all(
        s["provenance"] in {"customer_statement", "ai_suggestion", "agreed_fact"} for s in brief.segments
    )
    by_text = {s["text"]: s["provenance"] for s in brief.segments}
    # Wording the model proposed and staff approved unchanged is still labelled as an AI suggestion; staff-written
    # or edited wording is an agreed fact.
    assert (
        by_text[
            "The problem: Supplier statements are matched to the purchase ledger by hand, taking two days a month."
        ]
        == "ai_suggestion"
    )
    assert (
        by_text["How it works today: Xero and one person re-keying PDFs (edited by staff)."] == "agreed_fact"
    )
    # Nothing internal, and no unapproved draft.
    text = all_text(challenge)
    for marker in SECRET.values():
        assert marker not in text or marker == "1500"
    assert "margin" not in text and "qualification" not in text.replace("Qualification", "")
    assert "price" not in json.dumps(brief.segments).lower()
    # The customer cannot see a draft, even once the challenge is shared.
    services.share_challenge(challenge, actor=w.staff)
    customer = client_for(w.approver.user)
    page = customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert "Matched" not in page and SECRET["unapproved"] not in page and SECRET["notes"] not in page
    assert "Supplier statements are matched" not in page  # still a draft: nothing proposed yet
    services.propose_brief(brief, actor=w.staff)
    page = customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert "Supplier statements are matched to the purchase ledger" in page and "AI suggestion" in page
    assert SECRET["unapproved"] not in page and SECRET["notes"] not in page and SECRET["internal"] not in page


def test_without_an_approved_brief_linking_behaves_as_before(db):
    w = two_orgs()
    opportunity = opportunity_from_enquiry(w.staff)
    workspace.prepare_brief_from_enquiry(opportunity, key="only-draft", actor=w.staff, mode=DraftMode.RULES)
    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=w.staff)
    segments = challenge.briefs.get(number=1).segments
    assert [s["provenance"] for s in segments] == ["customer_statement"] * len(segments)
    assert segments[0]["text"] == challenge.submitted_problem
    assert challenge.briefs.get(number=1).summary == "Starting point: what you told us"


def test_a_pasted_text_opportunity_never_presents_the_paste_as_the_customers_words(db):
    """Staff may paste their own call notes, so a paste is never shown to the customer as "your words"."""
    w = two_orgs()
    staff = w.staff
    text = (
        "Call notes: they re-key invoices by hand. INTERNAL: budget looks tight.\nContact: pat@example.test"
    )
    draft, _ = workspace.prepare_brief(
        source_text=text, source_label="Pasted", key="p1", actor=staff, mode=DraftMode.RULES
    )
    opportunity = workspace.apply_brief(draft, draft.payload["fields"], staff, title="Pat's firm")
    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=staff)
    segments = challenge.briefs.get(number=1).segments
    # Only the approved fields travel, as Vitalos's own wording ("agreed fact"); the paste itself never does.
    assert segments and {s["provenance"] for s in segments} <= {"agreed_fact", "ai_suggestion"}
    statements = [s for s in segments if s["provenance"] == "customer_statement"]
    assert not statements and "budget looks tight" not in json.dumps(segments)
    assert challenge.submitted_problem == "" and challenge.submitted_outcome == ""


def test_customer_words_by_format():
    classic = (
        "Vitalos AI & Data enquiry\nSector: Retail\nBusiness problem or workflow:\nWe re-key orders.\n"
        "Current tools and process:\nShopify and a spreadsheet\nDesired outcome:\nNot given\n"
        "Indicative budget: £1,000–£5,000 (enquirer's estimate)"
    )
    assert continuity.customer_words(classic) == {
        "problem": "We re-key orders.",
        "tools": "Shopify and a spreadsheet",
        "outcome": "",
    }
    plain = "Hello, we would like help with our invoices."
    assert continuity.customer_words(plain)["problem"] == plain
    guided = (
        "Vitalos AI & Data enquiry\nBusiness problem or workflow:\n[vitalos-brief v1 questions=ai brief=ai]\n"
        "You said: Orders are re-keyed.\nFollow-up answers (you said):\nQ: How many?\nA: About 200 a week\n"
        "Possible automation (suggested by AI):\n- Read the orders\nUnknowns (edited by you):\n- Peak volumes\n"
        "Suggested next step (suggested from our checklist): A short call\n"
        "Current tools and process:\nAI-drafted card text\nDesired outcome:\nAI-drafted outcome"
    )
    words = continuity.customer_words(guided)
    assert words["problem"] == (
        "You said: Orders are re-keyed.\nFollow-up answers (you said):\nQ: How many?\nA: About 200 a week\n"
        "Unknowns (edited by you):\n- Peak volumes"
    )
    assert words["tools"] == "" and words["outcome"] == ""


def test_a_long_original_is_split_without_changing_a_character(db):
    long_text = ("Line of the customer's own words.\n" * 120) + "x" * 2600
    pieces = continuity._chunks(long_text)
    assert "".join(pieces) == long_text and all(len(p) <= continuity.SEGMENT_LIMIT for p in pieces)


# --- 2. Proposal -> project ----------------------------------------------------------------------------------


def linked_with_proposal():
    w = two_orgs()
    opportunity = opportunity_from_enquiry(w.staff)
    scripted_provider()
    approved_brief(opportunity, w.staff)
    proposal = approved_proposal(opportunity, w.staff)
    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=w.staff)
    return w, opportunity, proposal, challenge


def test_a_project_is_prefilled_from_the_approved_proposal_and_nothing_is_published(db):
    w, opportunity, proposal, challenge = linked_with_proposal()
    project, created = continuity.create_project_from_proposal(challenge, actor=w.staff)
    assert created and project.published_at is None and project.source_proposal_id == proposal.pk
    data = proposal.payload
    assert project.name == data["title"] and project.summary == data["summary"]
    assert all(line in project.agreed_scope for line in data["scope"])
    assert set(project.deliverables.values_list("title", flat=True)) == set(data["deliverables"])
    assert not DeliverableVersion.objects.filter(deliverable__project=project).exists()
    assert [m.title for m in project.milestones.order_by("position")] == [
        m["name"] for m in data["milestones"]
    ]
    kinds = set(project.items.values_list("kind", flat=True))
    assert kinds == {"responsibility", "dependency"}
    assert any(i.party == "customer" and i.kind == "dependency" for i in project.items.all())
    # Unpublished everywhere.
    assert not project.milestones.filter(published_at__isnull=False).exists()
    assert not project.deliverables.filter(published_at__isnull=False).exists()
    assert not project.items.filter(published_at__isnull=False).exists()
    # Prices never copy into customer-visible fields.
    visible = " ".join(
        [project.name, project.summary, project.agreed_scope]
        + [m.title + m.description for m in project.milestones.all()]
        + [d.title + d.description for d in project.deliverables.all()]
        + [i.text for i in project.items.all()]
    )
    assert data["price"]["amount"] and "1500" not in visible and "£" not in visible
    assert AuditEvent.objects.filter(action="portal.project_from_proposal").count() == 1


def test_the_action_is_idempotent_and_the_second_click_opens_the_existing_project(db):
    w, opportunity, proposal, challenge = linked_with_proposal()
    client = client_for(w.staff)
    url = f"/client-portal/from-proposal/{opportunity.ref}/"
    first = client.post(url)
    second = client.post(url)
    assert first.status_code == second.status_code == 302 and first["Location"] == second["Location"]
    assert Project.objects.filter(challenge=challenge).count() == 1
    assert Milestone.objects.count() == len(proposal.payload["milestones"])
    assert AuditEvent.objects.filter(action="portal.project_from_proposal").count() == 1
    page = client.get(second["Location"], follow=True).content.decode()
    assert "already has a project made from the proposal" in page
    # The proposal tab offers the project instead of the button.
    tab = client.get(f"{opportunity.get_absolute_url()}?tab=proposal").content.decode()
    assert 'data-testid="open-portal-project"' in tab and 'data-testid="create-portal-project"' not in tab


def test_the_button_appears_only_for_an_approved_proposal_and_a_linked_challenge(db):
    w = two_orgs()
    opportunity = opportunity_from_enquiry(w.staff)
    scripted_provider()
    approved_brief(opportunity, w.staff)
    client = client_for(w.staff)
    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=w.staff)
    with pytest.raises(continuity.ContinuityError):
        continuity.create_project_from_proposal(challenge, actor=w.staff)
    refused = client.post(f"/client-portal/from-proposal/{opportunity.ref}/", follow=True)
    assert "Approve a proposal draft first" in refused.content.decode()
    assert not Project.objects.exists()
    approved_proposal(opportunity, w.staff)
    tab = client.get(f"{opportunity.get_absolute_url()}?tab=proposal").content.decode()
    assert 'data-testid="create-portal-project"' in tab and "Create portal project from proposal" in tab


def test_only_staff_can_create_the_project(db):
    w, opportunity, _proposal, _challenge = linked_with_proposal()
    customer = client_for(w.approver.user)
    assert customer.post(f"/client-portal/from-proposal/{opportunity.ref}/").status_code in (302, 403, 404)
    assert not Project.objects.exists()
    assert Client().post(f"/client-portal/from-proposal/{opportunity.ref}/").status_code in (302, 403)
    assert not Project.objects.exists()


# --- 3. The work queue ----------------------------------------------------------------------------------------


def portal_items(groups):
    return {group.key: [i for i in group.items if i.source == "Client portal"] for group in groups}


def shared_project(w, challenge):
    services.share_challenge(challenge, actor=w.staff)
    project, _ = continuity.create_project_from_proposal(challenge, actor=w.staff)
    services.set_published(project, True, actor=w.staff)
    return project


def test_the_work_queue_carries_real_portal_items_with_links(db, mailoutbox):
    w, opportunity, _proposal, challenge = linked_with_proposal()
    project = shared_project(w, challenge)
    today = timezone.localdate()
    assert all(
        not rows for rows in portal_items(workqueue.work_queue()).values()
    )  # nothing yet: empty is honest

    # Customer answer received, not yet read.
    question = services.ask_question(
        challenge, question="Which ledger do you use?", due_date=today - dt.timedelta(days=2), actor=w.staff
    )
    # Overdue and waiting: the unanswered question; and an overdue customer dependency.
    item = services.save_item(
        project,
        actor=w.staff,
        kind="dependency",
        party="customer",
        text="Send the ledger export",
        due_date=today - dt.timedelta(days=1),
    )
    services.set_published(item, True, actor=w.staff)
    blocked = portal_items(workqueue.work_queue())["blocked"]
    assert {i.title for i in blocked} >= {
        "Waiting on the customer: Which ledger do you use?",
        "Waiting on the customer: Send the ledger export",
    }
    assert all(i.overdue for i in blocked if i.title.startswith("Waiting on the customer"))
    services.answer_question(w.approver, question, body="Ledgerly, exported as CSV.")
    nxt = portal_items(workqueue.work_queue())["next"]
    read = [i for i in nxt if i.title.startswith("Read the customer's answer")]
    assert len(read) == 1 and read[0].url == f"/client-portal/challenges/{challenge.pk}/"
    # Opening the staff workspace marks the answer read, and the item leaves the queue.
    staff_client = client_for(w.staff)
    assert staff_client.get(read[0].url).status_code == 200
    assert InformationResponse.objects.get().staff_seen_at is not None
    assert not [i for i in portal_items(workqueue.work_queue())["next"] if i.title.startswith("Read the")]
    assert not [i for i in portal_items(workqueue.work_queue())["blocked"] if "Which ledger" in i.title]

    # Change request awaiting review.
    change = services.request_change(
        w.approver, project, title="Add a second supplier", description="Please.", affects="scope"
    )
    decide = portal_items(workqueue.work_queue())["decide"]
    assert [i.url for i in decide if i.title.startswith("Review change request")] == [
        f"/client-portal/changes/{change.pk}/"
    ]

    # Deliverable decisions: changes requested (decide), then approved (next).
    deliverable = project.deliverables.first()
    services.set_published(deliverable, True, actor=w.staff)
    v1 = services.create_version(deliverable, actor=w.staff, summary="First", body="v1")
    services.share_version(v1, actor=w.staff)
    services.request_version_changes(w.approver, v1, comment="Explain the exceptions.")
    decide = portal_items(workqueue.work_queue())["decide"]
    changes = [i for i in decide if i.title.startswith("Changes requested on")]
    assert len(changes) == 1 and changes[0].url == f"/client-portal/deliverables/{deliverable.pk}/"
    assert "Alma Approver" in changes[0].evidence
    v2 = services.create_version(deliverable, actor=w.staff, summary="Second", body="v2")
    services.share_version(v2, actor=w.staff)
    assert not [
        i
        for i in portal_items(workqueue.work_queue())["decide"]
        if i.title.startswith("Changes requested on")
    ]
    services.approve_version(w.approver, v2)
    approved = [i for i in portal_items(workqueue.work_queue())["next"] if i.title.endswith("approved")]
    assert len(approved) == 1 and "version" not in approved[0].title and "v2" in approved[0].title

    # The overview renders every group, with the portal chip, and keeps the four questions.
    page = staff_client.get("/ai-data/").content.decode()
    assert page.count('data-testid="queue-source"') >= 3
    for question_text in (
        "What needs my decision?",
        "What has AI prepared?",
        "What is blocked?",
        "What should happen next?",
    ):
        assert question_text in page


def test_a_failed_portal_email_and_a_stuck_ai_task_are_in_the_queue(db, monkeypatch):
    w, opportunity, _proposal, challenge = linked_with_proposal()
    shared_project(w, challenge)

    def boom(*args, **kwargs):
        raise RuntimeError("mail provider down")

    monkeypatch.setattr("apps.mailer.system.send", boom)
    services.ask_question(challenge, question="Who reviews exceptions?", actor=w.staff)
    failed = EmailDelivery.objects.get(status="failed")
    blocked = workqueue.work_queue()[2]
    email_rows = [i for i in blocked.items if i.title.startswith("Portal email failed")]
    assert (
        email_rows and email_rows[0].url == "/client-portal/deliveries/?status=failed" and failed.last_error
    )

    # A task whose lease expired, and one nobody picked up.
    now = timezone.now()
    running = Draft.objects.create(
        opportunity=opportunity,
        kind=DraftKind.QUESTIONS,
        version=9,
        state=DraftState.RUNNING,
        attempts=1,
        lease_expires_at=now - dt.timedelta(minutes=5),
        idempotency_key="stale-running",
    )
    queued = Draft.objects.create(
        opportunity=opportunity,
        kind=DraftKind.DISCOVERY,
        version=9,
        state=DraftState.QUEUED,
        idempotency_key="stale-queued",
    )
    Draft.objects.filter(pk=queued.pk).update(updated_at=now - dt.timedelta(hours=1))
    titles = [i.title for i in workqueue.work_queue()[2].items]
    assert any("Discovery pack v9 looks stuck" in t for t in titles)
    assert any("Discovery questions v9 looks stuck" in t for t in titles)
    del running


# --- 4. Stage visibility ----------------------------------------------------------------------------------------


def test_the_customer_visible_stage_never_changes_silently(db):
    w, opportunity, _proposal, challenge = linked_with_proposal()
    services.share_challenge(challenge, actor=w.staff)
    client = client_for(w.staff)
    assert challenge.journey_stage == Journey.SUBMITTED and continuity.stage_difference(challenge) is None
    # Moving the opportunity through its stages changes nothing the customer sees.
    for stage in ("reviewing", "discovery", "qualified", "proposal"):
        aidata_services.change_stage(opportunity, stage, w.staff)
    challenge.refresh_from_db()
    assert challenge.journey_stage == Journey.SUBMITTED
    diff = continuity.stage_difference(challenge)
    assert (diff.opportunity_stage, diff.customer_stage, diff.suggested) == (
        "Assessment / Proposal",
        "Submitted",
        "proposal",
    )
    panel = client.get(opportunity.get_absolute_url()).content.decode()
    assert "Opportunity is at Assessment / Proposal; customer sees Submitted." in panel
    assert 'data-testid="stage-sync"' in panel
    page = client_for(w.approver.user).get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert "Submitted" in page
    events_before = challenge.events.count()

    response = client.post(f"/client-portal/challenges/{challenge.pk}/stage/")
    assert response.status_code == 302
    challenge.refresh_from_db()
    assert challenge.journey_stage == Journey.PROPOSAL
    assert challenge.events.count() == events_before + 1  # the customer's activity feed says so
    audit = AuditEvent.objects.get(action="portal.stage_synced")
    assert "Submitted -> Proposal" in audit.summary and audit.actor_email == w.staff.email
    assert continuity.stage_difference(challenge) is None
    after = client.get(opportunity.get_absolute_url()).content.decode()
    assert 'data-testid="stage-in-sync"' in after and 'data-testid="stage-sync"' not in after
    # A second press is refused (nothing to update).
    again = client.post(f"/client-portal/challenges/{challenge.pk}/stage/", follow=True)
    assert "already matches" in again.content.decode()


@pytest.mark.parametrize(
    ("stage", "journey"),
    [
        ("new", "submitted"),
        ("reviewing", "submitted"),
        ("discovery", "discovery"),
        ("qualified", "assessment"),
        ("proposal", "proposal"),
        ("won", "active"),
    ],
)
def test_the_stage_map(stage, journey):
    assert continuity.STAGE_MAP[stage].value == journey


def test_after_a_win_handover_and_managed_agree_with_won_and_hold_has_no_mapping(db):
    w, opportunity, _p, challenge = linked_with_proposal()
    Opportunity.objects.filter(pk=opportunity.pk).update(stage="won")
    challenge.opportunity.refresh_from_db()
    for stage in (Journey.ACTIVE, Journey.HANDOVER, Journey.MANAGED):
        challenge.journey_stage = stage
        assert continuity.stage_difference(challenge) is None
    challenge.journey_stage = Journey.DISCOVERY
    assert continuity.stage_difference(challenge).suggested == "active"
    Opportunity.objects.filter(pk=opportunity.pk).update(stage="on_hold")
    challenge.opportunity.refresh_from_db()
    assert continuity.stage_difference(challenge) is None


def test_staff_see_status_responsible_next_blocked_and_what_the_customer_needs(db):
    w, opportunity, _p, challenge = linked_with_proposal()
    project = shared_project(w, challenge)
    aidata_services.update_details(
        opportunity,
        {"owner": w.staff, "next_action": "Review the pilot data", "next_action_due": timezone.localdate()},
        w.staff,
    )
    services.ask_question(challenge, question="Which ledger?", actor=w.staff)
    blocker = services.save_item(
        project, actor=w.staff, kind="blocker", party="customer", text="No access to the folder"
    )
    services.set_published(blocker, True, actor=w.staff)
    status = continuity.challenge_status(challenge)
    assert status["responsible"] == w.staff.email and status["next"] == "Review the pilot data"
    assert "Answer: Which ledger?" in status["customer_todo"]
    assert any("No access to the folder" in line for line in status["blocked"])
    staff_client = client_for(w.staff)
    page = staff_client.get(f"/client-portal/challenges/{challenge.pk}/").content.decode()
    for needle in (
        "Responsible",
        "What happens next",
        "Blocked",
        "The customer needs to",
        "Which ledger?",
        w.staff.email,
    ):
        assert needle in page
    strip = staff_client.get(opportunity.get_absolute_url()).content.decode()
    assert 'data-testid="strip-customer"' in strip and "Answer: Which ledger?" in strip


def test_an_unlinked_opportunity_says_nothing_is_tracked(db):
    staff = make_staff()
    opportunity = aidata_services.create_opportunity({"title": "Plain opportunity"}, staff)
    page = client_for(staff).get(opportunity.get_absolute_url()).content.decode()
    assert "Not linked to the client portal" in page and "Nothing is waiting on them" not in page
