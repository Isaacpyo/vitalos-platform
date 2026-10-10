import io
import secrets

import pytest
from django.core.management import CommandError, call_command

from apps.accounts.models import User
from apps.accounts.roles import SUPERADMIN, is_superadmin
from apps.architecture.models import Company, ServiceLine


def run(*args, **kwargs):
    out = io.StringIO()
    call_command(*args, stdout=out, **kwargs)
    return out.getvalue()


@pytest.mark.django_db
def test_seed_is_idempotent_and_preserves_edits():
    run("seed_architecture")
    first = list(ServiceLine.objects.values_list("pk", "slug", "order"))
    line = ServiceLine.objects.get(slug="labs")
    line.tagline = "Edited in the app"
    line.save()
    company = Company.load()
    company.mission = "Edited mission"
    company.save()
    output = run("seed_architecture")
    assert "0 service line(s) created" in output
    assert list(ServiceLine.objects.values_list("pk", "slug", "order")) == first
    assert ServiceLine.objects.get(slug="labs").tagline == "Edited in the app"
    assert Company.load().mission == "Edited mission"
    assert Company.objects.count() == 1 and ServiceLine.objects.count() == 6


@pytest.mark.django_db
def test_seed_restores_a_missing_line_without_duplicates():
    run("seed_architecture")
    ServiceLine.objects.filter(slug="labs").delete()
    run("seed_architecture")
    assert ServiceLine.objects.filter(slug="labs").count() == 1


@pytest.mark.django_db
def test_create_superadmin_reads_password_from_env(monkeypatch):
    password = secrets.token_urlsafe(16)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", password)
    output = run("create_superadmin", "--email", "Founder@Example.test")
    assert password not in output
    user = User.objects.get(email="founder@example.test")
    assert user.is_superuser and user.is_staff and user.check_password(password)
    assert user.groups.filter(name=SUPERADMIN).exists() and is_superadmin(user)


@pytest.mark.django_db
def test_create_superadmin_is_idempotent_and_only_resets_on_request(monkeypatch):
    first, second = secrets.token_urlsafe(16), secrets.token_urlsafe(16)
    monkeypatch.setenv("BOOTSTRAP_ADMIN_EMAIL", "founder@example.test")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", first)
    run("create_superadmin")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", second)
    assert "Confirmed" in run("create_superadmin")
    assert User.objects.get().check_password(first)
    assert "Updated password" in run("create_superadmin", "--password")
    assert User.objects.get().check_password(second)
    assert User.objects.count() == 1


@pytest.mark.django_db
def test_create_superadmin_requires_env_password_and_strength(monkeypatch):
    monkeypatch.delenv("BOOTSTRAP_ADMIN_PASSWORD", raising=False)
    with pytest.raises(CommandError, match="BOOTSTRAP_ADMIN_PASSWORD"):
        run("create_superadmin", "--email", "a@example.test")
    monkeypatch.setenv("BOOTSTRAP_ADMIN_PASSWORD", "short")
    with pytest.raises(CommandError, match="rejected"):
        run("create_superadmin", "--email", "a@example.test")
    assert not User.objects.exists()


def test_create_superadmin_does_not_accept_a_password_value():
    with pytest.raises(CommandError):
        call_command("create_superadmin", "--email", "a@example.test", "--password", "hunter2hunter2")
