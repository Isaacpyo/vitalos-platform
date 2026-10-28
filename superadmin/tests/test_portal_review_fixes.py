"""Regression tests for the independent security review of apps.aidata (ADR-055) and apps.portal (ADR-056).

One section per finding (M1..M3, L1..L6); each test failed before its fix."""

import pytest

from apps.portal import selectors, services
from apps.portal.models import Approval, DeliverableVersion
from tests.portal_helpers import build_world, client_for


@pytest.fixture
def world(db):
    return build_world()


def c(member):
    return client_for(member.user)


def _second_version(world, **kwargs):
    v2 = services.create_version(world.deliv_a, actor=world.staff, summary="Second", body="v2", **kwargs)
    services.share_version(v2, actor=world.staff)
    return v2


# --- M1: no decision on a superseded version, whatever its state -----------------------------------------------


def test_m1_cannot_accept_contract_on_superseded_version(world):
    contract = services.create_version(
        world.deliv_a, actor=world.staff, summary="Contract", body="c1", is_contractual=True
    )
    services.share_version(contract, actor=world.staff)
    services.approve_version(world.approver, contract)  # approved, then superseded
    v2 = _second_version(world, is_contractual=True)
    with pytest.raises(services.PortalError, match="newer version"):
        services.accept_contract(world.signatory, contract, confirmed=True)
    response = c(world.signatory).post(f"/portal/versions/{contract.pk}/accept/", {"confirm": "on"})
    assert response.status_code == 302
    assert not Approval.objects.filter(version=contract, decision="accepted").exists()
    services.accept_contract(world.signatory, v2, confirmed=True)  # the latest still works


def test_m1_cannot_approve_or_request_changes_on_superseded_approved_version(world):
    services.approve_version(world.approver, world.v1)
    _second_version(world)
    with pytest.raises(services.PortalError, match="newer version"):
        services.request_version_changes(world.approver, world.v1, comment="late")
    assert not Approval.objects.filter(version=world.v1, decision="changes_requested").exists()


def test_m1_withdrawn_newer_version_does_not_block(world):
    services.approve_version(world.approver, world.v1)
    v2 = _second_version(world)
    services.withdraw_version(v2, actor=world.staff)
    with pytest.raises(services.PortalError, match="already approved"):
        services.request_version_changes(world.approver, world.v1, comment="x")
    assert DeliverableVersion.objects.filter(pk=world.v1.pk).exists()
    assert selectors.has_newer_version(world.v1) is False


# --- L3: decisions are serialised and re-checked inside the transaction -------------------------------------------


def _interleave(monkeypatch, name, action):
    """Run ``action`` just before the service takes its lock: the state a concurrent request could create."""
    real = getattr(services, name)

    def wrapper(*args, **kwargs):
        action()
        return real(*args, **kwargs)

    monkeypatch.setattr(services, name, wrapper)


def test_l3_approve_rechecks_newer_version_after_lock(world, monkeypatch):
    # The pre-flight view of v1 is current; v2 is shared before the decision commits.
    _interleave(monkeypatch, "_lock_version", lambda: _second_version(world))
    with pytest.raises(services.PortalError, match="newer version"):
        services.approve_version(world.approver, world.v1)
    assert not Approval.objects.filter(version=world.v1).exists()


def test_l3_changes_and_accept_recheck_after_lock(world, monkeypatch):
    contract = services.create_version(world.deliv_a, actor=world.staff, summary="c", is_contractual=True)
    services.share_version(contract, actor=world.staff)
    _interleave(monkeypatch, "_lock_version", lambda: _second_version(world))
    with pytest.raises(services.PortalError, match="newer version"):
        services.request_version_changes(world.approver, contract, comment="x")
    with pytest.raises(services.PortalError, match="newer version"):
        services.accept_contract(world.signatory, contract, confirmed=True)
    assert not Approval.objects.filter(version=contract).exists()


