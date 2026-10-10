from decimal import Decimal

import pytest
from django.test import Client

from apps.accounts.roles import accessible_service_line_ids, has_service_access, is_superadmin
from apps.architecture import services
from apps.architecture.models import KPI, Practice, Project, ServiceLine
from apps.core.models import Classification

from .conftest import HX


@pytest.mark.django_db
def test_has_service_access_matrix(seeded, superadmin, lead, team_lead, viewer, norole):
    consulting, engineering = seeded["consulting"], seeded["engineering"]
    assert has_service_access(superadmin, consulting) and has_service_access(superadmin, engineering)
    assert has_service_access(lead, consulting) and not has_service_access(lead, engineering)
    assert has_service_access(team_lead, engineering) and not has_service_access(team_lead, consulting)
    assert not has_service_access(viewer, consulting)
    assert not has_service_access(norole, consulting)
    assert not has_service_access(lead, None)  # company-wide records are SuperAdmin-only
    assert accessible_service_line_ids(superadmin) is None
    assert accessible_service_line_ids(viewer) == set()


@pytest.mark.django_db
def test_django_superuser_counts_as_superadmin(make_user):
    user = make_user(None, is_superuser=True, is_staff=True)
    assert is_superadmin(user)


@pytest.mark.django_db
def test_anonymous_users_are_sent_to_login(seeded):
    client = Client()
    for url in ["/", "/s/consulting/", "/architecture/", "/settings/tokens/", "/activity/", "/search/?q=x"]:
        response = client.get(url)
        assert response.status_code == 302 and response.url.startswith("/login/"), url


@pytest.mark.django_db
def test_users_without_a_role_get_403(seeded, norole, client_for):
    client = client_for(norole, verified=False)
    for url in ["/", "/s/consulting/", "/architecture/", "/settings/tokens/"]:
        assert client.get(url).status_code == 403, url


SUPERADMIN_ONLY_PAGES = ["/settings/company/", "/settings/users/", "/settings/users/new/"]


@pytest.mark.django_db
@pytest.mark.parametrize("url", SUPERADMIN_ONLY_PAGES)
def test_superadmin_only_pages(url, seeded, superadmin, lead, viewer, client_for):
    assert client_for(superadmin).get(url).status_code == 200
    assert client_for(lead, verified=False).get(url).status_code == 403
    assert client_for(viewer, verified=False).get(url).status_code == 403


@pytest.mark.django_db
@pytest.mark.parametrize(
    "url", ["/", "/s/consulting/", "/architecture/", "/settings/tokens/", "/settings/data/"]
)
def test_every_role_can_read(url, seeded, superadmin, lead, viewer, client_for):
    for user, verified in ((superadmin, True), (lead, False), (viewer, False)):
        assert client_for(user, verified=verified).get(url).status_code == 200, (url, user)


def _create_practice(client, slug="consulting", name="New practice"):
    return client.post(
        f"/e/practice/new/?service_line={slug}",
        {"name": name, "status": "draft", "maturity": "emerging", "order": 1, "classification": "internal"},
        **HX,
    )


@pytest.mark.django_db
def test_create_practice_permissions(seeded, superadmin, lead, team_lead, viewer, client_for):
    assert _create_practice(client_for(superadmin), name="By admin").status_code == 204
    assert _create_practice(client_for(lead, verified=False), name="By lead").status_code == 204
    assert _create_practice(client_for(lead, verified=False), slug="engineering").status_code == 403
    assert _create_practice(client_for(team_lead, verified=False), slug="engineering").status_code == 204
    assert _create_practice(client_for(viewer, verified=False), name="By viewer").status_code == 403
    assert set(Practice.objects.values_list("name", flat=True)) == {"By admin", "By lead", "New practice"}


@pytest.mark.django_db
def test_lead_cannot_move_a_solution_into_another_line(seeded, superadmin, lead, client_for):
    own = services.save_record(Practice(service_line=seeded["consulting"], name="Own"), superadmin)
    other = services.save_record(Practice(service_line=seeded["engineering"], name="Other"), superadmin)
    client = client_for(lead, verified=False)
    response = client.post(
        f"/e/solution/new/?practice={own.pk}",
        {
            "practice": other.pk,
            "name": "Sneaky",
            "status": "draft",
            "maturity": "emerging",
            "order": 1,
            "classification": "internal",
        },
        **HX,
    )
    # The form only offers practices from the lead's own line, so the foreign practice is rejected.
    assert response.status_code == 200
    assert b"Select a valid choice" in response.content


@pytest.mark.django_db
def test_archive_restore_permissions(seeded, superadmin, lead, viewer, client_for):
    practice = services.save_record(Practice(service_line=seeded["consulting"], name="Target"), superadmin)
    assert (
        client_for(viewer, verified=False).post(f"/e/practice/{practice.pk}/archive/", **HX).status_code
        == 403
    )
    assert (
        client_for(lead, verified=False).post(f"/e/practice/{practice.pk}/archive/", **HX).status_code == 204
    )
    practice.refresh_from_db()
    assert practice.is_archived
    assert (
        client_for(viewer, verified=False).post(f"/e/practice/{practice.pk}/restore/", **HX).status_code
        == 403
    )
    assert client_for(superadmin).post(f"/e/practice/{practice.pk}/restore/", **HX).status_code == 204


@pytest.mark.django_db
def test_there_is_no_delete_endpoint_in_the_app(seeded, superadmin, client_for):
    practice = services.save_record(Practice(service_line=seeded["consulting"], name="Keep"), superadmin)
    assert client_for(superadmin).post(f"/e/practice/{practice.pk}/delete/").status_code == 404
    assert Practice.objects.filter(pk=practice.pk).exists()


