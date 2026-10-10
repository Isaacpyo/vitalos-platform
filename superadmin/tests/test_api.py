from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.accounts.models import ApiToken
from apps.architecture import services
from apps.architecture.models import Practice, Project
from apps.core.models import Classification


def bearer(raw):
    return {"HTTP_AUTHORIZATION": f"Bearer {raw}"}


@pytest.fixture
def api_data(seeded, superadmin):
    line = seeded["consulting"]
    services.save_record(Practice(service_line=line, name="Cloud"), superadmin)
    services.save_record(Project(service_line=line, name="Secret deal"), superadmin)
    services.save_record(
        Project(service_line=line, name="Open work", classification=Classification.INTERNAL), superadmin
    )
    archived = services.save_record(Practice(service_line=line, name="Old"), superadmin)
    services.archive(archived, superadmin)
    return line


@pytest.mark.django_db
def test_api_requires_authentication(api_data):
    client = Client()
    for url in ["/api/v1/service-lines/", "/api/v1/company/", "/api/v1/projects/"]:
        assert client.get(url).status_code in (401, 403), url
    assert client.get("/api/v1/service-lines/", **bearer("vsa_nope")).status_code == 401
    assert client.get("/api/schema/").status_code in (401, 403)


@pytest.mark.django_db
def test_token_grants_read_access(api_data, viewer):
    token, raw = ApiToken.issue(viewer, "Reporting")
    assert token.key_hash != raw and raw.startswith("vsa_") and token.prefix in raw
    client = Client()
    response = client.get("/api/v1/service-lines/", **bearer(raw))
    assert response.status_code == 200
    assert [row["slug"] for row in response.json()["results"]][:2] == ["consulting", "engineering"]
    assert (
        client.get("/api/v1/service-lines/consulting/", **bearer(raw)).json()["name"] == "Vitalos Consulting"
    )
    assert client.get("/api/v1/company/", **bearer(raw)).json()["tagline"] == "From strategy to production."
    assert client.get("/api/v1/practices/", HTTP_AUTHORIZATION=f"Token {raw}").status_code == 200
    token.refresh_from_db()
    assert token.last_used_at is not None


@pytest.mark.django_db
def test_api_is_read_only(api_data, superadmin):
    _, raw = ApiToken.issue(superadmin, "Admin")
    client = Client()
    assert (
        client.post(
            "/api/v1/practices/", {"name": "x"}, content_type="application/json", **bearer(raw)
        ).status_code
        == 403
    )
    practice = Practice.objects.first()
    assert client.delete(f"/api/v1/practices/{practice.pk}/", **bearer(raw)).status_code == 403
    assert Practice.objects.filter(pk=practice.pk).exists()


@pytest.mark.django_db
def test_revoked_and_expired_tokens_fail(api_data, viewer):
    revoked, raw_revoked = ApiToken.issue(viewer, "Revoked")
    revoked.revoked_at = timezone.now()
    revoked.save()
    _, raw_expired = ApiToken.issue(viewer, "Expired", expires_at=timezone.now() - timedelta(days=1))
    client = Client()
    assert client.get("/api/v1/practices/", **bearer(raw_revoked)).status_code == 401
    assert client.get("/api/v1/practices/", **bearer(raw_expired)).status_code == 401
    viewer.is_active = False
    viewer.save()
    _, raw = ApiToken.issue(viewer, "Inactive user")
    assert client.get("/api/v1/practices/", **bearer(raw)).status_code == 401


@pytest.mark.django_db
def test_token_without_role_is_forbidden(api_data, norole):
    _, raw = ApiToken.issue(norole, "No role")
    assert Client().get("/api/v1/practices/", **bearer(raw)).status_code == 403


@pytest.mark.django_db
def test_api_respects_classification_and_archive(api_data, viewer, superadmin):
    _, viewer_raw = ApiToken.issue(viewer, "Viewer")
    _, admin_raw = ApiToken.issue(superadmin, "Admin")
    client = Client()
    viewer_projects = [
        p["name"] for p in client.get("/api/v1/projects/", **bearer(viewer_raw)).json()["results"]
    ]
    admin_projects = [
        p["name"] for p in client.get("/api/v1/projects/", **bearer(admin_raw)).json()["results"]
    ]
    assert viewer_projects == ["Open work"]
    assert set(admin_projects) == {"Open work", "Secret deal"}
    practices = client.get("/api/v1/practices/", **bearer(admin_raw)).json()["results"]
    assert [p["name"] for p in practices] == ["Cloud"]
    with_archived = client.get("/api/v1/practices/?include_archived=true", **bearer(admin_raw)).json()[
        "results"
    ]
    assert {p["name"] for p in with_archived} == {"Cloud", "Old"}


@pytest.mark.django_db
def test_schema_and_docs(api_data, viewer, superadmin, client_for):
    _, raw = ApiToken.issue(viewer, "Docs")
    schema = Client().get("/api/schema/", **bearer(raw))
    assert schema.status_code == 200 and b"/api/v1/service-lines/" in schema.content
    docs = client_for(superadmin).get("/api/docs/")
    assert docs.status_code == 200 and b"swagger" in docs.content.lower()


@pytest.mark.django_db
def test_token_settings_page_shows_secret_once(seeded, viewer, make_user, client_for):
    client = client_for(viewer, verified=False)
    response = client.post("/settings/tokens/", {"name": "BI", "expires_in_days": 30})
    assert response.status_code == 200
    token = ApiToken.objects.get(user=viewer)
    body = response.content.decode()
    assert "Copy your new token now" in body and token.prefix in body
    assert "Copy your new token now" not in client.get("/settings/tokens/").content.decode()
    other, _ = ApiToken.issue(make_user("Viewer"), "Other")
    assert client.post(f"/settings/tokens/{other.pk}/revoke/").status_code == 403
    assert client.post(f"/settings/tokens/{token.pk}/revoke/").status_code == 302
    token.refresh_from_db()
    assert token.revoked_at is not None
