"""The connected experience, AC-1 to AC-12 (docs/ai-data/experience/SCOPE.md), through the real service and view
layer. One guided-brief enquiry arrives through the existing intake path, is prepared with and without AI, approved
by an operator, linked to the portal, worked through with a customer and decided on, while a second synthetic
organisation is locked out of everything. Model answers come from a hand-written SimulatedProvider: this proves the
controls and the journey, not model quality. Fictional data only.
"""

import csv
import datetime as dt
import io

import pytest
from django.test import Client
from django.utils import timezone

from apps.aicore.models import AiSettings
from apps.aidata import ai, tasks, workqueue, workspace
from apps.aidata.models import Draft, DraftKind, DraftMode, DraftState, Opportunity
from apps.audit.models import AuditEvent
from apps.enquiries import ingest
from apps.enquiries.models import Enquiry
from apps.portal import continuity, notifications, selectors, services
from apps.portal.models import Approval, EmailDelivery, InformationResponse, Membership, Notification
from tests.experience_helpers import (
    MARKER,
    approved_proposal,
    file_guided_enquiry,
    guided_raw,
    scripted_provider,
    two_orgs,
)
from tests.portal_helpers import INTERNAL, client_for, pdf_bytes, upload

HX = {"HTTP_HX_REQUEST": "true"}
FIELD_NOTE = "INTERNAL-JOURNEY-NOTE-margin-and-score"
UNAPPROVED = "UNAPPROVED-JOURNEY-DRAFT-TEXT"


def first_text(enquiry) -> str:
    """The first inbound message exactly as received."""
    return enquiry.messages.filter(direction="inbound").order_by("created_at", "id").first().text_body


@pytest.fixture(autouse=True)
def _ai_reset():
    yield
    ai.set_provider_override(None)


def apply_post(draft, **over):
    values = {name: draft.payload["fields"].get(name, "") for name in workspace.BRIEF_FORM_FIELDS}
    values.update(over)
    return {
        **values,
        "target": "new",
        "offer": "ai-proof-of-value",
        "next_action": "Book a discovery call",
        "accept": list(values),
    }


def portal_pages(world):
    """Every customer-visible URL of organisation A's journey that another organisation must never reach."""
    return [
        f"/portal/challenges/{world.challenge.pk}/",
        f"/portal/projects/{world.project.pk}/",
        f"/portal/projects/{world.project.pk}/export.csv",
        f"/portal/projects/{world.project.pk}/changes/new/",
        f"/portal/milestones/{world.milestone.pk}/",
        f"/portal/deliverables/{world.deliverable.pk}/",
        f"/portal/questions/{world.question.pk}/",
        f"/portal/files/{world.file_version.file_id}/",
        f"/portal/files/versions/{world.file_version.pk}/download/",
    ]


def sign_in_invited(operator, org, email, name, role, mailoutbox):
    """The real invitation flow: staff invite, the member opens the emailed link, sets a password and signs in."""
    mailoutbox.clear()
    response = operator.post(
        f"/client-portal/orgs/{org.pk}/invite/", {"email": email, "full_name": name, "role": role}
    )
    assert response.status_code == 302
    invitation = mailoutbox[-1]
    assert invitation.extra_headers["Auto-Submitted"] == "auto-generated"
    token = (
        [w for w in invitation.body.split() if "/invitation/" in w][0]
        .rstrip(".")
        .rsplit("/invitation/", 1)[1]
        .strip("/")
    )
    customer = Client()
    password = "Journey-Synthetic-Pass-88!"
    assert customer.get(f"/portal/invitation/{token}/").status_code == 200
    assert (
        customer.post(
            f"/portal/invitation/{token}/", {"new_password1": password, "new_password2": password}
        ).status_code
        == 302
    )
    assert customer.post("/portal/sign-in/", {"email": email, "password": password}).status_code == 302
    return customer


