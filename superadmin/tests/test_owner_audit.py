"""Primary owner, one-time set-password links, forgot-password and the append-only audit trail."""

import io
import re
from datetime import datetime, timedelta
from unittest import mock

import pytest
from django.core import mail
from django.core.exceptions import ValidationError
from django.core.management import CommandError, call_command
from django.test import Client

from apps.accounts import services
from apps.accounts.models import User
from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER, is_superadmin, role_label
from apps.accounts.tokens import set_password_token
from apps.audit.models import AppendOnlyError, AuditEvent
from apps.audit.services import record

from .conftest import random_password

OWNER = "admin@vitalos.co.uk"


def _owner():
    return User.objects.get(email=OWNER)


def _link_path(output: str) -> str:
    return re.search(r"https?://[^/]+(/account/set-password/\S+)", output).group(1)


# --- Owner seeding -----------------------------------------------------------------------------


def test_create_owner_is_idempotent_and_sets_no_password(db, superadmin):
    out = io.StringIO()
    call_command("create_owner", "--email", OWNER, stdout=out)
    call_command("create_owner", "--email", OWNER, stdout=out)
    assert User.objects.filter(email=OWNER).count() == 1
    owner = _owner()
    assert owner.is_primary_owner and owner.is_superuser and is_superadmin(owner)
    assert not owner.has_usable_password()
    assert "already the primary owner" in out.getvalue()
    # The existing SuperAdmin is kept, not removed or downgraded.
    superadmin.refresh_from_db()
    assert is_superadmin(superadmin) and superadmin.is_active and not superadmin.is_primary_owner
    assert AuditEvent.objects.filter(action="users.owner_set", entity_id=str(owner.pk)).count() == 1


def test_owner_reads_env_and_transfer_is_explicit(db, monkeypatch):
    monkeypatch.setenv("PRIMARY_OWNER_EMAIL", OWNER)
    call_command("create_owner", stdout=io.StringIO())
    with pytest.raises(CommandError, match="already the primary owner"):
        call_command("create_owner", "--email", "someone@vitalos.co.uk", stdout=io.StringIO())
    call_command("create_owner", "--email", "someone@vitalos.co.uk", "--transfer", stdout=io.StringIO())
    assert User.objects.get(is_primary_owner=True).email == "someone@vitalos.co.uk"
    assert not _owner().is_primary_owner


def test_only_one_primary_owner_at_database_level(db):
    services.ensure_primary_owner(OWNER)
    other = User.objects.create_user(email="x@example.test", password=random_password())
    other.is_primary_owner = True
    with pytest.raises(Exception):  # noqa: B017,PT011 - IntegrityError from the partial unique constraint
        other.save()


def test_role_label_names_the_owner(db):
    services.ensure_primary_owner(OWNER)
    assert role_label(_owner()) == "Owner · Super admin"


# --- Owner-only SuperAdmin grants ----------------------------------------------------------------


def test_only_the_owner_grants_or_revokes_superadmin(db, superadmin, make_user):
    services.ensure_primary_owner(OWNER)
    owner = _owner()
    target = make_user(VIEWER)
    with pytest.raises(ValidationError, match="Only the primary owner"):
        services.set_role(target, SUPERADMIN, superadmin)
    services.set_role(target, SUPERADMIN, owner)
    with pytest.raises(ValidationError, match="Only the primary owner"):
        services.set_role(target, VIEWER, superadmin)
    # Other role changes still work for any SuperAdmin.
    plain = make_user(VIEWER)
    assert services.set_role(plain, SERVICE_LEAD, superadmin)


def test_owner_cannot_be_demoted_or_deactivated(db, superadmin):
    services.ensure_primary_owner(OWNER)
    owner = _owner()
    owner.is_superuser = False  # Even without the superuser flag, the owner keeps SuperAdmin.
    owner.save()
    with pytest.raises(ValidationError, match="primary owner always keeps"):
        services.set_role(owner, VIEWER, superadmin)
    with pytest.raises(ValidationError, match="cannot be deactivated"):
        services.set_active(owner, False, superadmin)


def test_without_an_owner_superadmins_manage_roles_as_before(db, superadmin, make_user):
    target = make_user(VIEWER)
    assert services.set_role(target, SUPERADMIN, superadmin)


def test_role_changes_are_audited(client_for, superadmin, make_user):
    target = make_user(VIEWER)
    response = client_for(superadmin).post(
        f"/settings/users/{target.pk}/edit/", {"full_name": "", "role": SERVICE_LEAD, "is_active": "on"}
    )
    assert response.status_code in (200, 204, 302)
    event = AuditEvent.objects.get(action="users.role_changed", entity_id=str(target.pk), actor=superadmin)
    assert event.actor == superadmin and event.metadata == {"previous": [VIEWER], "role": SERVICE_LEAD}
    assert event.ip == "127.0.0.1"


# --- One-time set-password link ------------------------------------------------------------------


def test_setup_link_sets_a_password_once(db, client):
    services.ensure_primary_owner(OWNER)
    out = io.StringIO()
    call_command("issue_setup_link", "--email", OWNER, "--base-url", "https://admin.example.test", stdout=out)
    path = _link_path(out.getvalue())
    assert "expires in 30 minutes" in out.getvalue()
    assert AuditEvent.objects.filter(action="auth.setup_link_issued").count() == 1

    page = client.get(path)
    assert page.status_code == 200 and page["Cache-Control"] == "no-store"
    password = random_password()
    response = client.post(path, {"new_password1": password, "new_password2": password})
    assert response.status_code == 302 and response.url == "/login/"
    owner = _owner()
    assert owner.check_password(password)
    assert AuditEvent.objects.filter(action="auth.password_set", actor=owner).exists()
    # Single use: the same link is now refused.
    assert client.get(path).status_code == 400


