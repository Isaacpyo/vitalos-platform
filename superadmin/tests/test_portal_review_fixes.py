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