def test_ac1_to_ac12_the_connected_experience(db, mailoutbox):
    from types import SimpleNamespace

    w = two_orgs()
    staff, org = w.staff, w.org_a
    operator = client_for(staff)

    # ---- AC-1, AC-2: a guided-brief enquiry arrives through the existing intake, once -------------------------
    message, created = file_guided_enquiry("journey-1")
    assert created
    opportunity = Opportunity.objects.get()
    enquiry = message.enquiry
    original = first_text(enquiry)
    assert MARKER in original and "You said: We match supplier statements" in original
    assert "Q: Which tools are involved?" in original and "A: Xero and a shared spreadsheet" in original
    assert opportunity.source == "website_form" and opportunity.stage == "new"
    assert "You said:" in opportunity.problem_summary  # the guided lines survive the field parse
    # The same notification delivered twice, and a re-send of the same reference, make exactly one opportunity.
    again, created_again = ingest.ingest(guided_raw("journey-1"), provider="cloudflare")
    assert not created_again and again.pk == message.pk
    resent, _ = ingest.ingest(guided_raw("journey-1-resend"), provider="cloudflare")
    assert resent.enquiry_id == enquiry.pk
    assert Opportunity.objects.count() == 1 and Enquiry.objects.count() == 1
    # Internal-only content the operator adds later (it must never reach the customer).
    operator.post(f"/ai-data/pipeline/{opportunity.ref}/note/", {"body": FIELD_NOTE})
    operator.post(
        f"/ai-data/pipeline/{opportunity.ref}/score/",
        {
            "score_problem": 5,
            "score_economic": 4,
            "score_budget": 3,
            "score_data": 3,
            "score_feasibility": 4,
            "score_reuse": 2,
        },
    )

    # ---- AC-3: a brief with AI unavailable (rules, labelled), and separately via the simulated provider --------
    AiSettings.objects.update_or_create(pk=1, defaults={"enabled": False})
    operator.post(f"/ai-data/pipeline/{opportunity.ref}/brief/enquiry/", {"key": "brief-off", "mode": "ai"})
    rules = Draft.objects.get(kind=DraftKind.BRIEF, idempotency_key="brief-off")
    assert rules.mode == DraftMode.RULES and not rules.simulated and rules.fallback_reason
    assert "kill switch" in rules.fallback_reason
    page = operator.get(f"/ai-data/pipeline/new/preview/{rules.pk}/").content.decode()
    assert "Read by rules, no AI used." in page
    Draft.objects.filter(pk=rules.pk).update(
        payload={**rules.payload, "fields": {"problem_summary": UNAPPROVED}}
    )

    AiSettings.objects.update(enabled=True)
    simulated = scripted_provider()
    operator.post(f"/ai-data/pipeline/{opportunity.ref}/brief/enquiry/", {"key": "brief-sim", "mode": "ai"})
    drafted = Draft.objects.get(idempotency_key="brief-sim")
    assert drafted.mode == DraftMode.AI and drafted.simulated and not drafted.fallback_reason
    assert len(simulated.calls) == 1
    page = operator.get(f"/ai-data/pipeline/new/preview/{drafted.pk}/").content.decode()
    assert "Suggested by AI (simulated test double)" in page
    assert first_text(enquiry) == original  # the original enquiry is untouched

    # ---- AC-4: the operator edits and approves; history is kept -----------------------------------------------------
    edited = "Statements arrive as PDFs; one person re-keys each line into Xero (confirmed on the call)."
    done = operator.post(
        f"/ai-data/pipeline/new/preview/{drafted.pk}/apply/", apply_post(drafted, current_tools=edited)
    )
    assert done.status_code == 302
    drafted.refresh_from_db()
    assert drafted.state == DraftState.APPROVED and drafted.decided_by == staff
    assert drafted.payload["fields"]["current_tools"] == edited
    assert Draft.objects.get(pk=rules.pk).state == DraftState.DRAFT  # the unapproved one stays a draft
    assert AuditEvent.objects.filter(action="aidata.brief_approved", entity_id=opportunity.ref).count() == 1
    assert drafted.ai_payload["fields"]  # what the model proposed is kept next to what was approved

    # ---- AC-5: link, invite, sign in; published information is visible and internal content is absent -------------
    link = operator.post(
        f"/client-portal/link/{opportunity.ref}/", {"organisation": org.pk, "title": "Supplier statements"}
    )
    assert link.status_code == 302
    challenge = opportunity.portal_challenge
    brief = challenge.briefs.get(number=1)
    assert brief.status == "draft"  # carried over as a draft, never auto-published
    provenance = {s["provenance"] for s in brief.segments}
    assert provenance == {"customer_statement", "ai_suggestion", "agreed_fact"}
    customer = sign_in_invited(
        operator, org, "ivy@northwind.example.test", "Ivy Approver", "approver", mailoutbox
    )
    assert customer.get(f"/portal/challenges/{challenge.pk}/").status_code == 404  # not shared yet
    operator.post(f"/client-portal/challenges/{challenge.pk}/share/")
    page = customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert "Supplier statements" in page and UNAPPROVED not in page
    assert "re-keys each line" not in page  # the brief is still a draft
    operator.post(f"/client-portal/briefs/{brief.pk}/propose/")
    page = customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    for label in ("Your words", "AI suggestion", "Agreed fact"):
        assert label in page
    # The customer's own words, unchanged; the website's machine marker and checklist suggestions are not theirs.
    assert MARKER not in page and "You said: We match supplier statements" in page
    assert edited in page
    for hidden in (FIELD_NOTE, UNAPPROVED, *INTERNAL.values(), "ai-proof-of-value", "1500", "Score"):
        assert hidden not in page, hidden
    reviewed = customer.post(
        f"/portal/challenges/{challenge.pk}/briefs/{brief.pk}/review/", {"decision": "accept"}
    )
    assert reviewed.status_code == 302 and challenge.briefs.get(number=1).status == "agreed"

    # ---- AC-6: the project has milestones and a next action -----------------------------------------------------------
    assert (
        "Create portal project from proposal"
        not in operator.get(f"{opportunity.get_absolute_url()}?tab=proposal").content.decode()
    )
    approved_proposal(opportunity, staff)
    tab = operator.get(f"{opportunity.get_absolute_url()}?tab=proposal").content.decode()
    assert 'data-testid="create-portal-project"' in tab
    created_project = operator.post(f"/client-portal/from-proposal/{opportunity.ref}/")
    project = challenge.projects.get()
    assert created_project["Location"] == f"/client-portal/projects/{project.pk}/"
    assert (
        operator.post(f"/client-portal/from-proposal/{opportunity.ref}/")["Location"]
        == created_project["Location"]
    )
    assert challenge.projects.count() == 1
    assert customer.get(f"/portal/projects/{project.pk}/").status_code == 404  # prefilled, not published
    operator.post(f"/client-portal/publish/project/{project.pk}/on/")
    project.refresh_from_db()
    for index, milestone in enumerate(project.milestones.order_by("position")):
        services.save_milestone(
            project,
            actor=staff,
            milestone=milestone,
            status="in_progress" if index == 0 else "not_started",
            target_date=timezone.localdate() + dt.timedelta(days=7 * (index + 1)),
        )
        operator.post(f"/client-portal/publish/milestone/{milestone.pk}/on/")
    first_milestone = project.milestones.order_by("position").first()
    services.save_item(
        project,
        actor=staff,
        kind="responsibility",
        party="vitalos",
        text="Vitalos: run the first statement check",
    )
    customer_page = customer.get(f"/portal/projects/{project.pk}/").content.decode()
    assert (
        first_milestone.title in customer_page
        and "%" not in customer_page
        and "<progress" not in customer_page
    )
    dashboard = customer.get("/portal/").content.decode()
    assert "Next milestone" in dashboard and first_milestone.title in dashboard
    from apps.aidata import services as aidata_services

    aidata_services.update_details(
        opportunity,
        {
            "owner": staff,
            "next_action": "Walk through the first results",
            "next_action_due": timezone.localdate(),
        },
        staff,
    )
    status = continuity.challenge_status(challenge)
    assert status["next"] == "Walk through the first results" and status["responsible"] == staff.email

    # ---- AC-7: the operator asks a question and the customer answers; both sides see it ----------------------------
    operator.post(
        f"/client-portal/challenges/{challenge.pk}/questions/new/",
        {"question": "Which suppliers send scanned statements?", "detail": "", "due_date": ""},
    )
    question = challenge.information_requests.get()
    assert "Which suppliers send scanned statements?" in customer.get("/portal/").content.decode()
    nxt = workqueue.work_queue()[3]
    assert not [i for i in nxt.items if i.title.startswith("Read the customer")]
    answered = customer.post(
        f"/portal/questions/{question.pk}/", {"body": "Two of them; the rest send text PDFs."}
    )
    assert answered.status_code == 302
    queue_rows = [i for i in workqueue.work_queue()[3].items if i.title.startswith("Read the customer")]
    assert len(queue_rows) == 1 and queue_rows[0].url == f"/client-portal/challenges/{challenge.pk}/"
    admin_page = operator.get(queue_rows[0].url).content.decode()
    assert (
        "Two of them; the rest send text PDFs." in admin_page and "ivy@northwind.example.test" in admin_page
    )
    assert not [i for i in workqueue.work_queue()[3].items if i.title.startswith("Read the customer")]
    assert "Two of them" in customer.get(f"/portal/questions/{question.pk}/").content.decode()

    # ---- AC-8, AC-9: deliverable v1 and v2; changes on v1, approval of v2; decisions are per version ---------------
    deliverable = project.deliverables.order_by("id").first()
    v1 = services.create_version(
        deliverable, actor=staff, summary="First findings", body="Findings v1: 41 of 50 matched."
    )
    assert customer.get(f"/portal/deliverables/{deliverable.pk}/").status_code == 404  # unpublished
    operator.post(f"/client-portal/versions/{v1.pk}/share/")
    assert "Findings v1" in customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()
    changes = customer.post(
        f"/portal/versions/{v1.pk}/changes/", {"comment": "Please explain the exceptions."}
    )
    assert changes.status_code == 302
    decide = [i for i in workqueue.work_queue()[0].items if i.title.startswith("Changes requested on")]
    assert len(decide) == 1 and f"{deliverable.title} v1" in decide[0].title  # AC-10, admin work queue
    v2 = services.create_version(
        deliverable, actor=staff, summary="Explained", body="Findings v2 explains the exceptions."
    )
    assert not Approval.objects.filter(version=v2).exists()
    operator.post(f"/client-portal/versions/{v2.pk}/share/")
    refused = customer.post(f"/portal/versions/{v1.pk}/approve/", {})  # approving the old version is refused
    assert refused.status_code == 302
    assert not Approval.objects.filter(version=v1, decision="approved").exists()
    approved = customer.post(f"/portal/versions/{v2.pk}/approve/", {"comment": "Good."})
    assert approved.status_code == 302
    assert list(Approval.objects.order_by("created_at").values_list("version__number", "decision")) == [
        (1, "changes_requested"),
        (2, "approved"),
    ]
    # And the other way round: approving a version never approves a later one.
    second = project.deliverables.order_by("id")[1]
    b1 = services.create_version(second, actor=staff, summary="b1", body="Second deliverable v1")
    services.share_version(b1, actor=staff)
    customer.post(f"/portal/versions/{b1.pk}/approve/", {})
    b2 = services.create_version(second, actor=staff, summary="b2", body="Second deliverable v2")
    services.share_version(b2, actor=staff)
    assert selectors.version_state(b1) == "approved" and selectors.version_state(b2) == "pending"
    assert not Approval.objects.filter(version=b2).exists()

    # ---- AC-10: the decisions show in the admin (queue and deliverable page) and in the portal ------------------------
    approved_rows = [i for i in workqueue.work_queue()[3].items if i.title.endswith("approved")]
    assert any(f"{deliverable.title} v2 approved" == i.title for i in approved_rows)
    assert not [i for i in workqueue.work_queue()[0].items if f"{deliverable.title} v1" in i.title]
    admin_deliverable = operator.get(f"/client-portal/deliverables/{deliverable.pk}/").content.decode()
    for needle in (
        "ivy@northwind.example.test",
        "Approved",
        "Changes requested",
        "Please explain the exceptions.",
    ):
        assert needle in admin_deliverable
    portal_deliverable = customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()
    assert (
        "Approved" in portal_deliverable
        and "Ivy Approver" in portal_deliverable
        and "for version 2" in portal_deliverable
    )
    overview = operator.get("/ai-data/").content.decode()
    assert 'data-testid="queue-source"' in overview and f"{deliverable.title} v2 approved" in overview

    # ---- AC-11: a second synthetic organisation gets 404 on every record, file, AI answer, search, notification, export
    staff_file = services.upload_staff_file(
        challenge,
        upload("findings.pdf", pdf_bytes()),
        actor=staff,
        title="Findings (PDF)",
        visibility="customer",
        project=project,
    )
    world = SimpleNamespace(
        challenge=challenge,
        project=project,
        milestone=first_milestone,
        deliverable=deliverable,
        question=question,
        file_version=staff_file,
    )
    outsider = client_for(w.b_approver.user)
    insider_csv = customer.get(f"/portal/projects/{project.pk}/export.csv")
    assert insider_csv.status_code == 200
    rows = list(csv.reader(io.StringIO(insider_csv.content.decode())))
    assert any(deliverable.title in row[1] for row in rows) and FIELD_NOTE not in insider_csv.content.decode()
    private = [
        challenge.title,
        project.name,
        deliverable.title,
        "Findings v1",
        "Findings v2",
        "re-keys",
        "Which suppliers",
        "Two of them",
    ]
    for path in portal_pages(world):
        response = outsider.get(path)
        assert response.status_code == 404, path
        body = response.content.decode(errors="ignore")
        assert not any(p in body for p in private), path
    assert outsider.post(f"/portal/versions/{v2.pk}/approve/", {}).status_code == 404
    assert outsider.post(f"/portal/questions/{question.pk}/", {"body": "intruder"}).status_code == 404
    for activity, data in (
        ("summarise_project", {"project": project.pk}),
        ("explain_deliverable", {"deliverable": deliverable.pk}),
        ("clarify_challenge", {"challenge": challenge.pk}),
        ("unanswered", {"challenge": challenge.pk}),
    ):
        assert outsider.post(f"/portal/assistant/{activity}/", data, **HX).status_code == 404, activity
    for activity in ("what_changed", "what_needed", "unanswered"):
        answer = outsider.post(f"/portal/assistant/{activity}/", {}, **HX).content.decode()
        assert not any(p in answer for p in private)
    for term in ("statements", "Findings", "Northwind", deliverable.title.split()[0], "Xero"):
        body = (
            outsider.get("/portal/search/", {"q": term})
            .content.decode()
            .replace(f'value="{term}"', "")
            .replace(f'No results for "{term}"', "")
        )
        assert not any(p in body for p in private), term
    mine = Notification.objects.filter(
        user=Membership.objects.get(user__email="ivy@northwind.example.test").user
    ).first()
    assert mine is not None and outsider.get(f"/portal/notifications/{mine.pk}/open/").status_code == 404
    for path in (
        "/portal/",
        "/portal/activity/",
        "/portal/challenges/",
        "/portal/questions/",
        "/portal/files/",
        "/portal/notifications/",
    ):
        body = outsider.get(path).content.decode()
        assert not any(p in body for p in private), path
    assert not Notification.objects.filter(user=w.b_approver.user, organisation=org).exists()
    for sent in mailoutbox:
        if "contoso" in sent.to[0]:
            assert not any(p in sent.body for p in private)
    assert not InformationResponse.objects.filter(body="intruder").exists()