def test_l3_decisions_lock_the_deliverable_row(world):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    with CaptureQueriesContext(connection) as queries:
        services.approve_version(world.approver, world.v1)
    assert any("FOR UPDATE" in q["sql"] for q in queries)


def test_l3_review_brief_rechecks_current_proposed_version(world, monkeypatch):
    from apps.portal.models import BriefStatus

    brief = world.brief_a
    assert brief.status == BriefStatus.PROPOSED

    def newer_proposed():
        v2 = services.save_brief(
            world.ch_a,
            segments=[{"id": "s1", "text": "Newer", "provenance": "agreed_fact"}],
            actor=world.staff,
        )
        services.propose_brief(v2, actor=world.staff)

    _interleave(monkeypatch, "_lock_brief", newer_proposed)
    with pytest.raises(services.PortalError, match="newer brief"):
        services.review_brief(world.approver, brief, accept=True, comment="")
    brief.refresh_from_db()
    assert brief.status == BriefStatus.PROPOSED and not brief.reviews.exists()


def test_l3_review_brief_uses_fresh_status(world):
    from apps.portal.models import BriefStatus, BriefVersion

    stale = world.brief_a
    BriefVersion.objects.filter(pk=stale.pk).update(status=BriefStatus.AGREED)
    with pytest.raises(services.PortalError, match="not waiting"):
        services.review_brief(world.approver, stale, accept=False, comment="late")


# --- M3: file versions ----------------------------------------------------------------------------------------


def test_m3_customer_cannot_append_to_a_staff_file(world):
    from apps.portal.models import FileVersion
    from tests.portal_helpers import upload

    staff_file = world.shared_file.file  # staff upload, customer-visible
    before = FileVersion.objects.filter(file=staff_file).count()
    with pytest.raises(services.PortalError, match="Not available"):
        services.upload_customer_file(world.contrib, world.ch_a, upload("evil.pdf"), file=staff_file)
    response = c(world.contrib).post(
        "/portal/files/upload/",
        {"challenge": world.ch_a.pk, "file_id": staff_file.pk, "file": upload("evil.pdf")},
    )
    assert response.status_code == 302
    assert FileVersion.objects.filter(file=staff_file).count() == before


def test_m3_customer_can_append_to_their_own_file(world):
    from tests.portal_helpers import upload

    first = services.upload_customer_file(world.contrib, world.ch_a, upload("mine.pdf"))
    second = services.upload_customer_file(world.contrib, world.ch_a, upload("mine2.pdf"), file=first.file)
    assert second.file_id == first.file_id and second.number == 2 and second.customer_visible


def test_m3_sharing_a_deliverable_exposes_only_the_pinned_file_version(world):
    from django.http import Http404

    from apps.portal import files as portal_files
    from tests.portal_helpers import upload

    internal = services.upload_staff_file(world.ch_a, upload("draft.pdf"), actor=world.staff, title="Report")
    assert internal.customer_visible is False
    pinned = services._add_file_version(
        internal.file,
        portal_files.check("final.pdf", "application/pdf", upload("x.pdf").read()),
        user=world.staff,
        organisation_id=world.org_a.pk,
    )
    v2 = services.create_version(world.deliv_a, actor=world.staff, summary="With file", file_version=pinned)
    services.share_version(v2, actor=world.staff)
    pinned.refresh_from_db()
    internal.refresh_from_db()
    assert pinned.customer_visible is True and internal.customer_visible is False
    with pytest.raises(Http404):
        selectors.get_file_version(world.contrib, internal.pk)
    assert selectors.get_file_version(world.contrib, pinned.pk).pk == pinned.pk
    assert [v.pk for v in selectors.file_versions(world.contrib, internal.file)] == [pinned.pk]
    client = c(world.contrib)
    assert client.get(f"/portal/files/versions/{internal.pk}/download/").status_code == 404
    page = client.get(f"/portal/files/{internal.file_id}/").content.decode()
    assert "draft.pdf" not in page and "final.pdf" in page


