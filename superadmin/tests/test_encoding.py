"""Guards against double-encoded UTF-8 ("mojibake") in served text and source files (E2)."""

from pathlib import Path

import pytest
from django.test import Client

from apps.accounts.models import ApiToken

# UTF-8 bytes of "→", "…", "é" etc. decoded as cp1252/latin-1 start with these sequences.
MOJIBAKE = ("\u00e2\u20ac", "\u00e2\u2020", "\u00c3", "\u00c2\u00a0")
ROOT = Path(__file__).resolve().parent.parent
TEXT_SUFFIXES = {".py", ".html", ".js", ".css", ".md", ".txt", ".json", ".toml", ".yml", ".yaml", ".svg"}
SKIP_DIRS = {".venv", "node_modules", "staticfiles", "__pycache__", ".pytest_cache", ".ruff_cache"}


def _has_mojibake(text: str) -> bool:
    return any(seq in text for seq in MOJIBAKE)


@pytest.mark.django_db
def test_api_schema_is_clean_utf8(viewer):
    _, raw = ApiToken.issue(viewer, "Encoding")
    response = Client().get("/api/schema/?format=json", HTTP_AUTHORIZATION=f"Bearer {raw}")
    assert response.status_code == 200
    body = response.content.decode("utf-8")  # raises if the bytes are not valid UTF-8
    assert "Settings \u2192 API tokens" in body or "Settings \u2192 API tokens" in body
    assert not _has_mojibake(body)


def test_source_files_have_no_mojibake():
    offenders = []
    for path in ROOT.rglob("*"):
        if path.suffix not in TEXT_SUFFIXES or SKIP_DIRS.intersection(path.parts) or not path.is_file():
            continue
        if path.name == "test_encoding.py":
            continue
        text = path.read_text(encoding="utf-8")
        if _has_mojibake(text):
            offenders.append(str(path.relative_to(ROOT)))
    assert offenders == []


def test_media_origin_for_the_image_csp():
    from config.settings.base import _origin

    assert _origin("https://media.example.test/insights/") == "https://media.example.test"
    assert _origin("http://localhost:9000/bucket") == "http://localhost:9000"
    assert _origin("") == "" and _origin("javascript:alert(1)") == ""
    assert _origin("https://user:pass@media.example.test/") == ""
