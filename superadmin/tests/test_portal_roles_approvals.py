"""Role permissions, version-specific approvals, contractual acceptance and change requests."""

import pytest
from django.db import IntegrityError

from apps.audit.models import AuditEvent
from apps.portal import selectors, services
from apps.portal.models import (
    Approval,
    BriefStatus,
    ChangeRequest,
    ChangeReview,
    InformationRequest,
    Message,
    Notification,
)
from tests.portal_helpers import build_world, client_for


@pytest.fixture
def world(db):
    return build_world()


def c(member):
    return client_for(member.user)


# --- roles --------------------------------------------------------------------------------------------------


def test_viewer_is_read_only_everywhere(world):
    client = c(world.viewer)
    assert client.get(f"/portal/deliverables/{world.deliv_a.pk}/").status_code == 200
    body = client.get(f"/portal/deliverables/{world.deliv_a.pk}/").content
    assert b"Approving needs an approver" in body and b'data-dialog-open="approve-dialog"' not in body
    assert client.post(f"/portal/versions/{world.v1.pk}/approve/").status_code == 403
    assert (
        client.post(f"/portal/questions/{world.q_a.pk}/", {"body": "hi"}).status_code == 200
    )  # form refuses, no write
    assert not InformationRequest.objects.filter(pk=world.q_a.pk, status="answered").exists()
    assert client.post(f"/portal/challenges/{world.ch_a.pk}/discuss/", {"body": "hi"}).status_code == 403
    assert client.post("/portal/files/upload/", {"challenge": world.ch_a.pk}).status_code == 403
    assert client.get(f"/portal/projects/{world.project_a.pk}/changes/new/").status_code == 200
    post = client.post(
        f"/portal/projects/{world.project_a.pk}/changes/new/",
        {"title": "t", "affects": "scope", "description": "d"},
    )
    assert post.status_code == 200 and not ChangeRequest.objects.exists()
    with pytest.raises(services.PortalError):
        services.answer_question(world.viewer, world.q_a, body="x")


def test_contributor_can_comment_and_answer_but_not_approve(world):
    client = c(world.contrib)
    assert (
        client.post(f"/portal/challenges/{world.ch_a.pk}/discuss/", {"body": "A clarification"}).status_code
        == 302
    )
    assert Message.objects.filter(body="A clarification", author=world.contrib.user).exists()
    assert client.post(f"/portal/questions/{world.q_a.pk}/", {"body": "We use Ledgerly."}).status_code == 302
    world.q_a.refresh_from_db()
    assert world.q_a.status == "answered" and world.q_a.responses.count() == 1
    assert client.post(f"/portal/versions/{world.v1.pk}/approve/").status_code == 403
    assert client.post(f"/portal/versions/{world.v1.pk}/changes/", {"comment": "x"}).status_code == 403
    with pytest.raises(services.PortalError):
        services.review_brief(world.contrib, world.brief_a, accept=True, comment="")
    services.review_brief(world.contrib, world.brief_a, accept=False, comment="Please add the weekly check.")
    world.brief_a.refresh_from_db()
    assert world.brief_a.status == BriefStatus.CHANGES_REQUESTED


def test_approver_approves_or_requests_changes_but_cannot_accept_contractually(world):
    client = c(world.approver)
    assert client.post(f"/portal/versions/{world.v1.pk}/accept/", {"confirm": "on"}).status_code == 403
    with pytest.raises(services.PortalError, match="authorised signatory"):
        services.accept_contract(world.approver, world.v1, confirmed=True)
    response = client.post(f"/portal/versions/{world.v1.pk}/approve/", {"comment": "Fine."})
    assert response.status_code == 302
    approval = Approval.objects.get(version=world.v1)
    assert approval.decision == "approved" and approval.kind == "review"
    assert approval.user == world.approver.user and approval.user_email == world.approver.user.email
    assert approval.role == "approver" and approval.created_at is not None