def test_m3_staff_making_a_file_visible_shares_its_current_versions(world):
    from tests.portal_helpers import upload

    version = services.upload_staff_file(world.ch_a, upload("later.pdf"), actor=world.staff, title="Later")
    assert version.customer_visible is False
    services.set_file_visibility(version.file, "customer", actor=world.staff)
    version.refresh_from_db()
    assert version.customer_visible is True


# --- L1: non-numeric ids are a 404, never a 500 ---------------------------------------------------------------


@pytest.mark.parametrize("bad", ["abc", "1e3", "-", "9" * 40, "1 OR 1=1"])
def test_l1_non_numeric_ids_in_posts_are_404(world, bad):
    client = c(world.contrib)
    client.raise_request_exception = False
    for field in ("milestone", "deliverable"):
        r = client.post(f"/portal/challenges/{world.ch_a.pk}/discuss/", {"body": "hi", field: bad})
        assert r.status_code == 404, (field, r.status_code)
    for activity, field in (
        ("summarise_project", "project"),
        ("explain_deliverable", "deliverable"),
        ("clarify_challenge", "challenge"),
        ("unanswered", "challenge"),
    ):
        r = client.post(f"/portal/assistant/{activity}/", {field: bad})
        assert r.status_code == 404, (activity, r.status_code)
    r = client.post("/portal/files/upload/", {"challenge": bad})
    assert r.status_code in (302, 404)


def test_l1_selectors_reject_non_numeric_pk(world):
    from django.http import Http404

    for getter in (
        selectors.get_challenge,
        selectors.get_project,
        selectors.get_milestone,
        selectors.get_deliverable,
        selectors.get_file,
        selectors.get_file_version,
        selectors.get_version,
        selectors.get_brief,
        selectors.get_thread,
        selectors.get_update,
    ):
        with pytest.raises(Http404):
            getter(world.contrib, "abc")


def test_l1_unicode_digit_version_query_is_not_a_500(world):
    client = c(world.contrib)
    client.raise_request_exception = False
    assert client.get(f"/portal/deliverables/{world.deliv_a.pk}/?v=\u00b2").status_code == 200


# --- L2: events about records that are no longer visible are not shown ---------------------------------------


def _feed(world):
    return [e.summary for e in selectors.events(world.contrib)]


def test_l2_unpublishing_a_deliverable_hides_its_events(world):
    assert any("Prototype report" in s for s in _feed(world))
    services.set_published(world.deliv_a, False, actor=world.staff)
    assert not any("Prototype report" in s for s in _feed(world))
    client = c(world.contrib)
    assert "Prototype report: version 1 is ready" not in client.get("/portal/activity/").content.decode()
    assert "Prototype report: version 1 is ready" not in client.get("/portal/").content.decode()
    services.set_published(world.deliv_a, True, actor=world.staff)
    assert any("Prototype report" in s for s in _feed(world))


def test_l2_withdrawing_a_version_hides_only_that_versions_events(world):
    v2 = _second_version(world)
    assert any("version 2 is ready" in s for s in _feed(world))
    services.withdraw_version(v2, actor=world.staff)
    feed = _feed(world)
    assert not any("version 2" in s for s in feed)
    assert any("version 1 is ready" in s for s in feed)


def test_l2_unpublishing_a_milestone_hides_its_events(world):
    services.save_milestone(world.project_a, actor=world.staff, milestone=world.ms2, status="complete")
    assert any("Prototype review" in s for s in _feed(world))
    services.set_published(world.ms2, False, actor=world.staff)
    assert not any("Prototype review" in s for s in _feed(world))


def test_l2_unpublishing_a_question_hides_its_events(world):
    assert any("ledger system" in s for s in _feed(world))
    services.set_published(world.q_a, False, actor=world.staff)
    assert not any("ledger system" in s for s in _feed(world))


def test_l2_ai_what_changed_context_excludes_hidden_events(world):
    from apps.portal import ai

    services.set_published(world.deliv_a, False, actor=world.staff)
    sources = ai.build_context("what_changed", world.contrib)
    assert "Prototype report" not in " ".join(str(s) for s in sources)


