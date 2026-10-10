"""Notifications, search and the activity feed."""

from datetime import date
from decimal import Decimal

import pytest

from apps.accounts.services import set_role
from apps.architecture import activity, search, services
from apps.architecture.models import KPI, Offer, Practice, Project, Solution, TeamMember
from apps.core.models import Classification
from apps.notifications.models import Notification

from .conftest import HX


@pytest.mark.django_db
def test_role_assignment_notifies_the_user(seeded, superadmin, make_user):
    user = make_user(None)
    assert set_role(user, "ServiceLead", superadmin) is True
    note = Notification.objects.get(recipient=user)
    assert note.kind == "role_assigned" and "ServiceLead" in note.title
    assert set_role(user, "ServiceLead", superadmin) is False  # unchanged: no duplicate
    assert Notification.objects.filter(recipient=user).count() == 1


@pytest.mark.django_db
def test_project_status_change_notifies_owner_lead_and_admins(seeded, superadmin, lead, make_user):
    other_admin = make_user("SuperAdmin")
    member_user = make_user("Viewer")
    member = TeamMember.objects.create(name="Project Lead", user=member_user)
    project = services.save_record(
        Project(service_line=seeded["consulting"], name="Rollout", lead=member), superadmin
    )
    services.change_project_status(project, "active", lead)
    recipients = set(
        Notification.objects.filter(kind="project_status").values_list("recipient__email", flat=True)
    )
    assert recipients == {
        superadmin.email,
        other_admin.email,
        member_user.email,
    }  # the actor (owner) is excluded
    assert "Pipeline → Active" in Notification.objects.filter(kind="project_status").first().title


@pytest.mark.django_db
def test_kpi_breach_notifies(seeded, superadmin, lead):
    kpi = services.save_record(
        KPI(service_line=seeded["consulting"], name="Bench", target=Decimal("10"), direction="lower"),
        superadmin,
    )
    services.record_kpi_value(kpi, date(2026, 9, 1), Decimal("8"), superadmin)
    assert not Notification.objects.filter(kind="kpi_breach").exists()
    services.record_kpi_value(kpi, date(2026, 10, 1), Decimal("12"), superadmin)
    recipients = set(
        Notification.objects.filter(kind="kpi_breach").values_list("recipient__email", flat=True)
    )
    assert recipients == {superadmin.email, lead.email}


@pytest.mark.django_db
def test_bell_count_and_mark_read(seeded, superadmin, make_user, client_for):
    user = make_user(None)
    set_role(user, "Viewer", superadmin)
    client = client_for(user, verified=False)
    badge = client.get("/notifications/badge/", **HX)
    assert b'data-testid="bell-count">1<' in badge.content
    note = Notification.objects.get(recipient=user)
    response = client.post(f"/notifications/{note.pk}/open/")
    assert response.status_code == 302 and response.url == "/"
    note.refresh_from_db()
    assert note.read_at is not None
    assert b"bell-count" not in client.get("/notifications/badge/", **HX).content
    # Another user's notification cannot be opened.
    foreign = Notification.objects.create(recipient=superadmin, kind="role_assigned", title="x", url="/")
    client.post(f"/notifications/{foreign.pk}/open/")
    foreign.refresh_from_db()
    assert foreign.read_at is None


@pytest.mark.django_db
def test_bell_polls_every_60_seconds(seeded, superadmin, client_for):
    body = client_for(superadmin).get("/").content.decode()
    assert 'hx-trigger="load, every 60s"' in body


@pytest.fixture
def tree(seeded, superadmin):
    practice = services.save_record(
        Practice(
            service_line=seeded["engineering"], name="Platform Engineering", summary="Kubernetes and cloud"
        ),
        superadmin,
    )
    solution = services.save_record(Solution(practice=practice, name="Developer platforms"), superadmin)
    services.save_record(Offer(solution=solution, name="Golden path starter"), superadmin)
    services.save_record(
        Project(service_line=seeded["engineering"], name="Internal developer portal"), superadmin
    )
    return practice


