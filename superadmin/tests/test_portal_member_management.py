"""Client portal member management (ADR-056, "Member management"): cancel, suspend, restore, remove, the account
clean-up after removal, the Former member display, organisation isolation, and Settings > Client portal users."""

import pytest
from django.test import Client
from django.urls import reverse

from apps.accounts.erasure import FORMER_MEMBER, is_erased
from apps.accounts.models import User
from apps.accounts.roles import SERVICE_LEAD, VIEWER
from apps.accounts.services import set_role
from apps.audit.models import AuditEvent
from apps.portal import members, services, staff_selectors
from apps.portal.models import Approval, Event, Invitation, Membership, Role
from tests.conftest import login
from tests.portal_helpers import build_world, client_for, make_member


@pytest.fixture
def world(db):
    return build_world()


@pytest.fixture
def staff(world):
    return client_for(world.staff)


def member_url(member, action, org=None):
    return reverse("portaladmin:member_action", args=[(org or member.organisation).pk, member.pk, action])


def invite(world, email="engineerirng@northwind.example.test", org=None):
    return services.invite_member(
        organisation=org or world.org_a,
        email=email,
        full_name="",
        role=Role.VIEWER,
        actor=world.staff,
        send=False,
    )


# --- The Members table ---------------------------------------------------------------------------------------


def test_members_table_shows_state_badges_and_the_matching_icon_actions(world, staff):
    pending = invite(world)
    services.revoke_member(world.viewer, actor=world.staff)
    body = staff.get(f"/client-portal/orgs/{world.org_a.pk}/").content.decode()
    assert f'data-member="{pending.pk}" data-state="invited"' in body
    assert f'data-member="{world.viewer.pk}" data-state="suspended"' in body
    assert f'data-member="{world.contrib.pk}" data-state="active"' in body
    for label in (">Invited</span>", ">Suspended</span>", ">Active</span>"):
        assert label in body
    # Invited: resend and cancel. Active: preview, suspend, remove. Suspended: restore, remove.
    assert 'aria-label="Resend the invitation to engineerirng@northwind.example.test"' in body
    assert 'data-confirm-title="Cancel the invitation for engineerirng@northwind.example.test?"' in body
    assert 'aria-label="Suspend access for Colin Contributor"' in body
    assert 'aria-label="Restore access for Vera Viewer"' in body
    assert 'data-confirm-title="Remove Colin Contributor from Northwind Synthetic Ltd?"' in body
    assert "data-confirm-danger" in body and 'class="icon-tip" aria-hidden="true">Cancel invitation<' in body
    rows = {row["member"].pk: row for row in staff_selectors.member_rows(world.org_a)}
    assert rows[pending.pk]["can_cancel"] and not rows[pending.pk]["can_remove"]
    assert rows[world.contrib.pk]["can_remove"] and not rows[world.contrib.pk]["can_cancel"]


def test_an_expired_invitation_reads_as_expired(world, staff):
    pending = invite(world)
    Invitation.objects.filter(membership=pending).update(expires_at=pending.created_at)
    assert staff_selectors.member_state(pending) == "expired"
    assert (
        ">Invitation expired</span>" in staff.get(f"/client-portal/orgs/{world.org_a.pk}/").content.decode()
    )


# --- Cancel an invitation -----------------------------------------------------------------------------------


def test_cancel_invitation_deletes_the_pending_membership_and_the_unused_account(world, staff):
    pending = invite(world)
    user_pk, pk = pending.user_id, pending.pk
    response = staff.post(member_url(pending, "cancel"), follow=True)
    assert (
        response.status_code == 200
        and b"Invitation for engineerirng@northwind.example.test cancelled" in (response.content)
    )
    assert not Membership.objects.filter(pk=pk).exists()
    assert not Invitation.objects.filter(membership_id=pk).exists()
    assert not User.objects.filter(pk=user_pk).exists()
    cancelled = AuditEvent.objects.get(action="portal.invitation_cancelled")
    assert cancelled.actor == world.staff and cancelled.entity_id == str(pk)
    deleted = AuditEvent.objects.get(action="portal.account_deleted")
    assert deleted.summary == f"Deleted portal user #{user_pk}"
    # The earlier invitation event is untouched.
    assert AuditEvent.objects.filter(action="portal.member_invited", entity_id=str(pk)).exists()


def test_cancel_keeps_an_account_that_belongs_to_another_organisation(world, staff):
    other = invite(world, email="shared@example.test", org=world.org_b)
    pending = invite(world, email="shared@example.test")
    assert other.user_id == pending.user_id
    staff.post(member_url(pending, "cancel"))
    assert User.objects.filter(pk=other.user_id).exists() and Membership.objects.filter(pk=other.pk).exists()