# --- L4: legacy Office (OLE) formats are refused in the portal -------------------------------------------------

OLE_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1" + b"\x00" * 600


@pytest.mark.parametrize(
    ("name", "content_type"),
    [
        ("report.doc", "application/msword"),
        ("sheet.xls", "application/vnd.ms-excel"),
        ("sheet.xls", "application/octet-stream"),
        ("notes.txt", "text/plain"),
    ],
)
def test_l4_portal_refuses_ole_documents(world, name, content_type):
    from apps.portal import files as portal_files

    checked = portal_files.check(name, content_type, OLE_MAGIC)
    assert checked.refused_reason
    if name.endswith((".doc", ".xls")):
        assert ".docx" in checked.refused_reason or "PDF" in checked.refused_reason


def test_l4_customer_upload_of_doc_is_refused_with_a_message(world):
    from apps.portal.models import FileVersion
    from tests.portal_helpers import upload

    before = FileVersion.objects.count()
    response = c(world.contrib).post(
        "/portal/files/upload/",
        {"challenge": world.ch_a.pk, "file": upload("old.doc", OLE_MAGIC, "application/msword")},
        follow=True,
    )
    assert b"Older Word and Excel" in response.content
    assert FileVersion.objects.count() == before


def test_l4_enquiries_allow_list_is_unchanged():
    from apps.enquiries.attachments import ALLOWED

    assert "application/msword" in ALLOWED and "application/vnd.ms-excel" in ALLOWED


# --- L6: staff redirect target is validated --------------------------------------------------------------------


@pytest.mark.parametrize(
    "target",
    [
        "https://evil.example/phish",
        "//evil.example/x",
        "http://evil.example",
        "javascript:alert(1)",
        "\\\\evil.example",
    ],
)
def test_l6_staff_back_redirect_rejects_foreign_targets(world, target):
    from tests.portal_helpers import client_for as make_client

    staff = make_client(world.staff)
    response = staff.post(
        f"/client-portal/publish/milestone/{world.ms2.pk}/off/", {"next": target}, HTTP_HOST="testserver"
    )
    assert response.status_code == 302
    assert response["Location"] == "/client-portal/"


def test_l6_staff_back_redirect_keeps_local_paths(world):
    from tests.portal_helpers import client_for as make_client

    staff = make_client(world.staff)
    response = staff.post(
        f"/client-portal/publish/milestone/{world.ms2.pk}/on/",
        {"next": f"/client-portal/projects/{world.project_a.pk}/"},
    )
    assert response["Location"] == f"/client-portal/projects/{world.project_a.pk}/"


# --- M2: public and customer AI workflows cannot use the whole daily pool --------------------------------------


def _live_runs(workflow, count, prefix):
    """Metered live (not simulated) runs today, each its own run."""
    import uuid

    from apps.aicore.models import ModelExecution

    for index in range(count):
        ModelExecution.objects.create(
            execution_id=uuid.uuid4(),
            workflow=workflow,
            run_ref=f"{prefix}-{index}",
            prompt_id="p",
            prompt_version=1,
            prompt_hash="h",
            provider="anthropic",
            model="m",
            outcome="success",
            attempts=1,
            simulated=False,
        )


def _guard_decision(workflow):
    from apps.aicore import services as aicore
    from apps.aicore.core.limits import RunContext

    guard = aicore.build_gateway(object()).guard
    return guard.check_call(
        RunContext(workflow=workflow, run_ref="new-run"), input_chars=10, worst_case_gbp=0
    )


@pytest.fixture
def pool(db):
    from apps.aicore.models import AiSettings

    AiSettings.objects.update_or_create(pk=1, defaults={"enabled": True, "daily_run_cap": 10})


def test_m2_brief_assist_is_capped_at_its_share_of_the_daily_pool(pool):
    _live_runs("aidata.brief_questions", 3, "ba")  # 30% of 10
    refused = _guard_decision("aidata.brief_draft")
    assert not refused.allowed and refused.limit == "workflow_daily_cap"
    assert _guard_decision("aidata.extract_statement").allowed  # staff workflows keep headroom
    assert _guard_decision("portal.unanswered").allowed


