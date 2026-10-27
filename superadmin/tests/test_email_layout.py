"""The Python email layout reproduces the TypeScript package's golden fixtures byte for byte (ADR-030)."""

import json
from pathlib import Path

import pytest
from django.conf import settings

from apps.mailer import layout

FIXTURES = Path(settings.BASE_DIR) / "email-layout" / "fixtures"
NAMES = sorted(path.name.removesuffix(".input.json") for path in FIXTURES.glob("*.input.json"))


def test_fixtures_exist():
    assert {"all-blocks", "hostile-and-missing", "internal-notice", "new-blocks", "correspondence"} <= set(
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
