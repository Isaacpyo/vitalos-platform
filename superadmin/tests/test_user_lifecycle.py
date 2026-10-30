"""Settings > Users & roles: suspend, reactivate, reset two-step sign-in, set-password link and delete for staff."""

from types import SimpleNamespace

import pytest
from django.contrib.sessions.models import Session
from django.core.exceptions import ValidationError
from django.test import Client
from django.urls import reverse
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.accounts import lifecycle, services
from apps.accounts.models import ApiToken, User
from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER
from apps.architecture.models import TeamMember
from apps.audit.models import AuditEvent
from apps.audit.services import record
from tests.conftest import random_password

USERS = "/settings/users/"


def action_url(user, action):
    return reverse("accounts:user_action", args=[user.pk, action])


@pytest.fixture
def admin(client_for, superadmin):
    return client_for(superadmin)


@pytest.fixture
def target(make_user):
    return make_user(VIEWER, email="target@example.test", full_name="Tara Target")


# --- Page ------------------------------------------------------------------------------------------------------


def test_users_page_shows_icon_actions_with_labels_and_tooltips(admin, superadmin, target, seeded):
    TOTPDevice.objects.create(user=target, name="app", confirmed=True)
    body = admin.get(USERS).content.decode()
    for testid, aria in (
        ("user-edit", "Edit Tara Target"),
        ("user-send-link", "Send a set-password link to Tara Target"),
        ("user-reset-2fa", "Reset two-step sign-in for Tara Target"),
        ("user-suspend", "Suspend Tara Target"),
        ("user-delete", "Delete Tara Target"),
    ):
        assert f'aria-label="{aria}" data-testid="{testid}"' in body, testid
    assert 'class="icon-tip" aria-hidden="true">Delete</span>' in body
    # Destructive actions use the styled dialog with the person's name, never window.confirm.
    assert 'data-confirm-title="Delete Tara Target?"' in body and "data-confirm-danger" in body
    assert 'data-confirm-title="Suspend Tara Target?"' in body
    # Your own row: Suspend and Delete are disabled, with the reason as the tooltip.
    assert 'aria-label="Delete admin@example.test. This is your account."' in body
    assert body.count('aria-disabled="true"') >= 2


def test_staff_list_leaves_out_customers_and_erased_accounts(admin, target, seeded):
    from apps.accounts.erasure import erase_account
    from apps.portal import services as portal_services

    org = portal_services.create_organisation(name="Synthetic Org", actor=None)
    member = portal_services.invite_member(
        organisation=org,
        email="customer@example.test",
        full_name="Cara Customer",
        role="viewer",
        actor=None,
        send=False,
    )
    gone = User.objects.create_user(email="gone@example.test", password=random_password())
    erase_account(gone)
    body = admin.get(USERS).content.decode()
    assert "Tara Target" in body and "Cara Customer" not in body and "erased.invalid" not in body
    assert admin.post(action_url(member.user, "suspend")).status_code == 404
    assert admin.get(reverse("accounts:user_edit", args=[member.user.pk])).status_code == 404
    assert admin.post(action_url(gone, "delete")).status_code == 404


# --- Suspend and reactivate -----------------------------------------------------------------------------------


def test_suspend_ends_sign_in_sessions_and_api_tokens_at_once(admin, superadmin, target, seeded):
    password = random_password()
    target.set_password(password)
    target.save()
    their_client = Client()
    their_client.force_login(target)
    assert their_client.get("/").status_code == 200
    token, raw = ApiToken.issue(target, "script")
    assert Client().get("/api/v1/service-lines/", HTTP_AUTHORIZATION=f"Bearer {raw}").status_code == 200

    response = admin.post(action_url(target, "suspend"))
    assert response.status_code == 302 and response["Location"] == USERS
    target.refresh_from_db()
    token.refresh_from_db()
    assert not target.is_active and token.revoked_at is not None
    # The open session is gone and the next request is treated as signed out.
    assert not any(s.get_decoded().get("_auth_user_id") == str(target.pk) for s in Session.objects.all())
    assert their_client.get("/").status_code == 302
    assert Client().get("/api/v1/service-lines/", HTTP_AUTHORIZATION=f"Bearer {raw}").status_code in (
        401,
        403,
    )
    # And they cannot sign in again.
    signin = Client().post("/login/", {"email": target.email, "password": password})
    assert signin.status_code == 200 and "_auth_user_id" not in signin.client.session
    event = AuditEvent.objects.get(action="users.deactivated", entity_id=str(target.pk))
    assert event.actor == superadmin and event.metadata["tokens_revoked"] == 1
    assert event.metadata["sessions_ended"] == 1
    assert "Suspended" in admin.get(USERS).content.decode()


