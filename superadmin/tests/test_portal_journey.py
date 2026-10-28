"""End-to-end journeys: the first-release customer journey, and the operator-to-customer scenarios (ADR-056).

invitation -> set password -> sign in -> view the submitted challenge -> review the agreed brief -> follow
milestones -> respond to a question -> review a deliverable -> request changes or approve version N -> view the
recorded decision. The admin sees every step without duplicate data entry.
"""

from django.test import Client

from apps.aidata import services as aidata_services
from apps.portal import services
from apps.portal.models import Approval, Role
from tests.portal_helpers import INTERNAL, PASSWORD, client_for, make_member, make_staff, upload


def _staff_and_org(db):
    staff = make_staff()
    org = services.create_organisation(name="Northwind Synthetic Ltd", actor=staff, synthetic=True)
    return staff, org


def test_first_release_journey(db, mailoutbox):
    staff, org = _staff_and_org(db)
    operator = client_for(staff)

    # --- Operator: link the opportunity (no re-keying), share, set up the project. ---
    opp = aidata_services.create_opportunity(
        {
            "title": "Invoice matching",
            "organisation": "Northwind",
            "problem_summary": "We re-key supplier invoices by hand.",
            "desired_outcome": "Matching without re-keying.",
            "internal_notes": INTERNAL["opp_internal"],
        },
        staff,
    )
    opportunity_page = operator.get(opp.get_absolute_url()).content.decode()
    assert 'data-testid="portal-panel"' in opportunity_page and "Link to client portal" in opportunity_page
    link_page = operator.get(f"/client-portal/link/{opp.ref}/")
    assert link_page.status_code == 200 and b"copies what the customer told us" in link_page.content
    linked = operator.post(
        f"/client-portal/link/{opp.ref}/", {"organisation": org.pk, "title": "Invoice matching"}
    )
    assert linked.status_code == 302
    challenge = opp.portal_challenge
    # No source enquiry: nothing is shown as the customer's own words; the problem travels, unretyped, as
    # Vitalos's wording in the first (draft) brief version.
    assert challenge.submitted_problem == ""
    first = challenge.briefs.get(number=1).segments
    assert first[0] == {
        "id": "s1",
        "text": "The problem: We re-key supplier invoices by hand.",
        "provenance": "agreed_fact",
    }
    assert (
        "Client portal" in operator.get(opp.get_absolute_url()).content.decode()
        and "Open portal workspace" in operator.get(opp.get_absolute_url()).content.decode()
    )
    operator.post(f"/client-portal/challenges/{challenge.pk}/share/")
    project = services.save_project(
        challenge, actor=staff, name="Matching pilot", status="active", agreed_scope="Match invoices."
    )
    operator.post(f"/client-portal/publish/project/{project.pk}/on/")
    ms = services.save_milestone(
        project, actor=staff, title="Prototype review", status="awaiting_customer", position=1
    )
    operator.post(f"/client-portal/publish/milestone/{ms.pk}/on/")
    deliverable = services.save_deliverable(project, actor=staff, title="Findings report")
    brief = challenge.briefs.get(number=1)
    operator.post(f"/client-portal/briefs/{brief.pk}/propose/")

    # --- Customer: secure access. ---
    mailoutbox.clear()
    operator.post(
        f"/client-portal/orgs/{org.pk}/invite/",
        {"email": "alma@northwind.example.test", "full_name": "Alma Approver", "role": Role.APPROVER},
    )
    invitation = mailoutbox[-1]
    assert invitation.extra_headers["Auto-Submitted"] == "auto-generated"
    token = (
        [w for w in invitation.body.split() if "/invitation/" in w][0]
        .rstrip(".")
        .rsplit("/invitation/", 1)[1]
        .strip("/")
    )
    customer = Client()
    assert customer.get(f"/portal/invitation/{token}/").status_code == 200
    password = "Journey-Synthetic-Pass-77!"
    assert (
        customer.post(
            f"/portal/invitation/{token}/", {"new_password1": password, "new_password2": password}
        ).status_code
        == 302
    )
    assert (
        customer.post(
            "/portal/sign-in/", {"email": "alma@northwind.example.test", "password": password}
        ).status_code
        == 302
    )

    # --- Customer: challenge, brief, milestones. ---
    home = customer.get("/portal/").content.decode()
    assert (
        "Invoice matching" in home and "What we need from you" in home and "Review proposed brief v1" in home
    )
    page = customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    assert (
        "We re-key supplier invoices by hand." in page and "Agreed fact" in page
    )  # no source enquiry: Vitalos's wording, provenance-tagged, never presented as "Your words"
    assert INTERNAL["opp_internal"] not in page
    review = customer.post(
        f"/portal/challenges/{challenge.pk}/briefs/{brief.pk}/review/", {"decision": "accept"}
    )
    assert review.status_code == 302
    assert "Version 1 agreed" in customer.get(f"/portal/challenges/{challenge.pk}/").content.decode()
    timeline = customer.get(f"/portal/projects/{project.pk}/").content.decode()
    assert (
        "Prototype review" in timeline
        and "Waiting for you" in timeline
        and "%" not in timeline
        and "<progress" not in timeline
    )

    # --- Operator asks; customer answers. ---
    operator.post(
        f"/client-portal/challenges/{challenge.pk}/questions/new/",
        {"question": "Which ledger do you use?", "detail": "", "due_date": ""},
    )
    question = challenge.information_requests.get()
    assert "Which ledger do you use?" in customer.get("/portal/").content.decode()
    answered = customer.post(f"/portal/questions/{question.pk}/", {"body": "Ledgerly, exported as CSV."})
    assert answered.status_code == 302
    admin_view = operator.get(f"/client-portal/challenges/{challenge.pk}/").content.decode()
    assert "Ledgerly, exported as CSV." in admin_view and "alma@northwind.example.test" in admin_view

    # --- Operator publishes deliverable v1; customer requests changes. ---
    v1 = services.create_version(deliverable, actor=staff, summary="First findings", body="Findings v1")
    draft_preview = operator.get(f"/client-portal/preview-draft/version/{v1.pk}/").content.decode()
    assert "Preview: not published" in draft_preview
    assert (
        customer.get(f"/portal/deliverables/{deliverable.pk}/").status_code == 404
    )  # not visible before sharing
    operator.post(f"/client-portal/versions/{v1.pk}/share/")
    assert "Findings v1" in customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()
    changes = customer.post(
        f"/portal/versions/{v1.pk}/changes/", {"comment": "Please explain the exceptions."}
    )
    assert changes.status_code == 302
    assert "Changes requested" in customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()

    # --- Operator publishes v2; customer approves v2; the decision shows in both places. ---
    v2 = services.create_version(
        deliverable, actor=staff, summary="Explained", body="Findings v2 explains the exceptions."
    )
    assert not Approval.objects.filter(version=v2).exists()  # starts unapproved
    operator.post(f"/client-portal/versions/{v2.pk}/share/")
    v2_page = customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()
    assert (
        "Findings v2 explains" in v2_page and "No decision has been recorded on this version yet" in v2_page
    )
    approved = customer.post(f"/portal/versions/{v2.pk}/approve/", {"comment": "Good."})
    assert approved.status_code == 302
    recorded = customer.get(f"/portal/deliverables/{deliverable.pk}/").content.decode()
    assert "Approved" in recorded and "Alma Approver" in recorded and "for version 2" in recorded
    admin_deliverable = operator.get(f"/client-portal/deliverables/{deliverable.pk}/").content.decode()
    assert (
        "alma@northwind.example.test" in admin_deliverable
        and "Approved" in admin_deliverable
        and "Changes requested" in admin_deliverable
    )
    approvals = list(Approval.objects.order_by("created_at").values_list("version__number", "decision"))
    assert approvals == [(1, "changes_requested"), (2, "approved")]
    assert "Outstanding customer decisions" in operator.get("/client-portal/").content.decode()
    assert Approval.objects.filter(version=v2).count() == 1


