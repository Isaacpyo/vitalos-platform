"""Synthetic fixtures for the client portal tests. Two clearly fake organisations; every internal-only field
carries a marker string so tests can assert it never reaches a customer."""

from __future__ import annotations

import io
import zipfile
from types import SimpleNamespace

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.accounts.models import User
from apps.accounts.roles import SUPERADMIN
from apps.accounts.services import set_role
from apps.aidata import services as aidata_services
from apps.portal import services
from apps.portal.models import Role

PASSWORD = "Synthetic-Passw0rd-4711!"

# Strings that must NEVER appear in anything a customer receives.
INTERNAL = {
    "opp_notes": "INTERNAL-OPP-NOTE-margin-31pc",
    "opp_internal": "INTERNAL-OPP-INTERNAL-NOTES-qualification",
    "challenge": "INTERNAL-CHALLENGE-NOTE-9a1",
    "brief": "INTERNAL-BRIEF-NOTE-77c",
    "project": "INTERNAL-PROJECT-NOTE-b22",
    "milestone": "INTERNAL-MILESTONE-NOTE-c33",
    "item": "INTERNAL-ITEM-NOTE-d44",
    "deliverable": "INTERNAL-DELIVERABLE-NOTE-e55",
    "version": "INTERNAL-VERSION-NOTE-f66",
    "update": "INTERNAL-UPDATE-NOTE-a77",
    "question": "INTERNAL-QUESTION-NOTE-b88",
    "change": "INTERNAL-CHANGE-NOTE-c99",
    "service": "INTERNAL-SERVICE-NOTE-d00",
    "org": "INTERNAL-ORG-NOTE-e11",
    "thread": "INTERNAL-PRIVATE-DISCUSSION-f22",
    "draft_update": "UNPUBLISHED-DRAFT-UPDATE-BODY-g33",
    "draft_brief": "UNPROPOSED-AI-DRAFT-BRIEF-h44",
    "file": "INTERNAL-FILE-TITLE-i55",
}


def pdf_bytes(extra: bytes = b"") -> bytes:
    return b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\n" + extra + b"\n%%EOF\n"


def docx_bytes(macro: bool = False) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types/>")
        archive.writestr("word/document.xml", "<w:document/>")
        if macro:
            archive.writestr("word/vbaProject.bin", b"x")
    return buffer.getvalue()


def upload(name="notes.pdf", data=None, content_type="application/pdf"):
    return SimpleUploadedFile(name, data if data is not None else pdf_bytes(), content_type=content_type)


def make_staff(email="staff@example.test"):
    user = User.objects.create_user(email=email, password=PASSWORD)
    set_role(user, SUPERADMIN, actor=None)
    return user


def make_member(org, email, role, name="", synthetic_password=PASSWORD):
    """An accepted member with a real password (the invitation flow is tested separately)."""
    member = services.invite_member(
        organisation=org, email=email, full_name=name, role=role, actor=None, send=False
    )
    from apps.portal.models import Invitation

    member.user.set_password(synthetic_password)
    member.user.save()
    Invitation.objects.filter(membership=member).update(used_at=member.created_at)
    member.accepted_at = member.created_at
    member.save(update_fields=["accepted_at"])
    return member


def client_for(user) -> Client:
    """A signed-in client. Staff get a verified second factor (SuperAdmin requires one); customers do not."""
    from apps.accounts.roles import has_any_role
    from tests.conftest import login

    client = Client()
    if has_any_role(user):
        return login(client, user)
    client.force_login(user)
    return client


