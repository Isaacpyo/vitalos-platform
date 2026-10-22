"""App shell: sidebar navigation, persisted preferences, branding and the command palette."""

import re

import pytest

from .conftest import HX

ROUTES = {
    "/": "overview",
    "/activity/": "activity",
    "/service-lines/": "service_lines",
    "/s/consulting/": "service_lines",
    "/team/": "team",
    "/architecture/": "architecture",
    "/settings/users/": "settings",
    "/mail/templates/": "email_templates",
    "/enquiries/": "enquiries",
    "/relay/inbox/": "relay",
    "/relay/knowledge/": "relay",
    "/relay/insights/": "relay",
    "/relay/settings/": "relay",
    "/products/": "products",
    "/products/askbridge/": "products",
}


def _active(body: str) -> list[str]:
    return re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body)


@pytest.mark.parametrize(("path", "key"), ROUTES.items())
def test_every_route_marks_exactly_one_nav_item_active(client_for, superadmin, seeded, relay, path, key):
    response = client_for(superadmin).get(path)
    assert response.status_code == 200
    assert _active(response.content.decode()) == [key]


def test_sidebar_lists_every_section_in_its_group(client_for, superadmin, seeded, relay):
    body = client_for(superadmin).get("/").content.decode()
    for label in ("Operate", "Organisation", "System"):
        assert f">{label}</p>" in body
    for key in ("overview", "relay", "activity", "service_lines", "team", "architecture", "settings"):
        assert f'data-nav="{key}"' in body
    assert 'alt="Vitalos"' in body and "brand/vitalos-wordmark-reversed" in body
    assert "brand/apple-touch-icon" in body and 'name="theme-color" content="#0B1320"' in body


def test_preferences_come_from_cookies_so_there_is_no_flash(client_for, superadmin, seeded):
    client = client_for(superadmin)
    body = client.get("/").content.decode()
    assert 'data-theme="system"' in body and 'data-sidebar="expanded"' in body
    client.cookies["sidebar_state"] = "collapsed"
    client.cookies["theme"] = "dark"
    body = client.get("/").content.decode()
    assert 'data-theme="dark"' in body and 'data-sidebar="collapsed"' in body
    assert 'aria-expanded="false"' in body and "Expand sidebar" in body


def test_unknown_theme_cookie_falls_back_to_system(client_for, superadmin, seeded):
    client = client_for(superadmin)
    client.cookies["theme"] = '"><script>'
    body = client.get("/").content.decode()
    assert 'data-theme="system"' in body and '<script>"' not in body


def test_environment_badge(client_for, superadmin, seeded, settings):
    settings.APP_ENVIRONMENT = "production"
    body = client_for(superadmin).get("/").content.decode()
    assert re.search(r'data-testid="env-badge">Production<', body)


def test_user_menu_shows_role_and_two_factor_status(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/").content.decode()
    assert "admin@example.test" in body and "Super admin" in body
    assert "Two-factor:</dt><dd>On" in body


def test_top_bar_has_a_refresh_link_to_the_current_page(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/notifications/?tab=attention").content.decode()
    link = re.search(r'<a href="([^"]*)" class="[^"]*" data-refresh aria-label="Refresh this page"', body)
    assert link and link.group(1) == "/notifications/?tab=attention"
    # It sits after the search field, before the command palette button.
    assert body.index('id="global-search"') < link.start() < body.index("data-palette-open")


def test_no_chrome_before_sign_in(client):
    body = client.get("/login/").content.decode()
    assert 'id="sidebar"' not in body and 'id="palette"' not in body
    assert "brand/vitalos-wordmark-reversed" in body


def test_old_home_url_still_works_and_service_lines_has_its_own_page(client_for, superadmin, seeded):
    client = client_for(superadmin)
    assert "service-line-card" in client.get("/").content.decode()
    body = client.get("/service-lines/").content.decode()
    assert body.count('data-testid="service-line-card"') == 6


def test_palette_lists_pages_and_finds_records(client_for, superadmin, seeded):
    client = client_for(superadmin)
    body = client.get("/palette/", **HX).content.decode()
    assert "Service lines" in body and "Users and roles" in body
    body = client.get("/palette/?q=engin", **HX).content.decode()
    assert "Vitalos Engineering" in body and "Search everything for" in body


def test_palette_hides_superadmin_settings_from_viewers(client_for, viewer, seeded):
    body = client_for(viewer).get("/palette/?q=users", **HX).content.decode()
    assert "Users and roles" not in body


def test_palette_and_help_require_a_role(client, client_for, norole):
    assert client.get("/palette/").status_code == 302
    assert client_for(norole).get("/help/").status_code == 403


def test_help_page_lists_shortcuts(client_for, viewer):
    body = client_for(viewer).get("/help/").content.decode()
    assert "Ctrl/⌘ K" in body and "Ctrl/⌘ B" in body


def test_sidebar_has_notifications_item_active_on_its_pages(client_for, superadmin, seeded):
    client = client_for(superadmin)
    for path in ("/notifications/", "/notifications/attention/"):
        body = client.get(path).content.decode()
        assert _active(body) == ["notifications"]
    body = client.get("/").content.decode()
    assert 'data-nav="notifications"' in body and "notifications/badge/?nav=1" in body
    assert 'data-testid="bell"' in body or "notifications:badge" in body or "/notifications/badge/" in body


def test_notifications_nav_badge_variant(client_for, superadmin, seeded):
    response = client_for(superadmin).get("/notifications/badge/?nav=1", **HX)
    assert response.status_code == 200 and b"bell-count" not in response.content


def test_logout_control_renders_confirmation_dialog(client_for, superadmin, seeded):
    client = client_for(superadmin)
    body = client.get("/").content.decode()
    assert 'id="logout-dialog"' in body and "Sign out of Vitalos Super Admin?" in body
    assert "data-confirm-logout" in body and "data-close-logout" in body
    assert 'method="post" action="/logout/"' in body
    assert client.get("/logout/").status_code == 405
    assert client.post("/logout/").status_code == 302


def test_no_smoke_test_details_in_the_admin(client_for, superadmin, seeded):
    client = client_for(superadmin)
    for path in ("/", "/system/health/", "/help/"):
        assert "smoke" not in client.get(path).content.decode().lower()