def test_cancel_is_refused_once_accepted(world, staff):
    response = staff.post(member_url(world.contrib, "cancel"), follow=True)
    assert b"already accepted" in response.content
    assert Membership.objects.filter(pk=world.contrib.pk).exists()


# --- Suspend and restore ------------------------------------------------------------------------------------


def test_suspend_and_restore_access(world, staff):
    member = world.contrib
    staff.post(member_url(member, "revoke"))
    member.refresh_from_db()
    assert member.revoked_at and not member.is_active
    assert staff_selectors.member_state(member) == "suspended"
    staff.post(member_url(member, "restore"))
    member.refresh_from_db()
    assert member.is_active and member.revoked_at is None
    for action in ("portal.member_revoked", "portal.member_restored"):
        assert AuditEvent.objects.filter(action=action, entity_id=str(member.pk), actor=world.staff).exists()


# --- Remove from organisation ---------------------------------------------------------------------------------


def test_remove_a_member_with_no_project_footprint_deletes_the_account(world, staff):
    member = world.viewer
    user_pk = member.user_id
    response = staff.post(member_url(member, "remove"), follow=True)
    assert b"was removed from Northwind Synthetic Ltd" in response.content
    assert not Membership.objects.filter(pk=member.pk).exists()
    assert not User.objects.filter(pk=user_pk).exists()
    assert AuditEvent.objects.filter(action="portal.member_removed", entity_id=str(member.pk)).exists()


def test_remove_keeps_customer_content_and_shows_former_member(world, staff):
    member = world.approver
    message = services.post_customer_message(member, world.ch_a, body="Synthetic: here is our ledger export.")
    approval = services.approve_version(member, world.v1)
    user = member.user
    assert members.account_outcome(user, leaving=member) == members.ERASED

    staff.post(member_url(member, "remove"))
    user.refresh_from_db()
    assert is_erased(user) and user.full_name == FORMER_MEMBER and not user.is_active
    assert not user.has_usable_password() and user.email != "approver@northwind.example.test"
    # Their message and approval stay in the record, still authored by the (erased) account.
    message.refresh_from_db()
    assert message.author_id == user.pk and message.body.startswith("Synthetic")
    approval = Approval.objects.get(pk=approval.pk)
    assert approval.user_id == user.pk
    # The approval keeps the name captured at the decision (contractual evidence, ADR-056 §10).
    assert approval.user_name == "Alma Approver"
    # The activity feed no longer names them.
    summaries = list(Event.objects.filter(actor_user=user).values_list("summary", flat=True))
    assert summaries and all("Alma Approver" not in s and FORMER_MEMBER in s for s in summaries)
    # Staff pages show Former member, never the placeholder address.
    page = staff.get(f"/client-portal/challenges/{world.ch_a.pk}/").content.decode()
    assert FORMER_MEMBER in page and "erased.invalid" not in page
    erased = AuditEvent.objects.get(action="portal.account_erased")
    assert erased.summary.startswith(f"Erased portal user #{user.pk}")
    assert erased.metadata["kept"]["message"] == 1 and erased.metadata["kept"]["approval"] == 1
    # An erased account can never sign in (no address, no usable password) and is no longer listed anywhere.
    assert not User.objects.filter(email="approver@northwind.example.test").exists()
    assert all(row["user"].pk != user.pk for row in staff_selectors.customer_accounts())
    assert "erased.invalid" not in staff.get("/settings/users/").content.decode()


def test_customer_view_shows_former_member_for_the_removed_author(world, staff):
    member = world.contrib
    services.post_customer_message(member, world.ch_a, body="Synthetic question about the pilot")
    staff.post(member_url(member, "remove"))
    reader = client_for(world.approver.user)
    body = reader.get(f"/portal/challenges/{world.ch_a.pk}/").content.decode()
    assert "Synthetic question about the pilot" in body
    assert FORMER_MEMBER in body and "Colin Contributor" not in body


def test_remove_keeps_an_account_with_another_membership_or_a_staff_role(world, staff):
    shared = make_member(world.org_b, "contrib@northwind.example.test", Role.VIEWER)
    staff.post(member_url(world.contrib, "remove"))
    shared.user.refresh_from_db()
    assert shared.user.email == "contrib@northwind.example.test" and shared.user.is_active
    assert Membership.objects.filter(pk=shared.pk).exists()

    member = world.signatory
    set_role(member.user, VIEWER, actor=None)  # a member who later became staff
    staff.post(member_url(member, "remove"))
    member.user.refresh_from_db()
    assert User.objects.filter(pk=member.user_id).exists() and not is_erased(member.user)