def test_reactivate_restores_sign_in_but_not_old_tokens(admin, superadmin, target, seeded):
    token, _ = ApiToken.issue(target, "script")
    lifecycle.suspend_user(target, superadmin)
    response = admin.post(action_url(target, "reactivate"))
    assert response.status_code == 302
    target.refresh_from_db()
    token.refresh_from_db()
    assert target.is_active and token.revoked_at is not None
    assert AuditEvent.objects.filter(
        action="users.activated", entity_id=str(target.pk), actor=superadmin
    ).exists()


def test_the_edit_form_uses_the_same_suspend_rules(admin, superadmin, target, seeded):
    token, _ = ApiToken.issue(target, "script")
    admin.post(reverse("accounts:user_edit", args=[target.pk]), {"full_name": "Tara Target", "role": VIEWER})
    target.refresh_from_db()
    token.refresh_from_db()
    assert not target.is_active and token.revoked_at is not None


# --- Reset two-step and set-password link ---------------------------------------------------------------------


def test_reset_two_step_removes_authenticators_and_is_audited(admin, superadmin, target, seeded):
    TOTPDevice.objects.create(user=target, name="app", confirmed=True)
    response = admin.post(action_url(target, "reset_2fa"))
    assert response.status_code == 302
    assert not TOTPDevice.objects.filter(user=target).exists()
    event = AuditEvent.objects.get(action="users.mfa_reset", entity_id=str(target.pk))
    assert event.actor == superadmin and event.metadata["devices_removed"] == 1


def test_reset_two_step_is_refused_on_yourself(admin, superadmin, seeded):
    with pytest.raises(ValidationError, match="Account & security"):
        lifecycle.reset_two_step(superadmin, superadmin)
    admin.post(action_url(superadmin, "reset_2fa"))
    assert TOTPDevice.objects.filter(user=superadmin).exists()


def test_send_password_link_emails_once_and_is_limited(admin, superadmin, target, seeded, mailoutbox):
    response = admin.post(action_url(target, "send_link"))
    assert response.status_code == 302
    assert len(mailoutbox) == 1 and mailoutbox[0].to == [target.email]
    sent = mailoutbox[0]
    assert sent.extra_headers["Auto-Submitted"] == "auto-generated"
    assert sent.extra_headers["X-Vitalos-Notification"] == "accounts.password-link"
    assert "administrator sent you this link" in sent.body
    event = AuditEvent.objects.get(action="auth.setup_link_issued", entity_id=str(target.pk))
    assert event.actor == superadmin
    for _ in range(2):
        admin.post(action_url(target, "send_link"))
    assert len(mailoutbox) == 3
    refused = admin.post(action_url(target, "send_link"), follow=True)
    assert len(mailoutbox) == 3 and b"in the last hour" in refused.content


def test_a_failed_link_email_is_a_message_not_an_error(admin, target, seeded, monkeypatch):
    from apps.mailer import system

    def down(*args, **kwargs):
        raise RuntimeError("provider down")

    monkeypatch.setattr(system, "send", down)
    response = admin.post(action_url(target, "send_link"), follow=True)
    assert response.status_code == 200 and b"could not be sent" in response.content


def test_no_link_for_a_suspended_account(admin, superadmin, target, seeded, mailoutbox):
    lifecycle.suspend_user(target, superadmin)
    response = admin.post(action_url(target, "send_link"), follow=True)
    assert not mailoutbox and b"Reactivate the account" in response.content


# --- Delete ----------------------------------------------------------------------------------------------------


def test_delete_removes_the_account_and_keeps_the_audit_trail(admin, superadmin, target, seeded):
    ApiToken.issue(target, "script")
    TOTPDevice.objects.create(user=target, name="app", confirmed=True)
    member = TeamMember.objects.create(name="Tara Target", user=target, email=target.email)
    earlier = record("auth.sign_in", actor=target, summary="Signed in")
    pk = target.pk

    response = admin.post(action_url(target, "delete"))
    assert response.status_code == 302 and response["Location"] == USERS
    assert not User.objects.filter(pk=pk).exists()
    assert (
        not ApiToken.objects.filter(user_id=pk).exists()
        and not TOTPDevice.objects.filter(user_id=pk).exists()
    )
    # Records that pointed at the account lose the link, not their row.
    member.refresh_from_db()
    assert member.user is None
    # The trail keeps its snapshot and never breaks on the missing actor.
    earlier = AuditEvent.objects.get(pk=earlier.pk)
    assert earlier.actor is None and earlier.actor_email == "target@example.test"
    deleted = AuditEvent.objects.get(action="users.deleted")
    assert deleted.summary == f"Deleted user #{pk}" and deleted.entity_id == str(pk)
    assert deleted.actor == superadmin and deleted.metadata["roles"] == [VIEWER]
    assert admin.get("/audit/").status_code == 200
    assert admin.get("/activity/").status_code == 200


