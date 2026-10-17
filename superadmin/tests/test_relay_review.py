"""Relay review fixes (17 Oct 2026, ADR-048): hand-off rate unit (E1), staff names (D3), sync age
and Overview counts (D4), suggested answers (D2), per-turn tokens and thumbs-down reasons (D1, D6)."""

import re
from datetime import timedelta

from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.relay import emails
from apps.relay.client import admin_identity, get_client, staff_name
from apps.relay.fake import GAP_ISO
from apps.relay.views import knowledge as knowledge_views
from apps.relay.views import pages


# --- E1: hand-off rate ----------------------------------------------------------------------------


def test_handoff_rate_fraction_renders_as_a_percentage():
    # 4 conversations, 1 hand-off: the website sends 0.25 (docs/relay/API.md) and the tile says 25%.
    assert pages._percent(0.25) == "25%"
    assert pages._percent(0) == "0%"
    assert pages._percent(None) == "–"


def test_insights_tile_shows_25_percent_for_one_handoff_in_four(client_for, superadmin, relay, monkeypatch):
    real = type(get_client(superadmin)).insights

    def insights(self, days=30):
        data = real(self, days)
        return {**data, "conversations": 4, "handoffs": 1, "handoffRate": 0.25}

    monkeypatch.setattr(type(get_client(superadmin)), "insights", insights)
    body = client_for(superadmin).get("/relay/insights/").content.decode()
    assert re.search(r"Hand-off rate</dt>\s*<dd[^>]*>25%</dd>", body)
    assert "2500%" not in body


def test_digest_handoff_rate_is_a_percentage_of_a_fraction():
    email = emails.digest(
        {"waitingNow": 0, "yesterday": {"conversations": 4, "handoffs": 1, "handoffRate": 0.25}, "openGaps": 0}
    )
    rendered = repr(email.document)
    assert "25%" in rendered and "2500%" not in rendered


# --- D3: staff names --------------------------------------------------------------------------------


def test_staff_name_never_falls_back_to_the_email(superadmin):
    superadmin.full_name = ""
    assert staff_name(superadmin) == "Vitalos team"
    identity = admin_identity(superadmin)
    assert identity["name"] == "Vitalos team" and identity["initials"] == "VT"
    assert "admin" not in identity["name"].lower()


def test_staff_name_prefers_a_display_name(superadmin):
    superadmin.full_name = "Temitope Agbola"
    assert staff_name(superadmin) == "Temitope Agbola"
    superadmin.display_name = "Temi Agbola"
    assert staff_name(superadmin) == "Temi Agbola"
    superadmin.display_name = "someone@example.test"
    assert staff_name(superadmin) == "Temitope Agbola"


# --- D4: sync age and Overview counts -----------------------------------------------------------------


def test_sync_age_flags_a_source_older_than_24_hours():
    old = (timezone.now() - timedelta(hours=31)).isoformat()
    fresh = (timezone.now() - timedelta(minutes=20)).isoformat()
    assert knowledge_views.sync_age({"lastSyncAt": old, "ageHours": 31, "stale": True})["stale"] is True
    assert knowledge_views.sync_age({"lastSyncAt": fresh, "ageHours": 0.3, "stale": False})["stale"] is False
    # An older website sends only the last content change: still judged by age.
    assert knowledge_views.sync_age(None, old)["stale"] is True
    assert knowledge_views.sync_age(None, None) == {"detail": "not synced yet", "stale": True}


def test_knowledge_page_warns_when_a_sync_is_stale(client_for, superadmin, relay, monkeypatch):
    from apps.relay.fake import FakeRelayClient

    real = FakeRelayClient._sync

    def stale(self):
        data = real(self)
        data["cms"] = {**data["cms"], "ageHours": 31, "stale": True,
                       "lastSyncAt": (timezone.now() - timedelta(hours=31)).isoformat()}
        return data

    body = client_for(superadmin).get("/relay/knowledge/").content.decode()
    assert 'data-testid="relay-sync-stale"' not in body
    monkeypatch.setattr(FakeRelayClient, "_sync", stale)
    body = client_for(superadmin).get("/relay/knowledge/").content.decode()
    assert body.count('data-testid="relay-sync-stale"') == 1
    assert "synced 31 h ago" in body


def test_overview_counts_for_the_morning_screen(superadmin, relay):
    data = get_client(superadmin).overview()
    assert {"awaitingConfirmation", "gapsThisWeek", "waitingNow", "sync"} <= set(data)
    assert data["sync"]["staleAfterHours"] == 24
    assert any(call[1] == "/overview" for call in relay.calls)


# --- D2: suggested answer ------------------------------------------------------------------------------


def test_suggested_answer_creates_a_draft_and_opens_the_editor(client_for, superadmin, relay):
    response = client_for(superadmin).post(f"/relay/knowledge/gaps/{GAP_ISO}/suggest/")
    assert response.status_code == 302 and "/relay/knowledge/" in response["Location"]
    document_id = response["Location"].rstrip("/").split("/")[-1]
    assert relay.data["documents"][document_id]["status"] == "draft"
    assert AuditEvent.objects.filter(action="relay.knowledge_suggested").exists()


def test_gap_list_offers_a_suggested_answer(client_for, superadmin, relay):
    body = client_for(superadmin).get("/relay/knowledge/").content.decode()
    assert f"/relay/knowledge/gaps/{GAP_ISO}/suggest/" in body and "Suggested answer" in body


# --- D1 / D6: per-turn tokens, usage by source, reasons -------------------------------------------------


def test_insights_show_tokens_per_answer_sources_and_reasons(client_for, superadmin, relay):
    body = client_for(superadmin).get("/relay/insights/").content.decode()
    assert "Average input tokens per answer" in body and "4,579" in body and "6,420" in body
    assert "Test traffic (evals and load tests)" in body and "210,000" in body
    assert "It was incomplete" in body
    assert "Not tagged" not in body  # hidden when nothing is untagged
