from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import pytest
from django.urls import reverse
from django.utils import timezone

from apps.core import overview
from apps.enquiries import sla
from apps.enquiries.models import Enquiry, InboxSettings

LONDON = ZoneInfo("Europe/London")
_counter = iter(range(1, 10_000))


def make_enquiry(**fields):
    fields.setdefault("number", next(_counter))
    fields.setdefault("from_email", "someone@example.test")
    fields.setdefault("subject", "Hello")
    created = fields.pop("created_at", None)
    enquiry = Enquiry.objects.create(**fields)
    if created:
        Enquiry.objects.filter(pk=enquiry.pk).update(created_at=created)
        enquiry.refresh_from_db()
    return enquiry


def kpi(kpis, key):
    return next(item for item in kpis if item.key == key)


def test_format_duration():
    assert overview.format_duration(timedelta(hours=3, minutes=20)) == "3 h 20 min"
    assert overview.format_duration(timedelta(minutes=45)) == "45 min"
    assert overview.format_duration(timedelta(hours=2)) == "2 h"
    assert overview.format_duration(timedelta(days=1, hours=4)) == "1 d 4 h"
    assert overview.format_duration(timedelta(seconds=-5)) == "0 min"


def test_week_start_is_monday_midnight_london():
    # Wednesday 14 Oct 2026 10:00 UTC (BST, UTC+1).
    now = datetime(2026, 10, 14, 10, 0, tzinfo=ZoneInfo("UTC"))
    assert overview.week_start(now) == datetime(2026, 10, 12, 0, 0, tzinfo=LONDON)


def test_week_boundary_respects_london_clock():
    # Sunday 18 Oct 23:30 UTC is already Monday 19 Oct 00:30 in London (BST), so a new week.
    now = datetime(2026, 10, 18, 23, 30, tzinfo=ZoneInfo("UTC"))
    assert overview.week_start(now) == datetime(2026, 10, 19, 0, 0, tzinfo=LONDON)


@pytest.mark.django_db
def test_empty_state_kpis():
    kpis = overview.enquiry_kpis()
    assert kpi(kpis, "open").value == "0"
    assert kpi(kpis, "first_response").value == "No responses yet"
    assert kpi(kpis, "first_response").delta is None
    assert kpi(kpis, "new_week").value == "0"
    assert kpi(kpis, "unassigned").value == "0"


@pytest.mark.django_db
def test_median_first_response_and_delta():
    now = timezone.now()
    for hours in (1, 3, 8):  # median 3 h
        created = now - timedelta(days=2)
        make_enquiry(created_at=created, first_response_at=created + timedelta(hours=hours))
    for hours in (4, 6):  # previous period, median 5 h
        created = now - timedelta(days=10)
        make_enquiry(created_at=created, first_response_at=created + timedelta(hours=hours))
    item = kpi(overview.enquiry_kpis(now), "first_response")
    assert item.value == "3 h"
    assert item.delta.direction == "down"
    assert item.delta.tone == "better"
    assert "Faster by 2 h" in item.delta.text


@pytest.mark.django_db
def test_median_ignores_unanswered_and_old():
    now = timezone.now()
    make_enquiry(created_at=now - timedelta(days=1))
    old = now - timedelta(days=20)
    make_enquiry(created_at=old, first_response_at=old + timedelta(hours=1))
    assert overview.median_first_response(now - timedelta(days=7), now) is None


@pytest.mark.django_db
def test_open_unassigned_and_status_counts(superadmin):
    make_enquiry(status=Enquiry.Status.NEW)
    make_enquiry(status=Enquiry.Status.OPEN, assignee=superadmin)
    make_enquiry(status=Enquiry.Status.PENDING)
    make_enquiry(status=Enquiry.Status.RESOLVED, resolved_at=timezone.now())
    make_enquiry(status=Enquiry.Status.SPAM)
    kpis = overview.enquiry_kpis()
    assert kpi(kpis, "open").value == "3"
    assert kpi(kpis, "unassigned").value == "2"


@pytest.mark.django_db
def test_open_delta_improvement_is_better_not_red():
    now = timezone.now()
    for _ in range(3):  # open a week ago, resolved since
        make_enquiry(
            status=Enquiry.Status.RESOLVED,
            created_at=now - timedelta(days=9),
            resolved_at=now - timedelta(days=2),
        )
    item = kpi(overview.enquiry_kpis(now), "open")
    assert item.value == "0"
    assert item.delta.direction == "down"
    assert item.delta.tone == "better"