@pytest.mark.django_db
def test_search_finds_prefixes_across_models(tree, superadmin):
    groups = {group.label: [str(r) for r in group.results] for group in search.search(superadmin, "platf")}
    assert "Platform Engineering" in groups["Practices"]
    assert "Developer platforms" in groups["Solutions"]
    assert search.search(superadmin, "kubern")[0].results[0].name == "Platform Engineering"
    assert search.search(superadmin, "   ") == []
    assert search.search(superadmin, "zzzzqqq") == []


@pytest.mark.django_db
def test_search_respects_visibility_and_archive(tree, superadmin, viewer):
    assert any(g.label == "Projects" for g in search.search(superadmin, "portal"))
    assert not any(g.label == "Projects" for g in search.search(viewer, "portal"))  # Confidential
    services.archive(tree, superadmin)
    assert not any(g.label == "Practices" for g in search.search(superadmin, "platform"))


@pytest.mark.django_db
def test_search_handles_hostile_input(tree, superadmin, client_for):
    for query in ["'; drop table x; --", "a & | ! ( ) : *", "<script>alert(1)</script>"]:
        response = client_for(superadmin).get("/search/", {"q": query})
        assert response.status_code == 200
        assert b"<script>alert(1)</script>" not in response.content


@pytest.mark.django_db
def test_activity_feed_from_history(tree, superadmin, seeded):
    services.archive(tree, superadmin)
    entries = activity.feed(superadmin, limit=50)
    actions = {(e.model_key, e.action, e.object_label) for e in entries}
    assert ("practice", "created", "Platform Engineering") in actions
    assert ("practice", "archived", "Platform Engineering") in actions
    assert ("offer", "created", "Golden path starter") in actions
    scoped = activity.feed(superadmin, service_line=seeded["consulting"], limit=50)
    assert all(e.object_label != "Platform Engineering" for e in scoped)
    only_offers = activity.feed(superadmin, model_key="offer", limit=50)
    assert {e.model_key for e in only_offers} == {"offer"}
    newest_first = [e.when for e in entries]
    assert newest_first == sorted(newest_first, reverse=True)


@pytest.mark.django_db
def test_activity_feed_shows_field_changes_and_hides_confidential(tree, superadmin, viewer, seeded):
    tree.status = "active"
    services.save_record(tree, superadmin)
    updated = next(e for e in activity.feed(superadmin, model_key="practice") if e.action == "updated")
    assert ("Status", "Draft", "Active") in updated.changes
    assert any(e.model_key == "project" for e in activity.feed(superadmin))
    assert not any(e.model_key == "project" for e in activity.feed(viewer))


@pytest.mark.django_db
def test_activity_page_filters(tree, superadmin, client_for):
    client = client_for(superadmin)
    response = client.get("/activity/?service_line=engineering&model=offer")
    body = response.content.decode()
    assert "Golden path starter" in body and "Platform Engineering" not in body


@pytest.mark.django_db
def test_confidential_classification_default_for_project(seeded):
    assert Project(service_line=seeded["labs"], name="x").classification == Classification.CONFIDENTIAL


@pytest.mark.django_db
def test_reclassified_record_history_is_hidden(tree, superadmin, viewer):
    assert any(e.object_label == "Platform Engineering" for e in activity.feed(viewer, limit=50))
    tree.classification = Classification.RESTRICTED
    services.save_record(tree, superadmin)
    assert not any(e.object_label == "Platform Engineering" for e in activity.feed(viewer, limit=50))
    assert any(e.object_label == "Platform Engineering" for e in activity.feed(superadmin, limit=50))


@pytest.mark.django_db
def test_activity_hides_names_of_invisible_related_records(seeded, superadmin, viewer):
    hidden = services.save_record(
        TeamMember(name="Covert Lead", classification=Classification.RESTRICTED), superadmin
    )
    project = services.save_record(
        Project(service_line=seeded["labs"], name="Open experiment", classification=Classification.INTERNAL),
        superadmin,
    )
    project.lead = hidden
    services.save_record(project, superadmin)
    changes = [c for e in activity.feed(viewer, model_key="project") for c in e.changes]
    assert ("Lead", "—", "(restricted)") in changes
    admin_changes = [c for e in activity.feed(superadmin, model_key="project") for c in e.changes]
    assert ("Lead", "—", "Covert Lead") in admin_changes
