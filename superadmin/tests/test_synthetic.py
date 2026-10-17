"""Smoke-test records and their activity are hidden from user-facing listings (display only)."""

from datetime import date
from decimal import Decimal

import pytest

from apps.architecture import activity, search, selectors, services
from apps.architecture.models import KPI, Offer, Practice, Project, Solution
from apps.audit.models import AuditEvent
from apps.audit.services import record
from apps.core.synthetic import has_synthetic_text, is_synthetic_name
from apps.notifications.models import Notification

from .conftest import HX

STAMP = "20261012-085800"
REAL = "Smoke testing strategy"


def test_name_matching_is_precise():
    assert is_synthetic_name(f"Smoke test practice {STAMP}")
    assert is_synthetic_name(f"Smoke test KPI {STAMP}")
    assert not is_synthetic_name(REAL)
    assert not is_synthetic_name("Smoke test practice")
    assert not is_synthetic_name(f"Our Smoke test practice {STAMP}")
    assert not is_synthetic_name(f"Smoke test practice {STAMP} v2")
    assert has_synthetic_text(f"Smoke test project {STAMP}: Pipeline → Active")
    assert not has_synthetic_text(REAL)


@pytest.fixture
def data(seeded, superadmin):
    line = seeded["consulting"]
    save = services.save_record
    practice = save(Practice(service_line=line, name=f"Smoke test practice {STAMP}"), superadmin)
    solution = save(Solution(practice=practice, name=f"Smoke test solution {STAMP}"), superadmin)
    save(Offer(solution=solution, name=f"Smoke test offer {STAMP}"), superadmin)
    project = save(
        Project(service_line=line, name=f"Smoke test project {STAMP}", client="Synthetic smoke test"),
        superadmin,
    )
    services.change_project_status(project, "active", superadmin)
    kpi = save(KPI(service_line=line, name=f"Smoke test KPI {STAMP}", target=Decimal("10")), superadmin)
    services.record_kpi_value(kpi, date(2026, 10, 1), Decimal("40"), superadmin)
    # Any project filed under the synthetic client is synthetic, whatever its name.
    save(Project(service_line=line, name="Odd name", client="Synthetic smoke test"), superadmin)
    real = save(Practice(service_line=line, name=REAL), superadmin)
    for obj in (project, kpi, practice):
        services.archive(obj, superadmin)
    return real


@pytest.mark.django_db
def test_activity_feed_hides_synthetic_but_keeps_real(data, superadmin):
    entries = activity.feed(superadmin, limit=200)
    labels = {e.object_label for e in entries}
    assert REAL in labels
    assert not any(STAMP in label or label == "Odd name" for label in labels)
    assert not any(e.model_key == "kpivalue" for e in entries)
    # Display only: nothing was deleted.
    assert Practice.objects.filter(name=f"Smoke test practice {STAMP}").exists()


@pytest.mark.django_db
def test_pages_hide_synthetic(data, superadmin, client_for):
    client = client_for(superadmin)
    urls = (
        "/",
        "/activity/",
        "/s/consulting/",
        "/s/consulting/?tab=structure&archived=1",
        "/s/consulting/?tab=projects&archived=1",
        "/s/consulting/?tab=kpis&archived=1",
        "/architecture/?archived=1",
    )
    for url in urls:
        body = client.get(url).content.decode()
        for needle in (STAMP, "Synthetic smoke test", "Odd name"):
            assert needle not in body, (url, needle)
    assert REAL in client.get("/activity/").content.decode()
    assert REAL in client.get("/architecture/").content.decode()


@pytest.mark.django_db
def test_search_and_palette_hide_synthetic(data, superadmin, client_for):
    names = {str(r) for g in search.search(superadmin, "smoke") for r in g.results}
    assert names == {REAL}
    client = client_for(superadmin)
    palette = client.get("/palette/?q=smoke", **HX).content.decode()
    assert REAL in palette and "Smoke test practice" not in palette
    assert "Smoke test practice" not in client.get("/search/?q=smoke").content.decode()


@pytest.mark.django_db
def test_counts_ignore_synthetic(data, superadmin):
    line = next(row for row in selectors.service_lines_for_home(superadmin) if row.slug == "consulting")
    assert line.active_projects == 0


@pytest.mark.django_db
def test_opt_in_cookie_shows_synthetic(data, superadmin, client_for):
    client = client_for(superadmin)
    client.cookies["vitalos_show_synthetic"] = "1"
    assert f"Smoke test practice {STAMP}" in client.get("/activity/").content.decode()
    assert (
        f"Smoke test project {STAMP}" in client.get("/s/consulting/?tab=projects&archived=1").content.decode()
    )


@pytest.mark.django_db
def test_notifications_and_audit_hide_synthetic(data, superadmin, make_user, client_for):
    owner = make_user("SuperAdmin")
    Notification.objects.create(
        recipient=owner, kind="project_status", title=f"Smoke test project {STAMP}: Pipeline → Active"
    )
    Notification.objects.create(recipient=owner, kind="project_status", title=f"{REAL}: Pipeline → Active")
    record("auth.sign_in", summary=f"Archived Smoke test practice {STAMP}")
    record("auth.sign_in", summary=f"Archived {REAL}")
    client = client_for(owner)
    page = client.get("/notifications/").content.decode()
    assert REAL in page and "Smoke test project" not in page
    # The role-assigned notice plus the real one; the synthetic one is not counted.
    assert b'data-testid="bell-count">2<' in client.get("/notifications/badge/", **HX).content
    trail = client_for(superadmin).get("/audit/").content.decode()
    assert REAL in trail and "Smoke test practice" not in trail
    assert AuditEvent.objects.filter(summary__contains="Smoke test practice").exists()