def test_signatory_acceptance_is_distinct_explicit_and_needs_a_contractual_version(world):
    with pytest.raises(services.PortalError, match="not a contractual"):
        services.accept_contract(world.signatory, world.v1, confirmed=True)
    contract = services.create_version(
        services.save_deliverable(world.project_a, actor=world.staff, title="Master terms"),
        actor=world.staff,
        summary="Terms v1",
        body="Synthetic terms.",
        is_contractual=True,
    )
    services.share_version(contract, actor=world.staff)
    client = c(world.signatory)
    page = client.get(f"/portal/deliverables/{contract.deliverable_id}/").content.decode()
    assert (
        "contractual acceptance" in page.lower()
        and "authorised to accept this on behalf of Northwind Synthetic Ltd" in page
    )
    unticked = client.post(f"/portal/versions/{contract.pk}/accept/", {})
    assert unticked.status_code == 302 and not Approval.objects.filter(kind="contractual").exists()
    ok = client.post(f"/portal/versions/{contract.pk}/accept/", {"confirm": "on"})
    assert ok.status_code == 302
    acceptance = Approval.objects.get(version=contract, kind="contractual")
    assert acceptance.decision == "accepted" and "version 1" in acceptance.statement
    assert (
        "contractual acceptance" in acceptance.statement
        and "separate from a review approval" in acceptance.statement
    )
    # The review state is untouched: accepting a contract is not approving the review.
    assert selectors.version_state(contract) == "pending"
    with pytest.raises(services.PortalError, match="already recorded"):
        services.accept_contract(world.signatory, contract, confirmed=True)
    assert AuditEvent.objects.filter(action="portal.contract_accepted").exists()


def test_review_approval_never_counts_as_contractual_acceptance(world):
    contract = services.create_version(
        services.save_deliverable(world.project_a, actor=world.staff, title="Terms"),
        actor=world.staff,
        body="t",
        is_contractual=True,
    )
    services.share_version(contract, actor=world.staff)
    services.approve_version(world.signatory, contract)
    assert selectors.version_state(contract) == "approved"
    assert not selectors.contract_accepted(contract)


# --- version-specific approvals ---------------------------------------------------------------------------------


def test_approving_v1_does_not_approve_v2_and_v1_cannot_be_decided_after_v2(world):
    services.approve_version(world.approver, world.v1, comment="v1 fine")
    v2 = services.create_version(world.deliv_a, actor=world.staff, summary="Second", body="v2 body")
    assert selectors.version_state(v2) == "pending"  # unshared, and never inherits anything
    assert not Approval.objects.filter(version=v2).exists()
    services.share_version(v2, actor=world.staff)
    assert selectors.version_state(v2) == "pending"
    assert selectors.version_state(world.v1) == "approved"  # v1's own record stands
    client = c(world.approver)
    page = client.get(f"/portal/deliverables/{world.deliv_a.pk}/").content.decode()
    assert "Decision on version 2" in page and "No decision has been recorded on this version yet" in page
    # v1 shows its own decision when selected.
    v1_page = client.get(f"/portal/deliverables/{world.deliv_a.pk}/?v=1").content.decode()
    assert "Approved" in v1_page and "for version 1" in v1_page
    assert (
        client.get(f"/portal/deliverables/{world.deliv_a.pk}/").content.count(
            b'data-dialog-open="approve-dialog"'
        )
        >= 1
    )
    services.approve_version(world.approver, v2, comment="v2 fine")
    assert Approval.objects.filter(decision="approved").count() == 2
    assert {a.version_id for a in Approval.objects.all()} == {world.v1.pk, v2.pk}


def test_stale_version_decisions_are_refused(world):
    v2 = services.create_version(world.deliv_a, actor=world.staff, summary="Second", body="b")
    services.share_version(v2, actor=world.staff)
    with pytest.raises(services.PortalError, match="newer version"):
        services.approve_version(world.approver, world.v1)
    with pytest.raises(services.PortalError, match="newer version"):
        services.request_version_changes(world.approver, world.v1, comment="x")
    assert c(world.approver).post(f"/portal/versions/{world.v1.pk}/approve/").status_code == 302
    assert not Approval.objects.exists()


def test_request_changes_then_v2_then_approve_flow(world):
    services.request_version_changes(world.approver, world.v1, comment="Please explain the exceptions.")
    assert selectors.version_state(world.v1) == "changes_requested"
    v2 = services.create_version(world.deliv_a, actor=world.staff, summary="Explained", body="Now explained.")
    services.share_version(v2, actor=world.staff)
    assert selectors.version_state(world.v1) == "superseded"
    services.approve_version(world.approver, v2)
    assert selectors.version_state(v2) == "approved"
    assert Approval.objects.filter(version=world.v1, decision="changes_requested").count() == 1


def test_double_approval_is_refused_by_service_and_database(world):
    services.approve_version(world.approver, world.v1)
    with pytest.raises(services.PortalError, match="already been approved"):
        services.approve_version(world.signatory, world.v1)
    with pytest.raises(IntegrityError):
        Approval.objects.create(
            version=world.v1,
            decision="approved",
            user=world.approver.user,
            user_email="x@example.test",
            role="approver",
        )


