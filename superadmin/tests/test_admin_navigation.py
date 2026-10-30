"""Sidebar nesting (Client portal under AI & Data), the Settings section menu and the Demonstrator sub-menu."""

import re

import pytest
from django.urls import reverse

from apps.core import navigation
from apps.recon_demo.models import ReconRun
from tests.conftest import HX
from tests.portal_helpers import build_world


def _active(body: str) -> list[str]:
    return re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body)


def _ai_data_dropdown(body: str) -> str:
    start = body.index('<ul id="nav-sub-ai_data"')
    return body[start : body.index("</ul>", start)]


# --- Sidebar ---------------------------------------------------------------------------------------------------


def test_client_portal_is_a_child_of_the_ai_and_data_dropdown(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/").content.decode()
    assert 'aria-controls="nav-sub-ai_data"' in body and 'data-nav-parent="ai_data"' in body
    dropdown = _ai_data_dropdown(body)
    assert 'data-nav="aidata"' in dropdown and 'data-nav="portal"' in dropdown
    assert dropdown.index('data-nav="aidata"') < dropdown.index('data-nav="portal"')
    # No longer a top-level item of its own: it appears exactly once, inside the dropdown.
    assert body.count('data-nav="portal"') == 1 and body.count('data-nav="aidata"') == 1
    assert "AI &amp; Data: Client portal" in dropdown  # collapsed-rail tooltip names the parent


@pytest.mark.parametrize("role_fixture", ["superadmin", "lead"])
def test_staff_who_can_manage_the_portal_see_it(request, client_for, seeded, role_fixture):
    body = client_for(request.getfixturevalue(role_fixture)).get("/").content.decode()
    dropdown = _ai_data_dropdown(body)
    assert 'data-nav="portal"' in dropdown and "/client-portal/" in dropdown


def test_viewers_see_neither_ai_and_data_nor_the_client_portal(client_for, viewer, seeded):
    body = client_for(viewer).get("/").content.decode()
    assert "nav-sub-ai_data" not in body
    assert 'data-nav="portal"' not in body and 'data-nav="aidata"' not in body
    assert client_for(viewer).get("/client-portal/").status_code == 403


def test_visibility_follows_the_portal_and_ai_data_permissions(superadmin, lead, viewer):
    ai = next(item for item in navigation.NAV_ITEMS if item.key == "ai_data")
    portal = next(child for child in ai.children if child.key == "portal")
    assert portal.permission == "apps.portal.access.staff_can_manage"
    assert navigation.is_visible(portal, superadmin) and navigation.is_visible(portal, lead)
    assert not navigation.is_visible(portal, viewer) and not navigation.is_visible(ai, viewer)


@pytest.fixture
def world(db):
    return build_world()


def test_every_portal_staff_page_highlights_client_portal(world, client_for):
    client = client_for(world.staff)
    paths = [
        "/client-portal/",
        "/client-portal/deliveries/",
        "/client-portal/orgs/new/",
        f"/client-portal/orgs/{world.org_a.pk}/",
        f"/client-portal/orgs/{world.org_a.pk}/services/new/",
        f"/client-portal/challenges/{world.ch_a.pk}/",
        f"/client-portal/challenges/{world.ch_a.pk}/edit/",
        f"/client-portal/projects/{world.project_a.pk}/",
        f"/client-portal/deliverables/{world.deliv_a.pk}/",
        f"/client-portal/services/{world.svc_a.pk}/report/",
    ]
    for path in paths:
        body = client.get(path).content.decode()
        assert _active(body) == ["portal"], path
        # The dropdown reads as active too, and the breadcrumb names it.
        assert re.search(r'data-nav-parent="ai_data" data-active', body), path
    for path in ("/client-portal/orgs/1/", "/client-portal/some/later/page/"):
        assert navigation.active_item(path).key == "portal"
        assert navigation.crumb_label(navigation.active_item(path)) == "AI & Data"


def test_ai_data_pages_highlight_the_overview_child(client_for, superadmin, seeded):
    client = client_for(superadmin)
    for path in ("/ai-data/", "/ai-data/pipeline/", "/ai-data/budget/", "/ai-data/demonstrator/"):
        body = client.get(path).content.decode()
        assert _active(body) == ["aidata"], path


def test_palette_names_the_ai_and_data_overview_and_its_parent(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/palette/?q=AI", **HX).content.decode()
    assert "AI &amp; Data overview" in body
    body = client_for(superadmin).get("/palette/?q=client", **HX).content.decode()
    assert "Client portal" in body and "AI &amp; Data" in body


# --- Settings section menu ---------------------------------------------------------------------------------------

SECTIONS = {
    "company": "architecture:settings_company",
    "users": "accounts:settings_users",
    "email": "enquiries_settings:email",
    "content": "content_settings:site",
    "notifications": "enquiries_settings:notifications",
    "tokens": "accounts:settings_tokens",
    "data": "architecture:settings_data",
}


def _menu(body: str) -> str:
    start = body.index('<nav aria-label="Settings sections"')
    return body[start : body.index("</nav>", start)]


def test_settings_is_a_menu_of_links_with_one_current_section(client_for, superadmin, seeded):
    client = client_for(superadmin)
    for key, name in SECTIONS.items():
        response = client.get(reverse(name))
        assert response.status_code == 200, key
        body = response.content.decode()
        menu = _menu(body)
        # Real links, every section reachable, exactly one marked current, and no tab semantics left.
        assert re.findall(r'<a [^>]*aria-current="page"[^>]*data-settings-section="([a-z]+)"', menu) == [key]
        for other, other_name in SECTIONS.items():
            assert f'href="{reverse(other_name)}"' in menu, (key, other)
        assert 'role="tab' not in body and "aria-selected" not in menu
        assert 'data-testid="settings-panel"' in body


def test_settings_menu_groups_and_htmx_swaps(client_for, superadmin, seeded):
    menu = _menu(client_for(superadmin).get("/settings/users/").content.decode())
    for label in ("Organisation", "Communication", "Website", "Developer"):
        assert f">{label}</p>" in menu
    users = re.search(r'<a class="settings-link" href="/settings/users/"[^>]*>', menu).group(0)
    assert 'hx-get="/settings/users/"' in users and 'hx-push-url="true"' in users
    assert 'hx-select="#settings-region"' in users and 'hx-target="#settings-region"' in users
    # A partial swap re-renders the menu, so aria-current follows the section.
    swapped = client_for(superadmin).get("/settings/tokens/", **HX).content.decode()
    assert re.findall(
        r'<a [^>]*aria-current="page"[^>]*data-settings-section="([a-z]+)"', _menu(swapped)
    ) == ["tokens"]


def test_settings_menu_keeps_every_permission_condition(client_for, viewer, lead, seeded):
    viewer_menu = _menu(client_for(viewer).get("/settings/tokens/").content.decode())
    assert re.findall(r'data-settings-section="([a-z]+)"', viewer_menu) == ["tokens", "data"]
    assert ">Organisation</p>" not in viewer_menu and ">Communication</p>" not in viewer_menu
    lead_menu = _menu(client_for(lead).get("/settings/tokens/").content.decode())
    # ServiceLead: enquiry notifications (can_enquiries) but nothing SuperAdmin-only.
    assert re.findall(r'data-settings-section="([a-z]+)"', lead_menu) == ["notifications", "tokens", "data"]
    for path in ("/settings/company/", "/settings/users/", "/settings/users/portal/"):
        assert client_for(viewer).get(path).status_code == 403
        assert client_for(lead).get(path).status_code == 403


# --- Demonstrator: AI & Data tabs plus its own sub-menu ----------------------------------------------------------


def _ai_tabs(body: str) -> str:
    start = body.index('aria-label="AI & Data sections"')
    return body[start : body.index("</nav>", start)]


def _demo_menu(body: str) -> str:
    start = body.index('<nav class="pill-nav mt-3" aria-label="Demonstrator"')
    return body[start : body.index("</nav>", start)]


def test_every_demonstrator_page_keeps_the_ai_data_tabs_and_marks_its_own_item(
    client_for, superadmin, seeded
):
    client = client_for(superadmin)
    client.post(
        reverse("recon_demo:new"),
        {"source": "sample", "sample_key": "clean-csv", "mode": "off", "synthetic_confirmed": "on"},
    )
    run = ReconRun.objects.order_by("-number").first()
    assert run is not None
    pages = {
        reverse("recon_demo:index"): "Runs",
        reverse("recon_demo:new"): "New run",
        reverse("recon_demo:detail", args=[run.ref]): "Runs",
        reverse("recon_demo:evaluation"): "Evaluation",
        reverse("recon_demo:settings"): "AI settings",
    }
    for path, current in pages.items():
        body = client.get(path).content.decode()
        tabs = _ai_tabs(body)
        assert re.findall(r'aria-current="page">([^<]+)</a>', tabs) == ["Demonstrator"], path
        assert 'href="/ai-data/pipeline/"' in tabs and 'href="/ai-data/budget/"' in tabs
        menu = _demo_menu(body)
        assert re.findall(r'aria-current="page">(?:<svg.*?</svg>)?([^<]+)</a>', menu) == [current], path
        for href in (
            "/ai-data/demonstrator/",
            "/ai-data/demonstrator/new/",
            "/ai-data/demonstrator/evaluation/",
        ):
            assert f'href="{href}"' in menu
        # The sub-menu sits under the AI & Data tabs.
        assert body.index('aria-label="AI & Data sections"') < body.index('aria-label="Demonstrator"')


def test_demonstrator_menu_hides_ai_settings_from_service_leads(client_for, lead):
    menu = _demo_menu(client_for(lead).get(reverse("recon_demo:index")).content.decode())
    assert "AI settings" not in menu and "/ai-data/demonstrator/settings/" not in menu


def test_other_ai_data_pages_do_not_mark_the_demonstrator(client_for, superadmin, seeded):
    tabs = _ai_tabs(client_for(superadmin).get("/ai-data/pipeline/").content.decode())
    assert re.findall(r'aria-current="page">([^<]+)</a>', tabs) == ["Pipeline"]
