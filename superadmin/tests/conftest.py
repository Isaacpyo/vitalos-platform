import io
import secrets

import pytest
from django.core.management import call_command
from django.test import Client
from django_otp import DEVICE_ID_SESSION_KEY
from django_otp.plugins.otp_totp.models import TOTPDevice

from apps.accounts.models import User
from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, VIEWER
from apps.accounts.services import set_role
from apps.architecture.models import ServiceLine, TeamMember
from tests.billing_helpers import fake_stripe  # noqa: F401 - billing's local fake Stripe server fixture


def random_password() -> str:
    return secrets.token_urlsafe(16)


@pytest.fixture
def seeded(db):
    call_command("seed_architecture", stdout=io.StringIO())
    return {line.slug: line for line in ServiceLine.objects.all()}


@pytest.fixture
def make_user(db):
    def _make(role=None, email=None, **extra):
        user = User.objects.create_user(
            email=email or f"{secrets.token_hex(4)}@example.test", password=random_password(), **extra
        )
        if role:
            set_role(user, role, actor=None)
        return user

    return _make


@pytest.fixture
def superadmin(make_user):
    return make_user(SUPERADMIN, email="admin@example.test")


@pytest.fixture
def viewer(make_user):
    return make_user(VIEWER, email="viewer@example.test")


@pytest.fixture
def lead(make_user, seeded):
    """A ServiceLead who owns Consulting and nothing else."""
    user = make_user(SERVICE_LEAD, email="lead@example.test")
    line = seeded["consulting"]
    line.owner = user
    line.save()
    return user


@pytest.fixture
def team_lead(make_user, seeded):
    """A ServiceLead with access to Engineering through team membership."""
    user = make_user(SERVICE_LEAD, email="member@example.test")
    member = TeamMember.objects.create(name="Engineering Lead", user=user, email=user.email)
    member.service_lines.add(seeded["engineering"])
    return user


@pytest.fixture
def norole(make_user):
    return make_user(None, email="norole@example.test")


def login(client: Client, user, verified: bool = True) -> Client:
    client.force_login(user)
    if verified:
        device, _ = TOTPDevice.objects.get_or_create(user=user, name="test", defaults={"confirmed": True})
        session = client.session
        session[DEVICE_ID_SESSION_KEY] = device.persistent_id
        session.save()
    return client


@pytest.fixture
def client_for(db):
    def _client(user, verified: bool = True) -> Client:
        return login(Client(), user, verified)

    return _client


@pytest.fixture(autouse=True)
def no_real_push_service(monkeypatch):
    """Safety net: no test may POST a push to a real push service. Only a fake server on this machine is
    reachable through the real transport; a test that fakes the transport itself replaces this guard."""
    from urllib.parse import urlsplit

    from apps.portal import push

    real = push._send_http
    refused: list[str] = []

    def guarded(endpoint, body, headers, timeout):
        host = urlsplit(endpoint).hostname or ""
        if host not in ("127.0.0.1", "localhost", "::1"):
            refused.append(host)
            raise OSError("tests never send pushes off this machine")
        return real(endpoint, body, headers, timeout)

    monkeypatch.setattr(push, "_send_http", guarded)
    yield
    assert not refused, f"a test tried to send a push to {refused}"


HX = {"HTTP_HX_REQUEST": "true"}

RELAY_WEBHOOK_SECRET = "test-relay-webhook-secret-0123456789"


@pytest.fixture
def relay(settings):
    """Relay switched on against the in-memory fake website API, with fresh sample data and caches."""
    from django.core.cache import cache

    from apps.relay.fake import STATE

    settings.RELAY_CLIENT = "fake"
    settings.RELAY_API_BASE_URL = "https://www.example.com"
    settings.RELAY_ADMIN_API_SECRET = "test-relay-admin-secret-0123456789"
    settings.RELAY_WEBHOOK_SECRET = RELAY_WEBHOOK_SECRET
    cache.clear()
    STATE.reset()
    yield STATE
    cache.clear()