def test_setup_link_expires_after_30_minutes(db, client):
    services.ensure_primary_owner(OWNER)
    owner = _owner()
    token = set_password_token.make_token(owner)
    assert set_password_token.check_token(owner, token)
    later = datetime.now() + timedelta(minutes=31)  # The generator uses naive local time.
    with mock.patch.object(type(set_password_token), "_now", return_value=later):
        assert not set_password_token.check_token(owner, token)


def test_setup_link_rejects_garbage(db, client):
    assert client.get("/account/set-password/zz/abc-def/").status_code == 400


def test_issue_setup_link_needs_an_active_account(db):
    with pytest.raises(CommandError):
        call_command("issue_setup_link", "--email", "nobody@example.test", stdout=io.StringIO())


# --- Forgot password -----------------------------------------------------------------------------


@pytest.fixture
def reset_on(settings):
    settings.PASSWORD_RESET_ENABLED = True
    settings.APP_BASE_URL = "https://admin.example.test"


def test_forgot_password_never_reveals_accounts(db, client, reset_on, viewer):
    known = client.post("/login/forgot/", {"email": viewer.email}, follow=True)
    unknown = client.post("/login/forgot/", {"email": "nobody@example.test"}, follow=True)
    assert known.status_code == unknown.status_code == 200
    assert b"If that address belongs to an account" in known.content
    assert b"If that address belongs to an account" in unknown.content
    assert len(mail.outbox) == 1 and mail.outbox[0].to == [viewer.email]
    assert "admin.example.test/account/set-password/" in mail.outbox[0].body


def test_forgot_password_is_rate_limited(db, client, reset_on, viewer):
    for _ in range(5):
        client.post("/login/forgot/", {"email": viewer.email})
    assert len(mail.outbox) == 3


def test_forgot_password_is_off_when_mail_cannot_be_delivered(db, client, settings):
    settings.PASSWORD_RESET_ENABLED = False
    assert client.get("/login/forgot/").status_code == 404
    assert b"Forgot your password" not in client.get("/login/").content


# --- Sign-in screen ------------------------------------------------------------------------------


def test_sign_in_does_not_prefill_the_owner_by_default(db, client):
    body = client.get("/login/").content.decode()
    assert OWNER not in body


def test_sign_in_prefill_and_remembered_email(db, settings, make_user):
    settings.DEFAULT_SIGNIN_EMAIL = OWNER
    assert f'value="{OWNER}"' in Client().get("/login/").content.decode()
    settings.DEFAULT_SIGNIN_EMAIL = ""
    password = random_password()
    user = make_user(VIEWER, email="remember@example.test")
    user.set_password(password)
    user.save()
    client = Client()
    response = client.post("/login/", {"email": user.email, "password": password})
    assert response.status_code == 302
    cookie = response.cookies["vsa_last_email"]
    assert cookie.value == user.email and cookie["httponly"]
    client.post("/logout/")
    assert 'value="remember@example.test"' in client.get("/login/").content.decode()


# --- Audit trail ---------------------------------------------------------------------------------


def test_sign_in_success_and_failure_are_audited(db, make_user):
    password = random_password()
    user = make_user(VIEWER, email="audited@example.test")
    user.set_password(password)
    user.save()
    client = Client()
    client.post("/login/", {"email": user.email, "password": "wrong-password-here"})
    client.post("/login/", {"email": user.email, "password": password})
    failed = AuditEvent.objects.get(action="auth.sign_in_failed")
    assert failed.metadata == {"attempted_email": user.email} and failed.actor is None
    assert "wrong-password" not in str(failed.metadata)
    assert AuditEvent.objects.filter(action="auth.sign_in", actor=user).exists()


def test_user_menu_shows_previous_sign_in(client_for, superadmin, seeded):
    record("auth.sign_in", actor=superadmin, summary="Signed in")
    AuditEvent.objects.create(
        actor=superadmin, actor_email=superadmin.email, action="auth.sign_in", ip="203.0.113.7"
    )
    body = client_for(superadmin).get("/").content.decode()
    assert "from 203.0.113.7" in body


def test_audit_events_are_append_only(db, superadmin):
    event = record("users.created", actor=superadmin, summary="x")
    event.summary = "changed"
    with pytest.raises(AppendOnlyError):
        event.save()
    with pytest.raises(AppendOnlyError):
        event.delete()
    with pytest.raises(AppendOnlyError):
        AuditEvent.objects.all().delete()
    with pytest.raises(AppendOnlyError):
        AuditEvent.objects.update(summary="y")


def test_mfa_enrolment_is_audited(client_for, make_user):
    from django_otp.oath import totp
    from django_otp.plugins.otp_totp.models import TOTPDevice

    user = make_user(SUPERADMIN, email="enrol@example.test")
    client = client_for(user, verified=False)
    client.get("/account/2fa/setup/")
    device = TOTPDevice.objects.get(user=user, confirmed=False)
    client.post("/account/2fa/setup/", {"token": str(totp(device.bin_key)).zfill(6)})
    assert AuditEvent.objects.filter(action="auth.mfa_enrolled", actor=user).exists()