@pytest.mark.django_db
def test_service_line_management_is_superadmin_only(seeded, superadmin, lead, client_for):
    line = seeded["labs"]
    lead_client = client_for(lead, verified=False)
    assert lead_client.post(f"/architecture/service-lines/{line.pk}/move/up/", **HX).status_code == 403
    assert (
        lead_client.post(f"/architecture/service-lines/{line.pk}/active/", {"active": "0"}, **HX).status_code
        == 403
    )
    assert lead_client.get(f"/e/serviceline/{seeded['consulting'].pk}/edit/").status_code == 403
    admin_client = client_for(superadmin)
    assert (
        admin_client.post(f"/architecture/service-lines/{line.pk}/active/", {"active": "0"}, **HX).status_code
        == 204
    )
    line.refresh_from_db()
    assert line.is_active is False
    assert admin_client.post(f"/architecture/service-lines/{line.pk}/move/up/", **HX).status_code == 204


@pytest.mark.django_db
def test_team_membership_is_superadmin_only(seeded, superadmin, lead, client_for):
    data = {
        "name": "Alex Example",
        "role_title": "Consultant",
        "email": "alex@example.test",
        "service_lines": [seeded["consulting"].pk],
        "classification": "internal",
    }
    assert client_for(lead, verified=False).post("/e/teammember/new/", data, **HX).status_code == 403
    assert client_for(superadmin).post("/e/teammember/new/", data, **HX).status_code == 204


@pytest.mark.django_db
def test_project_status_inline_edit_permissions(seeded, superadmin, lead, viewer, client_for):
    project = services.save_record(Project(service_line=seeded["consulting"], name="Discovery"), superadmin)
    assert (
        client_for(viewer, verified=False)
        .post(f"/projects/{project.pk}/status/", {"status": "active"}, **HX)
        .status_code
        == 403
    )
    assert (
        client_for(lead, verified=False)
        .post(f"/projects/{project.pk}/status/", {"status": "active"}, **HX)
        .status_code
        == 204
    )
    project.refresh_from_db()
    assert project.status == "active"


@pytest.mark.django_db
def test_csv_import_is_superadmin_only(seeded, viewer, lead, client_for):
    from django.core.files.uploadedfile import SimpleUploadedFile

    for user in (viewer, lead):
        upload = SimpleUploadedFile("p.csv", b"service_line,slug,name\n", content_type="text/csv")
        response = client_for(user, verified=False).post(
            "/settings/data/", {"resource": "practices", "file": upload, "dry_run": "on"}
        )
        assert response.status_code == 403


@pytest.mark.django_db
def test_classification_gates_visibility(seeded, superadmin, lead, viewer, client_for):
    line = seeded["consulting"]
    services.save_record(Project(service_line=line, name="Confidential deal"), superadmin)
    services.save_record(
        Project(service_line=line, name="Open project", classification=Classification.INTERNAL), superadmin
    )
    services.save_record(
        Project(service_line=line, name="Restricted bid", classification=Classification.RESTRICTED),
        superadmin,
    )
    url = "/s/consulting/?tab=projects"
    viewer_page = client_for(viewer, verified=False).get(url).content.decode()
    lead_page = client_for(lead, verified=False).get(url).content.decode()
    admin_page = client_for(superadmin).get(url).content.decode()
    assert "Open project" in viewer_page and "Confidential deal" not in viewer_page
    assert "Confidential deal" in lead_page and "Restricted bid" not in lead_page
    assert "Restricted bid" in admin_page


@pytest.mark.django_db
def test_superadmin_must_complete_totp(seeded, superadmin):
    client = Client()
    client.force_login(superadmin)
    response = client.get("/")
    assert response.status_code == 302 and response.url.startswith("/account/2fa/setup/")
    htmx = client.get("/notifications/badge/", **HX)
    assert htmx.status_code == 204 and htmx["HX-Redirect"].startswith("/account/2fa/setup/")


@pytest.mark.django_db
def test_django_admin_requires_verified_superuser(seeded, superadmin, make_user, client_for):
    superuser = make_user(None, is_superuser=True, is_staff=True)
    assert client_for(superuser).get("/django-admin/").status_code == 200
    # SuperAdmin role without the Django superuser flag cannot use the admin.
    response = client_for(superadmin).get("/django-admin/", follow=True)
    assert response.status_code == 403
    staff = make_user(None, is_staff=True)
    assert client_for(staff).get("/django-admin/", follow=True).status_code == 403
    anonymous = Client().get("/django-admin/", follow=True)
    assert anonymous.redirect_chain[-1][0].startswith("/login/")


@pytest.mark.django_db
def test_kpi_value_create_by_wrong_lead_is_forbidden(seeded, superadmin, lead, client_for):
    kpi = services.save_record(
        KPI(service_line=seeded["engineering"], name="Velocity", target=Decimal("10")), superadmin
    )
    response = client_for(lead, verified=False).post(
        f"/e/kpivalue/new/?kpi={kpi.pk}", {"date": "2026-10-01", "value": "5"}, **HX
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_hidden_service_line_dashboard_404_for_viewer(seeded, superadmin, viewer, client_for):
    secret = services.save_record(
        ServiceLine(name="Stealth", slug="stealth", classification=Classification.RESTRICTED), superadmin
    )
    assert client_for(viewer, verified=False).get(f"/s/{secret.slug}/").status_code == 404
    assert client_for(superadmin).get(f"/s/{secret.slug}/").status_code == 200