# ---- AC-12: failures are visible and recoverable, and the original enquiry survives --------------------------------


def test_ac12_a_failed_ai_task_keeps_the_enquiry_and_retry_or_manual_entry_works(db):
    w = two_orgs()
    staff = w.staff
    operator = client_for(staff)
    message, _ = file_guided_enquiry("fail-1")
    opportunity = Opportunity.objects.get()
    original = first_text(message.enquiry)
    before = Opportunity.objects.values().get()

    ai.set_provider_override(None)
    from apps.aicore.core.providers import SimulatedProvider

    ai.set_provider_override(SimulatedProvider([{"fault": "timeout"}]))
    AiSettings.objects.update_or_create(pk=1, defaults={"enabled": True})
    operator.post(f"/ai-data/pipeline/{opportunity.ref}/brief/enquiry/", {"key": "f1", "mode": "ai"})
    draft = Draft.objects.get(idempotency_key="f1")
    assert draft.state == DraftState.FAILED and draft.error_category == "timeout"
    assert first_text(message.enquiry) == original  # the original enquiry is intact
    assert {k: v for k, v in Opportunity.objects.values().get().items() if k != "updated_at"} == {
        k: v for k, v in before.items() if k != "updated_at"
    }
    # Visible to operators: on the opportunity, and in the work queue (blocked), with a way forward.
    page = operator.get(opportunity.get_absolute_url()).content.decode()
    assert 'data-testid="task-failed"' in page and "Prepare without AI" in page
    blocked = [i for i in workqueue.work_queue()[2].items if "failed" in i.title]
    assert (
        blocked and "timeout" in blocked[0].evidence and blocked[0].action == "Retry or continue without AI"
    )
    # Retry once the provider is back: same row, no duplicate, even on a double click.
    scripted_provider()
    operator.post(f"/ai-data/drafts/{draft.pk}/retry/")
    operator.post(f"/ai-data/drafts/{draft.pk}/retry/")
    draft.refresh_from_db()
    assert Draft.objects.filter(kind=DraftKind.BRIEF).count() == 1 and draft.state == DraftState.DRAFT
    assert draft.mode == DraftMode.AI
    # Manual entry always works: the operator can write the brief field by hand, with no AI at all.
    ai.set_provider_override(None)
    AiSettings.objects.update(enabled=False)
    operator.post(
        f"/ai-data/pipeline/{opportunity.ref}/field/desired_outcome/",
        {"value": "Written by hand: flag every unmatched line."},
    )
    opportunity.refresh_from_db()
    assert opportunity.desired_outcome == "Written by hand: flag every unmatched line."


