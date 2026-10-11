"""Every page and HTMX partial renders for the roles that may see it."""

from decimal import Decimal

import pytest

from apps.architecture import services
from apps.architecture.models import KPI, Decision, Offer, Practice, Project, Solution, TeamMember

from .conftest import HX

SLUGS = ["consulting", "engineering", "ai-data", "experience", "managed-services", "labs"]
TABS = ["overview", "structure", "team", "projects", "kpis"]


@pytest.fixture
def populated(seeded, superadmin):
    line = seeded["consulting"]
    practice = services.save_record(Practice(service_line=line, name="Cloud"), superadmin)
    solution = services.save_record(Solution(practice=practice, name="Landing zones"), superadmin)
    offer = services.save_record(Offer(solution=solution, name="Landing zone accelerator"), superadmin)
    member = services.save_record(TeamMember(name="Sam Example", email="sam@example.test"), superadmin)
    member.service_lines.add(line)
    project = services.save_record(
        Project(service_line=line, name="Cloud foundation", lead=member, value=Decimal("125000")), superadmin
    )
    kpi = services.save_record(
        KPI(service_line=line, name="Utilisation", unit="%", target=Decimal("75"), is_headline=True),
        superadmin,
    )
    from datetime import date

    for month, value in [(7, "70"), (8, "78"), (9, "72")]:
        services.record_kpi_value(kpi, date(2026, month, 30), Decimal(value), superadmin)
    decision = services.save_record(
        Decision(service_line=line, title="Adopt landing zones", date=date(2026, 9, 1)), superadmin
    )
    return {
        "practice": practice,
        "solution": solution,
        "offer": offer,
        "member": member,
        "project": project,
        "kpi": kpi,
        "decision": decision,
    }


def page_urls(objects):
    urls = [
        "/",
        "/architecture/",
        "/architecture/?archived=1",
        "/team/",
        "/activity/",
        "/activity/?service_line=consulting&model=practice",
        "/search/",
        "/search/?q=cloud",
        "/settings/company/",
        "/settings/users/",
        "/settings/users/new/",
        "/settings/tokens/",
        "/settings/data/",
        "/notifications/",
        "/account/",
        "/api/docs/",
        "/api/schema/",
        "/django-admin/",
    ]
    urls += [f"/s/{slug}/?tab={tab}" for slug in SLUGS for tab in TABS]
    urls += [f"/s/consulting/?tab={tab}&archived=1" for tab in TABS[1:]]
    urls += [
        f"/settings/data/export/{key}.csv"
        for key in ("practices", "solutions", "offers", "projects", "kpi_values", "team_members")
    ]
    urls += [
        "/e/serviceline/new/",
        "/e/practice/new/?service_line=consulting",
        f"/e/solution/new/?practice={objects['practice'].pk}",
        f"/e/offer/new/?solution={objects['solution'].pk}",
        "/e/teammember/new/?service_line=consulting",
        "/e/project/new/?service_line=consulting",
        "/e/kpi/new/?service_line=consulting",
        f"/e/kpivalue/new/?kpi={objects['kpi'].pk}",
        "/e/decision/new/?service_line=consulting",
        "/e/decision/new/",
    ]
    for kind in ("practice", "solution", "offer", "project", "kpi", "decision"):
        urls.append(f"/e/{kind}/{objects[kind].pk}/edit/")
    urls.append(f"/e/teammember/{objects['member'].pk}/edit/")
    return urls


@pytest.mark.django_db
def test_every_page_renders_for_superadmin(populated, make_user, client_for):
    admin = make_user("SuperAdmin", is_superuser=True, is_staff=True)
    client = client_for(admin)
    for url in page_urls(populated):
        response = client.get(url)
        assert response.status_code == 200, f"{url} -> {response.status_code}"
    for model in ("practice", "project", "kpi"):
        obj = populated[model]
        url = f"/django-admin/architecture/{model}/{obj.pk}/history/"
        assert client.get(url).status_code == 200, url


@pytest.mark.django_db
def test_htmx_partials_render(populated, superadmin, client_for):
    client = client_for(superadmin)
    for tab in TABS:
        response = client.get(f"/s/consulting/?tab={tab}", HTTP_HX_TARGET="tab-region", **HX)
        assert response.status_code == 200
        body = response.content.decode()
        assert body.lstrip().startswith('<section id="tab-region"') and "<html" not in body
    dropdown = client.get("/search/?q=clo", HTTP_HX_TARGET="search-results", **HX)
    assert (
        dropdown.status_code == 200
        and "Cloud" in dropdown.content.decode()
        and "<html" not in dropdown.content.decode()
    )
    feed = client.get("/activity/?service_line=consulting", HTTP_HX_TARGET="activity-list", **HX)
    assert feed.status_code == 200 and "activity-list" in feed.content.decode()
    tree = client.get("/architecture/", HTTP_HX_TARGET="architecture-region", **HX)
    assert tree.status_code == 200 and "<html" not in tree.content.decode()
    modal = client.get("/e/practice/new/?service_line=consulting", **HX)
    assert 'role="dialog"' in modal.content.decode() and "<html" not in modal.content.decode()
    badge = client.get("/notifications/badge/", **HX)
    assert badge.status_code == 200 and 'data-testid="bell"' in badge.content.decode()


@pytest.mark.django_db
def test_homepage_cards_show_counts_and_headline_kpi(populated, superadmin, client_for):
    project = populated["project"]
    services.change_project_status(project, "active", superadmin)
    body = client_for(superadmin).get("/").content.decode()
    assert body.count('data-testid="service-line-card"') == 6
    assert "From strategy to production." in body
    assert "Utilisation" in body and "72" in body


@pytest.mark.django_db
def test_viewer_pages_render(populated, viewer, client_for):
    client = client_for(viewer, verified=False)
    for url in [
        "/",
        "/architecture/",
        "/team/",
        "/activity/",
        "/search/?q=cloud",
        "/settings/tokens/",
        "/settings/data/",
        "/notifications/",
        "/account/",
    ] + [f"/s/consulting/?tab={tab}" for tab in TABS]:
        assert client.get(url).status_code == 200, url


@pytest.mark.django_db
def test_login_page_renders_for_anonymous(client):
    response = client.get("/login/")
    assert response.status_code == 200
    assert b"Sign in" in response.content


@pytest.mark.django_db
def test_error_pages(seeded, superadmin, client_for):
    assert client_for(superadmin).get("/s/does-not-exist/").status_code == 404
    assert client_for(superadmin).get("/nope/").status_code == 404