def test_m2_portal_assistant_is_capped_at_its_share_of_the_daily_pool(pool):
    _live_runs("portal.what_changed", 3, "portal-m1")
    refused = _guard_decision("portal.unanswered")
    assert not refused.allowed and refused.limit == "workflow_daily_cap"
    assert _guard_decision("aidata.brief_questions").allowed


def test_m2_public_and_customer_together_never_take_the_whole_pool(pool):
    _live_runs("aidata.brief_questions", 3, "ba")
    _live_runs("portal.unanswered", 3, "portal-m1")
    staff = _guard_decision("aidata.extract_statement")
    assert staff.allowed  # 6 of 10 used by public and customer at most; the other 4 stay for staff


def test_m2_shares_are_settings_with_sane_defaults(settings, pool):
    from django.conf import settings as django_settings

    assert django_settings.AI_DATA_BRIEF_ASSIST_DAILY_SHARE_PERCENT == 30
    assert django_settings.AI_DATA_PORTAL_DAILY_SHARE_PERCENT == 30
    assert django_settings.PORTAL_AI_PER_MEMBER_PER_HOUR == 10
    settings.AI_DATA_BRIEF_ASSIST_DAILY_SHARE_PERCENT = 10  # 1 of 10
    _live_runs("aidata.brief_questions", 1, "ba")
    assert not _guard_decision("aidata.brief_questions").allowed


def test_m2_unused_share_is_not_reserved_for_a_closed_workflow(pool, settings):
    settings.AI_DATA_BRIEF_ASSIST_DAILY_SHARE_PERCENT = 0
    assert not _guard_decision("aidata.brief_questions").allowed


def test_m2_portal_assistant_is_throttled_per_member_with_an_honest_answer(world):
    import uuid

    from apps.aicore.core.providers import SimulatedProvider
    from apps.aicore.models import ModelExecution
    from apps.portal import ai

    for index in range(10):
        ModelExecution.objects.create(
            execution_id=uuid.uuid4(),
            workflow="portal.unanswered",
            run_ref=f"portal-m{world.approver.pk}-{index}",
            prompt_id="p",
            prompt_version=1,
            prompt_hash="h",
            provider="x",
            model="m",
            outcome="success",
            attempts=1,
            simulated=True,
        )
    provider = SimulatedProvider(
        [{"respond": {"summary": "s", "points": [{"text": "t", "sources": ["S1"]}], "gaps": []}}]
    )
    result = ai.answer("unanswered", world.approver, provider=provider)
    assert result.mode == "compiled" and provider.calls == []
    assert "limit" in result.note.lower() and "10" in result.note
    # Another member is unaffected, and the view answers 200, not an error page.
    other = ai.answer(
        "unanswered",
        world.contrib,
        provider=SimulatedProvider(
            [{"respond": {"summary": "s", "points": [{"text": "t", "sources": ["S1"]}], "gaps": []}}]
        ),
    )
    assert other.mode == "ai"
    response = c(world.approver).post("/portal/assistant/unanswered/")
    assert response.status_code == 200


def test_m2_every_assistant_answer_is_its_own_run(world):
    from apps.aicore.core.providers import SimulatedProvider
    from apps.aicore.models import ModelExecution
    from apps.portal import ai

    def provider():
        return SimulatedProvider(
            [{"respond": {"summary": "s", "points": [{"text": "t", "sources": ["S1"]}], "gaps": []}}]
        )

    ai.answer("unanswered", world.approver, provider=provider())
    ai.answer("unanswered", world.approver, provider=provider())
    refs = set(ModelExecution.objects.values_list("run_ref", flat=True))
    assert len(refs) == 2 and all(r.startswith(f"portal-m{world.approver.pk}-") for r in refs)
    assert all(len(r) <= 40 for r in refs)