def test_delete_is_refused_while_the_account_owns_live_work(admin, superadmin, make_user, seeded):
    owner = make_user(SERVICE_LEAD, email="owner@example.test", full_name="Olu Owner")
    line = seeded["consulting"]
    line.owner = owner
    line.save()
    response = admin.post(action_url(owner, "delete"))
    assert response.status_code == 302 and f"refused={owner.pk}" in response["Location"]
    assert User.objects.filter(pk=owner.pk).exists()
    page = admin.get(response["Location"]).content.decode()
    assert "Olu Owner can't be deleted" in page
    assert (
        "Owns 1 service line (Vitalos Consulting)." in page and "Choose a new owner in Service lines." in page
    )
    assert 'data-testid="suspend-instead"' in page
    # Once reassigned, deletion goes ahead.
    line.owner = superadmin
    line.save()
    admin.post(action_url(owner, "delete"))
    assert not User.objects.filter(pk=owner.pk).exists()


def test_delete_is_refused_for_authors_of_protected_project_records(admin, superadmin, make_user, seeded):
    from tests.portal_helpers import build_world

    world = build_world(staff=make_user(SUPERADMIN, email="writer@example.test"))
    from apps.portal import services as portal_services

    portal_services.post_staff_message(
        world.ch_a, body="Synthetic staff note to the customer", actor=world.staff
    )
    blockers = lifecycle.deletion_blockers(world.staff)
    assert any("client portal message" in b.text for b in blockers)
    response = admin.post(action_url(world.staff, "delete"))
    assert "refused=" in response["Location"]
    assert User.objects.filter(pk=world.staff.pk).exists()


def test_suspend_and_delete_are_refused_on_yourself(admin, superadmin, seeded):
    for action in ("suspend", "delete"):
        response = admin.post(action_url(superadmin, action))
        assert f"refused={superadmin.pk}" in response["Location"]
    superadmin.refresh_from_db()
    assert superadmin.is_active
    page = admin.get(f"{USERS}?refused={superadmin.pk}&action=delete").content.decode()
    assert "You cannot delete your own account" in page and 'data-testid="user-refusal"' in page
    assert 'data-testid="suspend-instead"' not in page
    assert not AuditEvent.objects.filter(action__in=["users.deleted", "users.deactivated"]).exists()


def test_the_last_active_superadmin_is_never_suspended_or_deleted(superadmin, make_user, seeded):
    # An automation actor that is not an account (as a management command would be): only the rule can stop it.
    system = SimpleNamespace(
        pk=0, email="", is_authenticated=True, is_active=True, _vsa_roles=frozenset({SUPERADMIN})
    )
    assert lifecycle.is_last_active_superadmin(superadmin)
    with pytest.raises(ValidationError, match="last active SuperAdmin"):
        lifecycle.check_can_suspend(superadmin, system)
    with pytest.raises(ValidationError, match="last active SuperAdmin"):
        lifecycle.check_can_delete(superadmin, system)
    second = make_user(SUPERADMIN, email="second@example.test")
    assert not lifecycle.is_last_active_superadmin(superadmin)
    lifecycle.suspend_user(second, superadmin)
    assert lifecycle.is_last_active_superadmin(superadmin)


def test_primary_owner_and_superusers_are_protected(admin, superadmin, make_user, seeded):
    services.ensure_primary_owner("owner@example.test")
    owner = User.objects.get(email="owner@example.test")
    with pytest.raises(ValidationError, match="primary owner cannot be deleted"):
        lifecycle.check_can_delete(owner, superadmin)
    root = make_user(None, email="root@example.test", is_superuser=True, is_staff=True)
    assert "Django superuser" in " ".join(b.text for b in lifecycle.refusal(root, owner, "delete"))
    # With an owner, only the owner removes another SuperAdmin.
    other = make_user(SUPERADMIN, email="other-admin@example.test")
    with pytest.raises(ValidationError, match="Only the primary owner"):
        lifecycle.check_can_delete(other, superadmin)
    lifecycle.check_can_delete(other, owner)


# --- Method, CSRF, role --------------------------------------------------------------------------------------


@pytest.mark.parametrize("action", ["suspend", "reactivate", "reset_2fa", "send_link", "delete"])
def test_actions_are_post_only_csrf_protected_and_superadmin_only(
    action, superadmin, target, client_for, make_user, seeded
):
    from tests.conftest import login

    assert client_for(superadmin).get(action_url(target, action)).status_code == 405
    strict = login(Client(enforce_csrf_checks=True), superadmin)
    assert strict.post(action_url(target, action)).status_code == 403
    for role in (SERVICE_LEAD, VIEWER):
        other = make_user(role)
        assert client_for(other).post(action_url(target, action)).status_code == 403
    assert Client().post(action_url(target, action)).status_code == 302  # to sign in
    target.refresh_from_db()
    assert target.is_active and User.objects.filter(pk=target.pk).exists()


def test_unknown_action_is_a_404(admin, target, seeded):
    assert admin.post(action_url(target, "promote")).status_code == 404