def test_ac12_a_stale_ai_task_is_visible_and_recovered(db):
    w = two_orgs()
    staff = w.staff
    message, _ = file_guided_enquiry("stale-1")
    opportunity = Opportunity.objects.get()
    original = first_text(message.enquiry)
    draft, _ = tasks.submit(
        DraftKind.BRIEF, key="stale", actor=staff, opportunity=opportunity, source_text=original, run=False
    )
    assert tasks.claim(draft.pk) is not None  # a worker took it, then died
    Draft.objects.filter(pk=draft.pk).update(lease_expires_at=timezone.now() - dt.timedelta(minutes=3))
    stuck = [i for i in workqueue.work_queue()[2].items if "looks stuck" in i.title]
    assert stuck and "the original text is kept" in stuck[0].evidence
    assert tasks.tick()["recovered"] == 1
    draft.refresh_from_db()
    assert draft.state in (DraftState.DRAFT, DraftState.QUEUED) and draft.attempts == 2
    assert first_text(message.enquiry) == original
    assert not [i for i in workqueue.work_queue()[2].items if "looks stuck" in i.title]


def test_ac12_a_failed_portal_email_is_visible_and_the_bounded_retry_succeeds_without_a_duplicate(
    db, mailoutbox, monkeypatch
):
    w = two_orgs()
    staff = w.staff
    operator = client_for(staff)
    message, _ = file_guided_enquiry("mail-1")
    opportunity = Opportunity.objects.get()
    challenge = services.link_challenge(opportunity=opportunity, organisation=w.org_a, actor=staff)
    services.share_challenge(challenge, actor=staff)
    mailoutbox.clear()

    from apps.mailer import system

    original_send = system.send

    def down(*args, **kwargs):
        raise RuntimeError("mail provider is down")

    monkeypatch.setattr(system, "send", down)
    question = services.ask_question(challenge, question="Who checks exceptions?", actor=staff)
    delivery = EmailDelivery.objects.get()
    assert delivery.status == "failed" and delivery.attempts == 1 and delivery.last_error == "RuntimeError"
    assert question.published_at is not None  # the action itself was saved
    assert not mailoutbox
    # Visible to operators in three places: the portal home banner, the deliveries list, and the work queue.
    assert "1 portal email failed to send" in operator.get("/client-portal/").content.decode()
    listing = operator.get("/client-portal/deliveries/?status=failed").content.decode()
    assert "Retry now" in listing and "RuntimeError" in listing and delivery.to_email in listing
    rows = [i for i in workqueue.work_queue()[2].items if i.title.startswith("Portal email failed")]
    assert len(rows) == 1 and rows[0].url == "/client-portal/deliveries/?status=failed"
    assert AuditEvent.objects.filter(action="portal.email_failed").exists()
    # Bounded retry: nothing is due yet; once due and the provider is back, it sends exactly once.
    assert notifications.send_pending()["attempted"] == 0
    monkeypatch.setattr(system, "send", original_send)
    EmailDelivery.objects.update(next_attempt_at=timezone.now() - dt.timedelta(minutes=1))
    assert notifications.send_pending() == {"attempted": 1, "sent": 1, "failed": 0}
    delivery.refresh_from_db()
    assert delivery.status == "sent" and delivery.attempts == 2 and delivery.sent_at
    assert len(mailoutbox) == 1 and mailoutbox[0].extra_headers["Auto-Submitted"] == "auto-generated"
    # Neither another sweep nor a manual retry (the staff button) can send it a second time.
    assert notifications.send_pending()["attempted"] == 0
    operator.post(f"/client-portal/deliveries/{delivery.pk}/retry/")
    assert len(mailoutbox) == 1
    assert not [i for i in workqueue.work_queue()[2].items if i.title.startswith("Portal email failed")]


def test_ac12_retries_stop_at_the_cap(db, mailoutbox, monkeypatch):
    w = two_orgs()
    message, _ = file_guided_enquiry("cap-1")
    challenge = services.link_challenge(
        opportunity=Opportunity.objects.get(), organisation=w.org_a, actor=w.staff
    )
    services.share_challenge(challenge, actor=w.staff)
    from apps.mailer import system

    monkeypatch.setattr(system, "send", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("down")))
    services.ask_question(challenge, question="Cap test?", actor=w.staff)
    for _ in range(EmailDelivery.MAX_ATTEMPTS + 2):
        EmailDelivery.objects.update(next_attempt_at=timezone.now() - dt.timedelta(minutes=1))
        notifications.send_pending()
    delivery = EmailDelivery.objects.get()
    assert delivery.status == "failed" and delivery.attempts == EmailDelivery.MAX_ATTEMPTS
    assert not mailoutbox and message is not None
    assert Enquiry.objects.count() == 1
