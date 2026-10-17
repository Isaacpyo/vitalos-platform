"""Busy feedback: button spinners, the blurred submit overlay, skeleton placeholders."""

from pathlib import Path

from django.template.loader import render_to_string

APP_JS = Path(__file__).resolve().parent.parent / "static" / "js" / "app.js"


def test_base_template_includes_submit_overlay_and_progress_bar(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/").content.decode()
    assert 'id="submit-overlay"' in body
    assert "backdrop-blur-sm" in body
    assert "data-submit-overlay-text" in body
    assert 'id="nav-progress"' in body


def test_health_footer_region_renders_skeleton_first(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/").content.decode()
    region = body.split('data-testid="health-footer"')[1].split("</footer>")[0]
    assert 'data-skeleton="inline"' in region


def test_palette_and_modal_backdrops_are_blurred(client_for, superadmin, seeded):
    body = client_for(superadmin).get("/").content.decode()
    assert "backdrop:backdrop-blur-sm" in body
    assert 'data-skeleton="list"' in body.split('id="palette-list"')[1].split("</dialog>")[0]
    modal = render_to_string("partials/modal_shell.html", {"title": "x"})
    assert "backdrop-blur-sm" in modal


def test_skeleton_variants_render_requested_rows():
    table = render_to_string("partials/skeleton.html", {"kind": "table", "rows": 3})
    assert 'data-skeleton="table"' in table
    assert table.count("border-slate-100") == 3
    assert "motion-reduce:animate-none" in table
    assert 'role="status"' in table
    for kind in ("cards", "lines", "list", "inline"):
        assert f'data-skeleton="{kind}"' in render_to_string("partials/skeleton.html", {"kind": kind})


def test_app_js_has_busy_handlers():
    js = APP_JS.read_text(encoding="utf-8")
    for needle in (
        'addEventListener("submit"',
        "htmx:beforeRequest",
        "htmx:afterRequest",
        '"pageshow"',
        "data-no-submit-overlay",
        "aria-busy",
        "submit-overlay",
    ):
        assert needle in js