def test_withdrawn_or_unshared_version_cannot_be_approved(world):
    hidden = services.create_version(world.deliv_a, actor=world.staff, summary="Not shared", body="b")
    with pytest.raises(Exception):  # noqa: B017 - selectors 404 or service refusal
        services.approve_version(world.approver, hidden)
    assert c(world.approver).post(f"/portal/versions/{hidden.pk}/approve/").status_code == 404
    services.withdraw_version(world.v1, actor=world.staff)
    assert c(world.approver).post(f"/portal/versions/{world.v1.pk}/approve/").status_code == 404


def test_share_requires_published_project(world):
    from apps.portal.models import Project

    unpublished = services.save_project(
        world.ch_a, actor=world.staff, name="Draft project", status="planning"
    )
    deliverable = services.save_deliverable(unpublished, actor=world.staff, title="Early doc")
    version = services.create_version(deliverable, actor=world.staff, body="b")
    with pytest.raises(services.PortalError, match="Publish the project"):
        services.share_version(version, actor=world.staff)
    assert Project.objects.filter(pk=unpublished.pk, published_at__isnull=True).exists()


def test_decision_is_visible_in_portal_and_admin(world):
    services.approve_version(world.approver, world.v1, comment="Looks right.")
    portal = c(world.viewer).get(f"/portal/deliverables/{world.deliv_a.pk}/").content.decode()
    assert "Alma Approver" in portal and "Approved" in portal and "version 1" in portal
    admin = client_for(world.staff).get(f"/client-portal/deliverables/{world.deliv_a.pk}/").content.decode()
    assert world.approver.user.email in admin and "Approved" in admin and "Looks right." in admin
    assert Notification.objects.filter(kind="decision").exists()


# --- change requests ---------------------------------------------------------------------------------------------


def test_change_request_is_only_a_request_with_a_review_trail(world):
    before = (world.project_a.agreed_scope, world.project_a.target_date, world.project_a.status)
    client = c(world.contrib)
    response = client.post(
        f"/portal/projects/{world.project_a.pk}/changes/new/",
        {"title": "Add a third supplier", "affects": "scope", "description": "Please add supplier C."},
    )
    assert response.status_code == 302
    change = ChangeRequest.objects.get()
    assert change.status == "submitted" and change.raised_by == world.contrib.user
    world.project_a.refresh_from_db()
    assert (world.project_a.agreed_scope, world.project_a.target_date, world.project_a.status) == before
    staff = client_for(world.staff)
    assert b"Add a third supplier" in staff.get("/client-portal/").content  # outstanding in the admin
    services.review_change(
        change, to_status="under_review", response="", note="Internal: effort check", actor=world.staff
    )
    services.review_change(
        change,
        to_status="accepted",
        response="Accepted; we will confirm the revised plan.",
        note="",
        actor=world.staff,
    )
    world.project_a.refresh_from_db()
    assert world.project_a.agreed_scope == before[0]  # accepting records a decision; it does not edit scope
    trail = list(ChangeReview.objects.filter(change=change).values_list("to_status", "actor_email"))
    assert [t[0] for t in trail] == ["submitted", "under_review", "accepted"]
    assert trail[2][1] == world.staff.email
    page = c(world.contrib).get(f"/portal/changes/{change.pk}/").content.decode()
    assert "Accepted" in page and "we will confirm the revised plan" in page
    assert "Internal: effort check" not in page and world.staff.email not in page
    with pytest.raises(services.PortalError):
        services.review_change(change, to_status="declined", response="late", note="", actor=world.staff)


def test_decline_needs_a_customer_visible_response(world):
    change = services.request_change(
        world.contrib, world.project_a, title="t", description="d", affects="dates"
    )
    with pytest.raises(services.PortalError, match="response the customer will see"):
        services.review_change(change, to_status="declined", response="", note="", actor=world.staff)


def test_role_matrix_summary(world):
    members = {
        "viewer": world.viewer,
        "contributor": world.contrib,
        "approver": world.approver,
        "signatory": world.signatory,
    }
    caps = {name: (m.can_comment, m.can_approve, m.can_accept_contract) for name, m in members.items()}
    assert caps == {
        "viewer": (False, False, False),
        "contributor": (True, False, False),
        "approver": (True, True, False),
        "signatory": (True, True, True),
    }