# --- Isolation, method, CSRF, role ----------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["remove", "revoke", "restore", "resend", "cancel", "role"])
def test_a_member_cannot_be_acted_on_from_another_organisations_url(world, staff, action):
    member = world.contrib  # organisation A
    response = staff.post(member_url(member, action, org=world.org_b), {"role": "approver"})
    assert response.status_code == 404
    member.refresh_from_db()
    assert member.is_active and member.role == Role.CONTRIBUTOR


@pytest.mark.parametrize("action", ["remove", "revoke", "restore", "resend", "cancel", "role"])
def test_member_actions_are_post_only_csrf_protected_and_staff_only(world, action, make_user):
    url = member_url(world.contrib, action)
    assert client_for(world.staff).get(url).status_code == 405
    strict = login(Client(enforce_csrf_checks=True), world.staff)
    assert strict.post(url).status_code == 403
    viewer = make_user(VIEWER, email="viewer-staff@example.test")
    assert login(Client(), viewer).post(url).status_code == 403
    assert client_for(world.contrib.user).post(url).status_code in (403, 404)
    assert Membership.objects.filter(pk=world.contrib.pk, is_active=True).exists()


def test_unknown_member_action_is_a_404(world, staff):
    assert staff.post(member_url(world.contrib, "promote")).status_code == 404


# --- Settings > Users & roles > Client portal users -----------------------------------------------------------

PORTAL_USERS = "/settings/users/portal/"


def customer_url(user, action):
    return reverse("portal_settings:user_action", args=[user.pk, action])


def test_client_portal_users_list_is_superadmin_only_and_separate_from_staff(world, staff, make_user, seeded):
    body = staff.get(PORTAL_USERS).content.decode()
    assert 'data-testid="portal-users-table"' in body and "Client portal users" in body
    for name in ("Vera Viewer", "Colin Contributor", "Bea Contoso"):
        assert name in body
    assert world.staff.email not in body.split('data-testid="portal-users-table"')[1]
    assert f'href="/client-portal/orgs/{world.org_a.pk}/"' in body
    assert 'name="role"' not in body  # no role select for customers
    staff_body = staff.get("/settings/users/").content.decode()
    assert "Colin Contributor" not in staff_body and world.staff.email in staff_body
    lead = make_user(SERVICE_LEAD, email="lead-portal@example.test")
    viewer = make_user(VIEWER, email="viewer-portal@example.test")
    assert login(Client(), lead).get(PORTAL_USERS).status_code == 403
    assert login(Client(), viewer).get(PORTAL_USERS).status_code == 403
    assert client_for(world.contrib.user).get(PORTAL_USERS).status_code in (403, 404)


def test_account_level_suspend_restore_and_remove_reuse_the_member_services(world, staff):
    user = world.contrib.user
    second = make_member(world.org_b, user.email, Role.VIEWER)
    staff.post(customer_url(user, "suspend"))
    assert not Membership.objects.filter(user=user, revoked_at__isnull=True).exists()
    assert AuditEvent.objects.filter(action="portal.member_revoked").count() == 2
    staff.post(customer_url(user, "restore"))
    assert Membership.objects.filter(user=user, revoked_at__isnull=True, is_active=True).count() == 2
    response = staff.post(customer_url(user, "remove"), follow=True)
    assert b"removed from every organisation" in response.content
    assert not Membership.objects.filter(pk__in=[world.contrib.pk, second.pk]).exists()
    assert not User.objects.filter(pk=user.pk).exists()
    assert AuditEvent.objects.filter(action="portal.member_removed").count() == 2


def test_account_actions_refuse_staff_accounts_and_need_post_csrf_and_superadmin(world, staff, make_user):
    assert staff.post(customer_url(world.staff, "remove")).status_code == 404
    url = customer_url(world.contrib.user, "remove")
    assert staff.get(url).status_code == 405
    assert login(Client(enforce_csrf_checks=True), world.staff).post(url).status_code == 403
    lead = make_user(SERVICE_LEAD, email="lead-actions@example.test")
    assert login(Client(), lead).post(url).status_code == 403
    assert staff.post(customer_url(world.contrib.user, "promote")).status_code == 404
    assert User.objects.filter(pk=world.contrib.user_id).exists()


def test_member_services_refuse_non_staff_actors(world):
    from django.core.exceptions import PermissionDenied

    with pytest.raises(PermissionDenied):
        members.remove_member(world.contrib, actor=world.viewer.user)
    with pytest.raises(PermissionDenied):
        members.cancel_invitation(invite(world), actor=None)
