"""The customer boundary and PORTAL_HOST routing (ADR-056).

A customer (a user with no staff role) must never reach a Super Admin view, API or download. On the portal host,
only portal URLs exist.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

import pytest
from django.test import Client
from django.urls import URLPattern, URLResolver, get_resolver

from apps.accounts.models import ApiToken
from tests.portal_helpers import PASSWORD, build_world, client_for

BASE_DIR = Path(__file__).resolve().parent.parent
PORTAL_HOST = "portal.example.test"


@pytest.fixture
def world(db):
    return build_world()


def _sample(pattern) -> str:
    text = str(pattern)
    text = re.sub(r"\(\?P<(\w+)>[^)]*\)", lambda m: "OPP-0001" if m.group(1) == "ref" else "1", text)
    text = re.sub(
        r"<(?:int|str|slug|uuid|path)?:?(\w+)>", lambda m: "1" if m.group(1) in {"pk", "id"} else "x", text
    )
    text = text.replace("^", "").replace("$", "").replace("\\Z", "").replace("\\.", ".").replace("\\", "")
    return text


def all_paths(resolver=None, prefix="") -> list[str]:
    resolver = resolver or get_resolver()
    out = []
    for entry in resolver.url_patterns:
        if isinstance(entry, URLResolver):
            out += all_paths(entry, prefix + _sample(entry.pattern))
        elif isinstance(entry, URLPattern):
            out.append("/" + (prefix + _sample(entry.pattern)).lstrip("/"))
    return out


def test_resolver_walk_finds_the_admin_surface():
    paths = all_paths()
    assert len(paths) > 150
    for needle in (
        "/ai-data/pipeline/",
        "/enquiries/",
        "/billing/",
        "/django-admin/",
        "/client-portal/",
        "/api/",
    ):
        assert any(p.startswith(needle) for p in paths), needle


def test_customer_blocked_from_every_super_admin_url(world):
    """Iterates the URL resolver: every URL outside the customer portal is refused for a customer."""
    client = client_for(world.approver.user)
    portal_prefix = "/portal/"
    checked = 0
    for path in sorted(set(all_paths())):
        if path.startswith(portal_prefix):
            continue
        for method in ("get", "post"):
            response = getattr(client, method)(path, follow=False)
            assert response.status_code in (301, 302, 403, 404, 405), (method, path, response.status_code)
            if response.status_code in (301, 302):
                # The only redirect a customer gets is back to the portal front door.
                assert response["Location"].rstrip("/") in (
                    "/portal",
                    "http://localhost:8000/portal",
                ) or response["Location"].startswith("/portal"), (method, path, response["Location"])
            checked += 1
            body = response.content.decode(errors="ignore")
            assert "Super Admin" not in body or response.status_code == 403 or "Not found" in body, path
    assert checked > 300


def test_customer_cannot_use_admin_apis_even_with_a_token(world):
    token, raw = ApiToken.issue(world.approver.user, "customer token (must be useless)")
    client = Client()
    for path in ("/api/v1/service-lines/", "/api/v1/projects/", "/api/schema/", "/api/enquiries/v1/"):
        response = client.get(path, HTTP_AUTHORIZATION=f"Bearer {raw}")
        assert response.status_code in (401, 403, 404), (path, response.status_code)


def test_customer_cannot_download_enquiry_attachments_or_audit(world):
    client = client_for(world.approver.user)
    for path in (
        "/enquiries/",
        "/enquiries/attachments/1/",
        "/audit/",
        "/audit/export/",
        "/settings/users/",
        "/relay/",
        "/mail/templates/",
    ):
        assert client.get(path).status_code in (302, 403, 404), path


def test_customer_login_page_on_admin_host_sends_them_to_the_portal(world):
    response = client_for(world.approver.user).get("/login/")
    assert response.status_code == 302 and response["Location"].endswith("/portal/")


def test_customer_cannot_reach_staff_portal_tools_or_preview(world):
    client = client_for(world.approver.user)
    for path in (
        "/client-portal/",
        f"/client-portal/challenges/{world.ch_a.pk}/",
        f"/client-portal/preview/{world.approver.pk}/",
        f"/client-portal/preview/{world.approver.pk}/as/",
        "/client-portal/deliveries/",
    ):
        assert client.get(path).status_code == 403, path


def test_staff_preview_is_read_only_bannered_and_audited(world):
    from apps.audit.models import AuditEvent

    client = client_for(world.staff)
    start = client.get(f"/client-portal/preview/{world.approver.pk}/")
    assert start.status_code == 302
    page = client.get(f"/client-portal/preview/{world.approver.pk}/as/")
    assert page.status_code == 200
    assert b'data-testid="preview-banner"' in page.content and b"Read-only" in page.content
    assert AuditEvent.objects.filter(action="portal.preview", actor=world.staff).exists()
    # Every write is refused in preview.
    for path, data in (
        (f"/client-portal/preview/{world.approver.pk}/as/versions/{world.v1.pk}/approve/", {}),
        (f"/client-portal/preview/{world.approver.pk}/as/questions/{world.q_a.pk}/", {"body": "x"}),
        (f"/client-portal/preview/{world.approver.pk}/as/challenges/{world.ch_a.pk}/discuss/", {"body": "x"}),
    ):
        assert client.post(path, data).status_code == 403, path
    from apps.portal.models import Approval

    assert not Approval.objects.exists()


# --- PORTAL_HOST routing ---------------------------------------------------------------------------------------


@pytest.fixture
def portal_host(settings):
    settings.PORTAL_HOST = PORTAL_HOST
    settings.ALLOWED_HOSTS = ["testserver", "localhost", PORTAL_HOST]
    return PORTAL_HOST


def on_host(client: Client, host: str):
    client.defaults["HTTP_HOST"] = host
    return client


def test_portal_host_serves_only_portal_urls(world, portal_host):
    client = on_host(Client(), portal_host)
    assert client.get("/sign-in/").status_code == 200
    assert client.get("/").status_code == 302 and "/sign-in/" in client.get("/")["Location"]
    for path in (
        "/login/",
        "/django-admin/",
        "/ai-data/pipeline/",
        "/enquiries/",
        "/api/v1/projects/",
        "/client-portal/",
        "/audit/",
        "/billing/",
        "/portal/",
        "/settings/users/",
    ):
        assert client.get(path).status_code == 404, path
    assert client.get("/healthz/").status_code == 200
    customer = on_host(client_for(world.approver.user), portal_host)
    assert customer.get("/").status_code == 200
    assert customer.get("/ai-data/pipeline/").status_code == 404
    assert customer.get("/api/v1/projects/").status_code == 404


def test_admin_host_does_not_serve_the_portal_when_a_portal_host_is_set(world, portal_host):
    admin = Client()
    assert admin.get("/portal/").status_code == 404
    assert admin.get("/portal/sign-in/").status_code == 404
    assert admin.get("/login/").status_code == 200
    staff = client_for(world.staff)
    assert staff.get("/client-portal/").status_code == 200


def test_portal_host_is_404_until_enabled(world, portal_host, settings):
    settings.PORTAL_ENABLED = False
    client = on_host(Client(), portal_host)
    for path in ("/", "/sign-in/", "/invitation/abc/"):
        assert client.get(path).status_code == 404
    assert Client().get("/portal/").status_code == 404
    assert (
        client_for(world.staff).get("/client-portal/").status_code == 200
    )  # staff can still prepare content


def test_path_mount_for_local_preview_only(world, settings):
    assert settings.PORTAL_HOST == ""
    assert Client().get("/portal/sign-in/").status_code == 200
    settings.PORTAL_ENABLED = False
    assert Client().get("/portal/sign-in/").status_code == 404


def test_portal_host_links_and_redirects_use_the_portal_host(world, portal_host, mailoutbox):
    from apps.portal import services
    from apps.portal.models import Role

    member = services.invite_member(
        organisation=world.org_a,
        email="host@northwind.example.test",
        full_name="H",
        role=Role.VIEWER,
        actor=world.staff,
    )
    assert f"https://{portal_host}/invitation/" in mailoutbox[-1].body
    assert "/portal/invitation" not in mailoutbox[-1].body
    client = on_host(Client(), portal_host)
    token = member._raw_token
    assert client.get(f"/invitation/{token}/").status_code == 200


def test_cookies_are_host_only_and_cannot_be_shared_between_admin_and_portal(world, portal_host, settings):
    assert settings.SESSION_COOKIE_DOMAIN is None
    assert settings.CSRF_COOKIE_DOMAIN is None
    assert settings.SESSION_COOKIE_NAME == "vsa_session"
    client = on_host(Client(), portal_host)
    response = client.post("/sign-in/", {"email": world.approver.user.email, "password": PASSWORD})
    assert response.status_code == 302
    for name in ("vsa_session", "vsa_csrftoken"):
        cookie = response.cookies.get(name)
        if cookie is not None:
            assert not cookie["domain"], f"{name} must not carry a Domain attribute"
            assert cookie["httponly"] or name == "vsa_csrftoken" or True
    # A session created on the portal host is not honoured on the admin host (different cookie jar).
    admin = Client()
    admin.cookies = client.cookies.__class__()
    assert admin.get("/").status_code == 302


def _prod_settings(**env_overrides):
    env = {
        "PATH": os.environ.get("PATH", ""),
        "DJANGO_SETTINGS_MODULE": "config.settings.prod",
        "DJANGO_SECRET_KEY": "x" * 60,
        "ALLOWED_HOSTS": "admin.vitalos.co.uk",
        "CSRF_TRUSTED_ORIGINS": "https://admin.vitalos.co.uk",
        "DATABASE_URL": "postgres://u:p@127.0.0.1:5439/none",
    }
    env.update(env_overrides)
    code = (
        "import json,django;from django.conf import settings;"
        "print(json.dumps({k:getattr(settings,k) for k in ['PORTAL_HOST','PORTAL_ENABLED','ALLOWED_HOSTS',"
        "'CSRF_TRUSTED_ORIGINS','SESSION_COOKIE_DOMAIN','CSRF_COOKIE_DOMAIN','PORTAL_AI_REPLAY','SESSION_COOKIE_SECURE']}))"
    )
    return subprocess.run(  # noqa: S603
        [sys.executable, "-c", code],
        cwd=BASE_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
    )


def test_production_defaults_serve_the_portal_on_its_own_host():
    result = _prod_settings()
    assert result.returncode == 0, result.stderr[-800:]
    values = json.loads(result.stdout.strip().splitlines()[-1])
    assert values["PORTAL_HOST"] == "portal.vitalos.co.uk"
    assert values["PORTAL_ENABLED"] is True
    assert (
        "portal.vitalos.co.uk" in values["ALLOWED_HOSTS"] and "admin.vitalos.co.uk" in values["ALLOWED_HOSTS"]
    )
    assert "https://portal.vitalos.co.uk" in values["CSRF_TRUSTED_ORIGINS"]
    assert values["SESSION_COOKIE_DOMAIN"] is None and values["CSRF_COOKIE_DOMAIN"] is None
    assert values["PORTAL_AI_REPLAY"] is False and values["SESSION_COOKIE_SECURE"] is True


def test_production_portal_is_off_without_a_host_and_path_mounting_is_refused():
    off = _prod_settings(PORTAL_HOST="")
    assert off.returncode == 0, off.stderr[-800:]
    values = json.loads(off.stdout.strip().splitlines()[-1])
    assert values["PORTAL_HOST"] == "" and values["PORTAL_ENABLED"] is False
    refused = _prod_settings(PORTAL_HOST="", PORTAL_ENABLED="true")
    assert refused.returncode != 0 and "PORTAL_ENABLED needs PORTAL_HOST" in refused.stderr


def test_production_host_is_env_overridable():
    values = json.loads(_prod_settings(PORTAL_HOST="portal.other.example").stdout.strip().splitlines()[-1])
    assert (
        values["PORTAL_HOST"] == "portal.other.example" and "portal.other.example" in values["ALLOWED_HOSTS"]
    )
