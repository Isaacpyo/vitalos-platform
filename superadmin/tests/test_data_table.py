import pytest
from django.test import RequestFactory
from django.urls import reverse

from apps.audit.models import AuditEvent
from apps.core.templatetags.tables import Column, build_table, resolve_sort

COLUMNS = [
    Column("when", "When", sort_field="created_at"),
    Column("actor", "Actor", sort_field="actor_email"),
    Column("count", "Count", numeric=True),
]


def table_for(query="", per_page=2, **kwargs):
    request = RequestFactory().get("/x/" + query)
    return build_table(
        request,
        AuditEvent.objects.all(),
        COLUMNS,
        lambda e: [str(e.created_at.date()), e.actor_email, "1"],
        caption="Test table",
        target_id="t",
        url="/x/",
        default_sort="when",
        per_page=per_page,
        **kwargs,
    )


@pytest.fixture
def events(db):
    for name in "dbace":
        AuditEvent.objects.create(action="auth.sign_in", actor_email=f"{name}@example.test")


def test_resolve_sort_whitelists_fields():
    request = RequestFactory().get("/", {"sort": "password", "dir": "sideways"})
    key, direction, ordering = resolve_sort(request, COLUMNS, "when", "desc")
    assert (key, direction, ordering) == ("when", "desc", "-created_at")
    request = RequestFactory().get("/", {"sort": "actor", "dir": "asc"})
    assert resolve_sort(request, COLUMNS, "when")[2] == "actor_email"
    # A non-sortable column is not accepted.
    request = RequestFactory().get("/", {"sort": "count"})
    assert resolve_sort(request, COLUMNS, "when")[0] == "when"


def test_sort_and_aria_sort(events):
    table = table_for("?sort=actor&dir=asc")
    assert [row[1][1] for row in table["rows"]] == ["a@example.test", "b@example.test"]
    by_key = {h["column"].key: h for h in table["headers"]}
    assert by_key["actor"]["aria_sort"] == "ascending"
    assert by_key["when"]["aria_sort"] == ""
    assert by_key["count"]["url"] == ""
    # Clicking the active column flips direction and resets paging.
    assert "dir=desc" in by_key["actor"]["url"] and "page=" not in by_key["actor"]["url"]


def test_pagination_summary(events):
    table = table_for("?page=3")
    assert (table["first"], table["last"], table["total"]) == (5, 5, 5)
    assert table["prev_url"].endswith("page=2") and table["next_url"] == ""
    first = table_for()
    assert (first["first"], first["last"]) == (1, 2)
    assert first["next_url"] and not first["prev_url"]
    assert table_for("?page=zzz")["page"].number == 1
    assert table_for("?page=99")["page"].number == 3


def test_density(events):
    assert table_for()["density"] == "comfortable"
    assert table_for("?density=compact")["density"] == "compact"
    assert table_for("?density=huge")["density"] == "comfortable"


def test_empty_and_error_states(db):
    table = table_for(empty_message="Nothing here.")
    assert table["total"] == 0 and table["first"] == 0 and table["rows"] == []
    broken = table_for(error="Could not load events.")
    assert broken["rows"] == [] and broken["error"]


@pytest.mark.django_db
def test_rendered_markup(client_for, superadmin, events):
    client = client_for(superadmin)
    html = client.get(
        reverse("audit:trail"), {"sort": "event", "dir": "asc", "density": "compact"}
    ).content.decode()
    assert "<caption" in html
    assert 'scope="col"' in html
    assert 'aria-sort="ascending"' in html
    assert "dt-compact" in html
    assert "Showing 1–" in html
    assert "dt-sort" in html
