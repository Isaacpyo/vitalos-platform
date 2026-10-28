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