def build_world(staff=None) -> SimpleNamespace:
    """Northwind Synthetic Ltd (org A) with a full journey; Contoso Synthetic plc (org B) with its own records."""
    staff = staff or make_staff()
    w = SimpleNamespace(staff=staff)
    w.org_a = services.create_organisation(name="Northwind Synthetic Ltd", actor=staff, synthetic=True)
    w.org_b = services.create_organisation(name="Contoso Synthetic plc", actor=staff, synthetic=True)
    w.org_a.internal_notes = INTERNAL["org"]
    w.org_a.save()
    w.viewer = make_member(w.org_a, "viewer@northwind.example.test", Role.VIEWER, "Vera Viewer")
    w.contrib = make_member(w.org_a, "contrib@northwind.example.test", Role.CONTRIBUTOR, "Colin Contributor")
    w.approver = make_member(w.org_a, "approver@northwind.example.test", Role.APPROVER, "Alma Approver")
    w.signatory = make_member(w.org_a, "signatory@northwind.example.test", Role.SIGNATORY, "Sam Signatory")
    w.b_approver = make_member(w.org_b, "approver@contoso.example.test", Role.APPROVER, "Bea Contoso")

    def opportunity(title, problem, outcome):
        opp = aidata_services.create_opportunity(
            {
                "title": title,
                "organisation": "Synthetic",
                "problem_summary": problem,
                "desired_outcome": outcome,
                "internal_notes": INTERNAL["opp_internal"],
            },
            staff,
        )
        aidata_services.add_note(opp, INTERNAL["opp_notes"], staff)
        return opp

    w.opp_a = opportunity(
        "Invoice matching for Northwind",
        "We re-key supplier invoices by hand every week.",
        "Matching without re-keying.",
    )
    w.opp_b = opportunity("Contoso support triage", "Support mail is triaged by hand.", "Faster triage.")
    w.ch_a = services.link_challenge(
        opportunity=w.opp_a, organisation=w.org_a, actor=staff, title="Invoice matching"
    )
    w.ch_b = services.link_challenge(
        opportunity=w.opp_b, organisation=w.org_b, actor=staff, title="Support triage"
    )
    for ch in (w.ch_a, w.ch_b):
        services.update_challenge(
            ch, actor=staff, internal_notes=INTERNAL["challenge"], status_note="Assessment under way"
        )
        services.share_challenge(ch, actor=staff)

    # Brief: v1 draft became proposed; a later AI-tagged draft stays internal.
    w.brief_a = w.ch_a.briefs.get(number=1)
    w.brief_a.internal_notes = INTERNAL["brief"]
    w.brief_a.save()
    services.propose_brief(w.brief_a, actor=staff)
    w.draft_brief = services.save_brief(
        w.ch_a,
        segments=[{"id": "s1", "text": INTERNAL["draft_brief"], "provenance": "ai_suggestion"}],
        summary="Draft",
        actor=staff,
    )

    # Project, milestones, items, deliverable
    w.project_a = services.save_project(
        w.ch_a,
        actor=staff,
        name="Invoice matching pilot",
        summary="Pilot matching.",
        agreed_scope="Match invoices to ledger.",
        status="active",
        target_date=None,
        internal_notes=INTERNAL["project"],
    )
    services.set_published(w.project_a, True, actor=staff)
    w.ms1 = services.save_milestone(
        w.project_a,
        actor=staff,
        title="Data received",
        status="complete",
        position=1,
        internal_notes=INTERNAL["milestone"],
    )
    w.ms2 = services.save_milestone(
        w.project_a, actor=staff, title="Prototype review", status="awaiting_customer", position=2
    )
    w.ms_hidden = services.save_milestone(
        w.project_a, actor=staff, title="Hidden internal milestone", status="not_started", position=3
    )
    for m in (w.ms1, w.ms2):
        services.set_published(m, True, actor=staff)
    w.item = services.save_item(
        w.project_a,
        actor=staff,
        kind="dependency",
        party="customer",
        text="Provide a sample ledger export",
        internal_notes=INTERNAL["item"],
    )
    services.set_published(w.item, True, actor=staff)
    w.deliv_a = services.save_deliverable(
        w.project_a,
        actor=staff,
        title="Prototype report",
        description="Findings so far",
        internal_notes=INTERNAL["deliverable"],
    )
    w.v1 = services.create_version(
        w.deliv_a,
        actor=staff,
        summary="First draft",
        body="Version one body",
        internal_notes=INTERNAL["version"],
    )
    services.share_version(w.v1, actor=staff)

    # Org B project with its own deliverable (for isolation checks)
    w.project_b = services.save_project(w.ch_b, actor=staff, name="Triage pilot", status="active")
    services.set_published(w.project_b, True, actor=staff)
    w.deliv_b = services.save_deliverable(w.project_b, actor=staff, title="Triage report")
    w.vb1 = services.create_version(w.deliv_b, actor=staff, summary="B v1", body="Contoso only body")
    services.share_version(w.vb1, actor=staff)

    # Question, published update, draft update
    w.q_a = services.ask_question(w.ch_a, question="Which ledger system do you use?", actor=staff)
    w.q_a.internal_notes = INTERNAL["question"]
    w.q_a.save()
    w.q_b = services.ask_question(w.ch_b, question="Contoso-only question?", actor=staff)
    w.upd_a = services.save_update(
        w.ch_a,
        title="Week one",
        body="We received the sample data.",
        internal_notes=INTERNAL["update"],
        actor=staff,
    )
    services.publish_update(w.upd_a, actor=staff)
    w.draft_update = services.save_update(
        w.ch_a, title="Draft not ready", body=INTERNAL["draft_update"], actor=staff
    )
    # Private discussion and internal file
    services.post_staff_message(w.ch_a, body=INTERNAL["thread"], actor=staff, internal=True)
    w.internal_file = services.upload_staff_file(
        w.ch_a, upload("secret.pdf"), actor=staff, title=INTERNAL["file"]
    )
    w.shared_file = services.upload_staff_file(
        w.ch_a, upload("shared.pdf"), actor=staff, title="Shared report", visibility="customer"
    )
    w.b_file = services.upload_staff_file(
        w.ch_b, upload("b.pdf"), actor=staff, title="Contoso file", visibility="customer"
    )
    # Managed service (manual)
    w.svc_a = services.save_service(
        w.org_a, name="Invoice matcher", actor=staff, internal_notes=INTERNAL["service"]
    )
    services.set_published(w.svc_a, True, actor=staff)
    services.report_status(w.svc_a, status="operational", summary="Running normally", actor=staff)
    return w