def test_operator_asks_customer_answers_v2_decision_and_second_organisation_is_locked_out(db, mailoutbox):
    from tests.portal_helpers import build_world

    w = build_world()
    operator = client_for(w.staff)
    approver = client_for(w.approver.user)
    outsider = client_for(w.b_approver.user)

    # 1. The operator asks a question; the customer answers it; the operator sees the answer.
    q = services.ask_question(w.ch_a, question="Do you have a staging system?", actor=w.staff)
    assert "Do you have a staging system?" in approver.get("/portal/questions/").content.decode()
    approver.post(f"/portal/questions/{q.pk}/", {"body": "Yes, one staging server."})
    assert (
        "Yes, one staging server." in operator.get(f"/client-portal/challenges/{w.ch_a.pk}/").content.decode()
    )
    assert outsider.get(f"/portal/questions/{q.pk}/").status_code == 404

    # 2. The operator publishes v2; the customer approves it; the decision shows in admin and portal.
    v2 = services.create_version(w.deliv_a, actor=w.staff, summary="v2", body="Second version body")
    services.share_version(v2, actor=w.staff)
    assert outsider.get(f"/portal/deliverables/{w.deliv_a.pk}/").status_code == 404
    approver.post(f"/portal/versions/{v2.pk}/approve/", {"comment": "Approved v2"})
    for url, who in (
        (f"/portal/deliverables/{w.deliv_a.pk}/", approver),
        (f"/client-portal/deliverables/{w.deliv_a.pk}/", operator),
    ):
        body = who.get(url).content.decode()
        assert "Approved" in body and ("Alma Approver" in body or "approver@northwind.example.test" in body)

    # 3. Another synthetic customer cannot reach the records, files or AI answers.
    assert outsider.get(f"/portal/files/versions/{w.shared_file.pk}/download/").status_code == 404
    answer = outsider.post("/portal/assistant/what_needed/", {}, HTTP_HX_REQUEST="true").content.decode()
    for needle in ("Do you have a staging system?", "Prototype report", "Northwind"):
        assert needle not in answer
    assert (
        outsider.post(
            "/portal/assistant/summarise_project/", {"project": w.project_a.pk}, HTTP_HX_REQUEST="true"
        ).status_code
        == 404
    )
    assert upload() is not None and make_member and PASSWORD
