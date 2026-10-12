import csv
import io
from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.audit import selectors
from apps.audit.models import AuditEvent
from tests.conftest import HX


def event(action="auth.sign_in", email="a@example.test", **fields):
    return AuditEvent.objects.create(action=action, actor_email=email, **fields)


@pytest.mark.django_db
def test_trail_forbidden_for_non_superadmin(client_for, viewer, lead):
    for user in (viewer, lead):
        client = client_for(user)
        assert client.get(reverse("audit:trail")).status_code == 403
        assert client.get(reverse("audit:export")).status_code == 403


@pytest.mark.django_db
def test_trail_requires_login(client):
    assert client.get(reverse("audit:trail")).status_code == 302


@pytest.mark.django_db
def test_trail_renders_sentence_and_ip(client_for, superadmin):
    event(
        "users.role_changed",
        "admin@example.test",
        summary="viewer@example.test: Viewer → ServiceLead",
        ip="203.0.113.9",
    )
    html = client_for(superadmin).get(reverse("audit:trail")).content.decode()
    assert "admin@example.test — Changed a role — viewer@example.test: Viewer → ServiceLead" in html
    assert "203.0.113.9" in html
    assert "Operate" in html and "Audit trail" in html
    assert 'aria-sort="descending"' in html


@pytest.mark.django_db
def test_filters(client_for, superadmin):
    now = timezone.now()
    event("auth.sign_in", "alice@example.test", entity_type="accounts.user", created_at=now)
    event("auth.sign_in_failed", "bob@example.test", entity_type="accounts.user", created_at=now)
    event(
        "enquiries.viewed",
        "alice@example.test",
        entity_type="enquiries.enquiry",
        created_at=now - timedelta(days=10),
    )
    client = client_for(superadmin)
    url = reverse("audit:trail")

    def body(**params):
        return client.get(url, params).content.decode()

    html = body(actor="alice")
    assert "alice@example.test" in html and "bob@example.test" not in html
    html = body(action="auth.sign_in_failed")
    assert "bob@example.test" in html and "alice@example.test" not in html
    html = body(entity_type="enquiries.enquiry")
    assert "alice@example.test — Viewed an enquiry" in html and "bob@example.test" not in html
    recent = (now - timedelta(days=3)).strftime("%Y-%m-%d")
    html = body(date_from=recent)
    assert "alice@example.test — Viewed" not in html and "alice@example.test — Signed in" in html
    old = (now - timedelta(days=5)).strftime("%Y-%m-%d")
    html = body(date_to=old)
    assert "alice@example.test — Viewed an enquiry" in html and "bob@example.test" not in html
    assert "No audit events match" in body(actor="nobody-here")


def test_clean_filters_drops_invalid_values():
    filters = selectors.clean_filters({"action": "nope", "date_from": "garbage", "actor": "  x  "})
    assert filters["action"] == "" and filters["date_from"] == "" and filters["actor"] == "x"


@pytest.mark.django_db
def test_htmx_partial_returns_table_only(client_for, superadmin):
    event()
    response = client_for(superadmin).get(
        reverse("audit:trail"), {"actor": "a@"}, HTTP_HX_TARGET="audit-results", **HX
    )
    html = response.content.decode()
    assert 'id="audit-results"' in html
    assert "<html" not in html


@pytest.mark.django_db
def test_export_escapes_formulas_is_audited_and_filtered(client_for, superadmin):
    event("auth.sign_in", "=cmd@example.test", summary='=HYPERLINK("x")', ip="198.51.100.1")
    event("auth.sign_out", "other@example.test")
    response = client_for(superadmin).get(reverse("audit:export"), {"actor": "cmd"})
    assert response.status_code == 200
    assert response["Content-Type"].startswith("text/csv")
    rows = list(csv.reader(io.StringIO(response.content.decode())))
    assert rows[0][0] == "time"
    assert len(rows) == 2
    assert rows[1][1] == "'=cmd@example.test"
    assert rows[1][6] == '\'=HYPERLINK("x")'
    exported = AuditEvent.objects.filter(action="audit.exported")
    assert exported.count() == 1
    assert exported.first().actor == superadmin
    assert exported.first().metadata["rows"] == 1


@pytest.mark.django_db
def test_export_is_capped(client_for, superadmin, monkeypatch):
    monkeypatch.setattr(selectors, "EXPORT_LIMIT", 3)
    for index in range(5):
        event(email=f"user{index}@example.test")
    response = client_for(superadmin).get(reverse("audit:export"))
    rows = list(csv.reader(io.StringIO(response.content.decode())))
    assert len(rows) == 1 + 3
    assert AuditEvent.objects.get(action="audit.exported").metadata["capped"] is True


@pytest.mark.django_db
def test_activity_tabs(client_for, superadmin, viewer, seeded):
    html = client_for(superadmin).get(reverse("architecture:activity")).content.decode()
    assert "Changes" in html and reverse("audit:trail") in html
    html = client_for(viewer).get(reverse("architecture:activity")).content.decode()
    assert "Changes" in html and reverse("audit:trail") not in html