@pytest.mark.django_db
def test_worse_delta_is_neutral_tone():
    now = timezone.now()
    make_enquiry(status=Enquiry.Status.NEW, created_at=now - timedelta(days=1))
    item = kpi(overview.enquiry_kpis(now), "open")
    assert item.delta.direction == "up"
    assert item.delta.tone == "neutral"


@pytest.mark.django_db
def test_new_this_week_counts_since_london_monday():
    now = datetime(2026, 10, 14, 12, 0, tzinfo=ZoneInfo("UTC"))  # Wednesday
    monday = datetime(2026, 10, 12, 0, 0, tzinfo=LONDON)
    make_enquiry(created_at=monday + timedelta(minutes=1))
    make_enquiry(created_at=monday - timedelta(minutes=1))  # Sunday night: last week
    make_enquiry(created_at=monday - timedelta(days=7) + timedelta(hours=5))  # same point last week
    item = kpi(overview.enquiry_kpis(now), "new_week")
    assert item.value == "1"
    assert item.delta.direction == "flat"
    assert item.delta.text.startswith("No change")


@pytest.mark.django_db
def test_needs_attention_selection(superadmin):
    now = timezone.now()
    overdue = make_enquiry(
        sla_due_at=now - timedelta(hours=1), assignee=superadmin, status=Enquiry.Status.OPEN
    )
    soon = make_enquiry(sla_due_at=now + timedelta(minutes=30), assignee=superadmin)
    fine = make_enquiry(sla_due_at=now + timedelta(days=3), assignee=superadmin)
    resolved = make_enquiry(sla_due_at=now - timedelta(hours=5), status=Enquiry.Status.RESOLVED)
    answered = make_enquiry(
        sla_due_at=now - timedelta(hours=5), assignee=superadmin, first_response_at=now - timedelta(hours=6)
    )
    stale = make_enquiry(created_at=now - timedelta(days=6), sla_due_at=now + timedelta(days=3))
    fresh_unassigned = make_enquiry(created_at=now, sla_due_at=now + timedelta(days=3))

    items = overview.needs_attention(now)
    ids = [item["enquiry"].pk for item in items]
    assert ids[:2] == [overdue.pk, soon.pk]  # overdue first, then due soon
    assert stale.pk in ids
    for excluded in (fine, resolved, answered, fresh_unassigned):
        assert excluded.pk not in ids
    assert items[0]["label"].startswith("Overdue")
    assert next(i for i in items if i["enquiry"].pk == stale.pk)["state"] == "unassigned"
    assert sla.state(overdue, now)[0] == "overdue"


@pytest.mark.django_db
def test_system_status_defaults(settings):
    settings.EMAIL_TRANSPORT = "log"
    status = overview.system_status()
    assert status["outbound"] == "Log only (not sending)"
    assert status["domain_status"] == "Not checked"
    assert status["last_inbound_at"] is None
    settings.EMAIL_TRANSPORT = "resend"
    assert overview.system_status()["outbound"] == "Resend"


@pytest.mark.django_db
def test_overview_renders_for_superadmin(client_for, superadmin, seeded):
    make_enquiry(subject="Overdue thing", sla_due_at=timezone.now() - timedelta(hours=2), assignee=superadmin)
    inbox = InboxSettings.load()
    inbox.last_inbound_error = "Worker timed out"
    inbox.save()
    response = client_for(superadmin).get(reverse("architecture:home"))
    html = response.content.decode()
    assert response.status_code == 200
    assert "<h1" in html and "Overview" in html
    for label in ("Open enquiries", "Median first response (7 days)", "New this week", "Unassigned"):
        assert label in html
    assert "No responses yet" in html
    assert "Overdue thing" in html
    assert "VIT-" in html
    assert "No mail received yet" in html
    assert "Worker timed out" in html
    assert "Log only (not sending)" in html


@pytest.mark.django_db
def test_overview_hides_enquiry_kpis_for_viewer(client_for, viewer, seeded):
    make_enquiry(subject="Private matter")
    response = client_for(viewer).get(reverse("architecture:home"))
    html = response.content.decode()
    assert response.status_code == 200
    assert "Open enquiries" not in html
    assert "Needs attention" not in html
    assert "Private matter" not in html
    assert "System status" in html
