"""The Python email layout reproduces the TypeScript package's golden fixtures byte for byte (ADR-030)."""

import json
from pathlib import Path

import pytest
from django.conf import settings

from apps.mailer import layout

FIXTURES = Path(settings.BASE_DIR) / "email-layout" / "fixtures"
NAMES = sorted(path.name.removesuffix(".input.json") for path in FIXTURES.glob("*.input.json"))


def test_fixtures_exist():
    assert {"all-blocks", "hostile-and-missing", "internal-notice", "new-blocks", "correspondence", "links"} <= set(
        NAMES
    )


@pytest.mark.parametrize("name", NAMES)
def test_golden_fixture(name):
    doc = json.loads((FIXTURES / f"{name}.input.json").read_text(encoding="utf-8"))
    rendered = layout.render_email(doc)
    assert rendered.html == (FIXTURES / f"{name}.html").read_text(encoding="utf-8")
    assert rendered.text == (FIXTURES / f"{name}.txt").read_text(encoding="utf-8")
    images = json.loads((FIXTURES / f"{name}.images.json").read_text(encoding="utf-8"))
    assert [img["contentId"] for img in rendered.inline_images] == images


def test_cleaning_matches_javascript_whitespace():
    # \ufeff is whitespace to JavaScript's trim() but not to str.strip(); \x85 is the reverse.
    assert layout.clean_line("\ufeff a \n b \u00a0") == "a b"
    assert layout.clean_multiline("a\u202eb\x07\r\nc") == "ab\nc"
    assert layout.truncate("abcdef", 4) == "abc…"


def test_force_theme():
    html = layout.render_email(
        json.loads((FIXTURES / "internal-notice.input.json").read_text(encoding="utf-8"))
    ).html
    assert "@media all{" in layout.force_theme(html, "dark")
    assert "@media not all{" in layout.force_theme(html, "light")
    assert layout.force_theme(html, "system") == html


def _fixture(name):
    return json.loads((FIXTURES / f"{name}.input.json").read_text(encoding="utf-8"))


def test_code_never_in_subject_or_preheader():
    doc = _fixture("new-blocks")
    with pytest.raises(ValueError, match="subject or preheader"):
        layout.render_email({**doc, "title": "Your code is 482913"})
    with pytest.raises(ValueError, match="subject or preheader"):
        layout.render_email({**doc, "preheader": "Code 482913"})


@pytest.mark.parametrize(
    "block",
    [
        {"type": "badge", "items": ["New"]},
        {"type": "button", "label": "Go", "url": "https://vitalos.co.uk"},
        {"type": "heading", "text": "Hi"},
    ],
)
def test_correspondence_refuses_other_blocks(block):
    with pytest.raises(ValueError, match="Correspondence email cannot use"):
        layout.render_email({**_fixture("correspondence"), "blocks": [block]})


# --- Links in text blocks (the fallback line under a button) --------------------------------------------------


def _text_html(text: str) -> str:
    doc = {**_fixture("links"), "blocks": [{"type": "text", "text": text}]}
    return layout.render_email(doc).html


def test_text_links_use_the_layout_link_style():
    link = layout.spec()["theme"]["light"]["link"]
    html = _text_html("Copy this link: https://portal.example.test/invitation/abc/.")
    assert (
        '<a href="https://portal.example.test/invitation/abc/" class="v-link" '
        f'style="color:{link};text-decoration:underline;word-break:break-word;overflow-wrap:anywhere;">'
        "https://portal.example.test/invitation/abc/</a>.</p>"
    ) in html


def test_text_links_stop_at_javascript_whitespace_and_skip_other_schemes():
    #   and ﻿ end an address in JavaScript's \s, so they must here too.
    html = _text_html("See https://a.example/x then https://b.example/y﻿end")
    assert ">https://a.example/x</a> then" in html and ">https://b.example/y</a>﻿end" in html
    plain = _text_html("Not http://a.example, mailto:x@a.example or javascript:alert(1)")
    assert ">Not http://a.example, mailto:x@a.example or javascript:alert(1)</p>" in plain


def test_portal_invitation_fallback_link_is_readable(db):
    from types import SimpleNamespace

    from apps.portal.services import invitation_email

    member = SimpleNamespace(
        organisation=SimpleNamespace(name="Example Ledger Ltd (synthetic)"),
        get_role_display=lambda: "Contributor",
    )
    url = "https://portal.example.test/invitation/EXAMPLE/"
    _subject, doc = invitation_email(member, url)
    rendered = layout.render_email(doc)
    theme = layout.spec()["theme"]
    assert f'browser: <a href="{url}" class="v-link" style="color:{theme["light"]["link"]};' in rendered.html
    assert f".v-link{{color:{theme['dark']['link']} !important}}" in rendered.html
    assert f"copy this link into your browser: {url}" in rendered.text
