"""One person, one user (ADR-049): required names, the email back-fill, names everywhere,
``link_people`` and the Team page (findings E6 to E8, F3)."""

import importlib
import io

import pytest
from django.apps import apps as global_apps
from django.core.management import call_command
from django.template import Context, Template

from apps.accounts.models import User, name_from_email
from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN
from apps.architecture.models import TeamMember
from apps.audit.models import AuditEvent
from apps.audit.selectors import sentence
from apps.audit.services import record
from apps.insights.models import Author

pytestmark = pytest.mark.django_db


def test_name_from_email():
    assert name_from_email("temitope.agbola@vitalos.co.uk") == "Temitope Agbola"
    assert name_from_email("admin@vitalos.co.uk") == "Admin"
    assert name_from_email("jo_ann-smith@example.test") == "Jo Ann Smith"


def test_new_user_without_a_name_gets_one_flagged_for_review():
    user = User.objects.create_user(email="temitope.agbola@vitalos.co.uk")
    assert user.full_name == "Temitope Agbola" and user.name_needs_review is True
    named = User.objects.create_user(email="ada@example.test", full_name="Ada Lovelace")
    assert named.name_needs_review is False
    assert str(named) == named.display_label == "Ada Lovelace" and named.first_name == "Ada"


def test_backfill_migration_fills_and_flags_empty_names():
    migration = importlib.import_module("apps.accounts.migrations.0004_name_needs_review")
    blank = User.objects.create_user(email="jane.doe@example.test", full_name="Jane")
    User.objects.filter(pk=blank.pk).update(full_name="", name_needs_review=False)
    kept = User.objects.create_user(email="kept@example.test", full_name="Kept Name")
    migration.backfill(global_apps, None)
    blank.refresh_from_db()
    kept.refresh_from_db()
    assert blank.full_name == "Jane Doe" and blank.name_needs_review is True
    assert kept.full_name == "Kept Name" and kept.name_needs_review is False


def test_profile_requires_a_name_and_saving_confirms_it(make_user, client_for):
    user = make_user(SUPERADMIN, email="temitope.agbola@vitalos.co.uk")
    assert user.name_needs_review
    client = client_for(user)
    page = client.get("/account/").content.decode()
    assert 'data-testid="name-review-nudge"' in page
    empty = client.post("/account/", {"action": "profile", "full_name": "  "})
    assert empty.status_code == 200
    user.refresh_from_db()
    assert user.name_needs_review
    client.post("/account/", {"action": "profile", "full_name": "Temitope  Agbola"})
    user.refresh_from_db()
    assert user.full_name == "Temitope Agbola" and not user.name_needs_review
    assert 'data-testid="name-review-nudge"' not in client.get("/account/").content.decode()


def test_user_create_form_requires_a_name(superadmin, client_for):
    response = client_for(superadmin).post(
        "/settings/users/new/",
        {"email": "new@example.test", "full_name": "", "role": "Viewer", "password": "x" * 16},
        HTTP_HX_REQUEST="true",
    )
    assert response.status_code == 200 and not User.objects.filter(email="new@example.test").exists()


def test_person_filter_prefers_names():
    User.objects.create_user(email="ada@example.test", full_name="Ada Lovelace")
    template = Template("{% load ui %}{{ a|person }}|{{ b|person }}|{{ c|person }}")
    rendered = template.render(
        Context({"a": User.objects.get(email="ada@example.test"), "b": "ADA@example.test", "c": "x.y@z.test"})
    )
    assert rendered == "Ada Lovelace|Ada Lovelace|X Y"


def test_audit_sentence_names_the_actor(make_user):
    actor = make_user(SUPERADMIN, email="ada@example.test", full_name="Ada Lovelace")
    event = record("users.created", actor=actor, summary="Created someone")
    assert sentence(AuditEvent.objects.get(pk=event.pk)).startswith("Ada Lovelace (ada@example.test)")


def test_enquiry_assignee_dropdown_shows_names(superadmin, make_user, client_for):
    from apps.enquiries import services

    make_user(SERVICE_LEAD, email="lead@example.test", full_name="Lee Lead")
    enquiry = services.create_enquiry(
        subject="Hello",
        from_name="Jane",
        from_email="jane@customer.example",
        to_email="support@vitalos.co.uk",
        source="email",
        snippet="Hello",
    )
    html = client_for(superadmin).get(enquiry.get_absolute_url()).content.decode()
    assert ">Lee Lead</option>" in html and ">lead@example.test</option>" not in html


# --- link_people --------------------------------------------------------------------------------


def _author(name, slug):
    return Author.objects.create(name=name, slug=slug)


def test_link_people_dry_run_then_apply(make_user):
    temitope = make_user(SUPERADMIN, email="temitope.agbola@vitalos.co.uk")  # name back-filled
    member = TeamMember.objects.create(name="Temitope Agbola", email="Temitope.Agbola@Vitalos.co.uk")
    stranger = TeamMember.objects.create(name="No Account", email="nobody@example.test")
    author = _author("Temitope Agbola", "temitope-agbola")
    other = _author("Somebody Else", "somebody-else")

    out = io.StringIO()
    call_command("link_people", stdout=out)
    text = out.getvalue()
    assert "Would link 1 team member(s) and 1 author(s)" in text and "Dry run" in text
    assert "unmatched member  No Account <nobody@example.test>" in text
    member.refresh_from_db()
    author.refresh_from_db()
    assert member.user_id is None and author.admin_user_id is None

    call_command("link_people", "--apply", stdout=io.StringIO())
    member.refresh_from_db()
    author.refresh_from_db()
    other.refresh_from_db()
    stranger.refresh_from_db()
    assert member.user == temitope and author.admin_user == temitope
    assert other.admin_user_id is None and stranger.user_id is None
    assert AuditEvent.objects.filter(action="users.people_linked").exists()
    # Running again changes nothing.
    again = io.StringIO()
    call_command("link_people", "--apply", stdout=again)
    assert "Linked 0 team member(s) and 0 author(s)" in again.getvalue()


def test_link_people_never_overwrites_an_existing_link(make_user):
    first = make_user(SUPERADMIN, email="a@example.test", full_name="Alex A")
    second = make_user(SUPERADMIN, email="b@example.test", full_name="Alex B")
    member = TeamMember.objects.create(name="Alex", email="b@example.test", user=first)
    out = io.StringIO()
    call_command("link_people", "--apply", stdout=out)
    member.refresh_from_db()
    assert member.user == first and "conflict" in out.getvalue()
    assert second.pk  # still unlinked


# --- Team page ----------------------------------------------------------------------------------


def test_team_page_lists_users_with_role_lines_and_last_sign_in(seeded, make_user, client_for):
    admin = make_user(SUPERADMIN, email="temitope.agbola@vitalos.co.uk", full_name="Temitope Agbola")
    lead = make_user(SERVICE_LEAD, email="lee@example.test", full_name="Lee Lead")
    member = TeamMember.objects.create(name="Lee", email="lee@example.test", user=lead, role_title="Engineer")
    member.service_lines.add(seeded["engineering"])
    TeamMember.objects.create(name="Off System", email="off@example.test")
    html = client_for(admin).get("/team/").content.decode()
    assert "No team members yet" not in html
    assert "Temitope Agbola" in html and "Super admin" in html
    assert "Lee Lead" in html and "Service lead" in html and "Engineering" in html and "Engineer" in html
    assert 'data-testid="team-unlinked"' in html and "Off System" in html
    assert "Never" in html or "<time" in html
