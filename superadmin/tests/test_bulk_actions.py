"""Checkbox bulk actions on the Careers roles list and the Insights posts list: each item goes through the
same service, permission and readiness checks as its single action, items are independent, and the
summary comes back as one message on the same filtered list."""

import pytest
from django.contrib.auth.models import Permission
from django.contrib.messages import get_messages
from django.test import Client
from django.urls import reverse

from apps.accounts.roles import SERVICE_LEAD
from apps.audit.models import AuditEvent
from apps.careers.models import Role, RoleStatus
from apps.content_sync import render
from apps.content_sync.models import SyncEvent
from apps.insights import services as insight_services
from apps.insights.models import Post, PostStatus

from .content_helpers import (
    configure,
    make_author,
    make_post,
    make_role,
    ok_render,
    open_site,
    publish_post,
    topic,
)

pytestmark = pytest.mark.django_db

ROLES = "careers:role_bulk"
POSTS = "insights:post_bulk"


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)
    open_site()


def live_post(title, actor):
    return publish_post(title, actor, authors=[make_author(actor=actor)], topics=[topic()])


def texts(response) -> list[str]:
    return [str(message) for message in get_messages(response.wsgi_request)]


def with_perms(make_user, *codenames):
    user = make_user(SERVICE_LEAD, email="editor@example.test")
    for codename in codenames:
        user.user_permissions.add(Permission.objects.get(codename=codename))
    return user


# --- Roles ---------------------------------------------------------------------------------------


def test_roles_bulk_applies_an_action_to_several_roles_after_confirmation(superadmin, client_for):
    client = client_for(superadmin)
    one = make_role("Example role one (fixture)", status="draft")
    two = make_role("Example role two (fixture)", status="draft")
    url = reverse(ROLES)
    data = {"action": "open", "ids": [str(one.pk), str(two.pk)], "qs": "tab=drafts"}

    confirm = client.post(url, data)
    assert confirm.status_code == 200
    body = confirm.content.decode()
    assert "Example role one (fixture)" in body and "Example role two (fixture)" in body
    assert Role.objects.filter(status=RoleStatus.OPEN).count() == 0  # nothing happens before confirming

    response = client.post(url, {**data, "confirmed": "1"})
    assert response.status_code == 302 and response["Location"] == reverse("careers:roles") + "?tab=drafts"
    assert texts(response) == ["2 roles opened."]
    assert Role.objects.filter(status=RoleStatus.OPEN).count() == 2
    assert AuditEvent.objects.filter(entity_id=str(one.pk)).exists()
    assert SyncEvent.objects.exists()


def test_roles_bulk_reports_a_failure_and_still_applies_the_others(superadmin, client_for):
    client = client_for(superadmin)
    good = make_role("Example good role (fixture)", status="draft")
    bad = make_role("Example incomplete role (fixture)", status="draft", summary="")
    last = make_role("Example last role (fixture)", status="draft")
    response = client.post(
        reverse(ROLES),
        {"action": "open", "ids": [str(good.pk), str(bad.pk), str(last.pk)], "confirmed": "1"},
    )
    message = texts(response)[0]
    assert message.startswith("2 roles opened. 1 could not be opened: Example incomplete role (fixture) — ")
    statuses = {role.title: role.status for role in Role.objects.all()}
    assert statuses["Example good role (fixture)"] == RoleStatus.OPEN
    assert statuses["Example last role (fixture)"] == RoleStatus.OPEN
    assert statuses["Example incomplete role (fixture)"] == RoleStatus.DRAFT


def test_roles_bulk_close_pause_and_archive(superadmin, client_for):
    client = client_for(superadmin)
    roles = [make_role(f"Example role {n} (fixture)") for n in range(3)]
    ids = [str(role.pk) for role in roles]
    client.post(reverse(ROLES), {"action": "pause", "ids": ids[:1], "confirmed": "1"})
    response = client.post(reverse(ROLES), {"action": "close", "ids": ids, "confirmed": "1"})
    assert "2 roles closed. 1 could not be closed:" in texts(response)[-1]
    assert Role.objects.get(pk=ids[0]).status == RoleStatus.PAUSED
    assert Role.objects.get(pk=ids[1]).status == RoleStatus.CLOSED
    client.post(reverse(ROLES), {"action": "archive", "ids": ids, "confirmed": "1"})
    assert set(Role.objects.values_list("status", flat=True)) == {RoleStatus.ARCHIVED}


def test_roles_bulk_rejects_unknown_actions_ids_and_delete(superadmin, client_for):
    client = client_for(superadmin)
    role = make_role("Example role (fixture)")
    url = reverse(ROLES)
    for action in ("delete", "duplicate", "nonsense", ""):
        assert (
            client.post(url, {"action": action, "ids": [str(role.pk)], "confirmed": "1"}).status_code == 400
        )
    assert client.post(url, {"action": "close", "ids": ["not-a-uuid"], "confirmed": "1"}).status_code == 400
    missing = "00000000-0000-4000-8000-000000000000"
    assert (
        client.post(url, {"action": "close", "ids": [str(role.pk), missing], "confirmed": "1"}).status_code
        == 400
    )
    assert Role.objects.get(pk=role.pk).status == RoleStatus.OPEN


def test_roles_bulk_with_nothing_selected_returns_to_the_list(superadmin, client_for):
    response = client_for(superadmin).post(reverse(ROLES), {"action": "close", "qs": "tab=paused"})
    assert response.status_code == 302 and response["Location"].endswith("?tab=paused")
    assert texts(response) == ["Select at least one role first."]


def test_roles_bulk_ignores_a_hostile_return_querystring(superadmin, client_for):
    response = client_for(superadmin).post(reverse(ROLES), {"action": "close", "qs": "//evil.example/"})
    assert response["Location"].startswith("/careers/roles/")
    assert "evil.example" not in response["Location"].split("?")[0]


def test_roles_bulk_needs_post_csrf_and_the_publish_permission(superadmin, viewer, make_user, client_for):
    role = make_role("Example role (fixture)")
    data = {"action": "close", "ids": [str(role.pk)], "confirmed": "1"}
    url = reverse(ROLES)
    assert client_for(superadmin).get(url).status_code == 405
    assert client_for(viewer).post(url, data).status_code == 403
    editor = with_perms(make_user, "change_role")
    assert client_for(editor).post(url, data).status_code == 403
    assert Client().post(url, data).status_code == 302  # anonymous: sent to sign in
    assert Role.objects.get(pk=role.pk).status == RoleStatus.OPEN
    strict = client_for(superadmin)
    strict.handler.enforce_csrf_checks = True
    assert strict.post(url, data).status_code == 403


def test_roles_list_renders_checkboxes_and_select_all(superadmin, viewer, client_for):
    role = make_role("Example role (fixture)")
    html = client_for(superadmin).get(reverse("careers:roles")).content.decode()
    assert "data-bulk-all" in html and 'aria-label="Select all on this page"' in html
    assert f'value="{role.pk}"' in html and 'aria-label="Select Example role (fixture)"' in html
    assert 'action="' + reverse(ROLES) + '"' in html
    assert '<option value="archive">Archive</option>' in html and 'value="delete"' not in html
    quiet = client_for(viewer).get(reverse("careers:roles")).content.decode()
    assert "data-bulk-item" not in quiet and "data-bulk-bar" not in quiet


# --- Posts ---------------------------------------------------------------------------------------


def test_posts_bulk_archives_several_posts_after_confirmation(superadmin, client_for):
    client = client_for(superadmin)
    live = live_post("Example live post (fixture)", superadmin)
    draft = make_post("Example draft post (fixture)", superadmin)
    data = {"action": "archive", "ids": [str(live.pk), str(draft.pk)], "qs": "tab=all&q=example"}
    url = reverse(POSTS)

    confirm = client.post(url, data)
    assert confirm.status_code == 200 and "Example live post (fixture)" in confirm.content.decode()
    assert Post.objects.get(pk=live.pk).status == PostStatus.PUBLISHED

    response = client.post(url, {**data, "confirmed": "1"})
    assert response["Location"] == reverse("insights:posts") + "?tab=all&q=example"
    assert texts(response) == ["2 posts archived."]
    assert set(Post.objects.values_list("status", flat=True)) == {PostStatus.ARCHIVED}
    assert AuditEvent.objects.filter(action="insights.post_archived", entity_id=str(live.pk)).exists()


def test_posts_bulk_reports_a_failure_and_still_applies_the_others(superadmin, client_for):
    client = client_for(superadmin)
    first = make_post("Example first post (fixture)", superadmin)
    approved = make_post("Example approved post (fixture)", superadmin)
    insight_services.submit_for_review(approved, superadmin)
    insight_services.approve(approved, superadmin)
    last = make_post("Example last post (fixture)", superadmin)
    ids = [str(first.pk), str(approved.pk), str(last.pk)]
    response = client.post(reverse(POSTS), {"action": "submit", "ids": ids})  # no confirmation needed
    message = texts(response)[0]
    assert message.startswith("2 posts submitted for review. 1 could not be submitted for review: ")
    assert "Example approved post (fixture) — Only a draft can be submitted for review" in message
    assert Post.objects.get(pk=first.pk).status == PostStatus.IN_REVIEW
    assert Post.objects.get(pk=last.pk).status == PostStatus.IN_REVIEW
    assert Post.objects.get(pk=approved.pk).status == PostStatus.APPROVED


def test_posts_bulk_publish_keeps_the_readiness_checks(superadmin, client_for):
    client = client_for(superadmin)
    post = make_post("Example unticked post (fixture)", superadmin)
    insight_services.submit_for_review(post, superadmin)
    insight_services.approve(post, superadmin)
    response = client.post(reverse(POSTS), {"action": "publish", "ids": [str(post.pk)], "confirmed": "1"})
    assert "1 could not be published: Example unticked post (fixture) — " in texts(response)[0]
    assert Post.objects.get(pk=post.pk).status == PostStatus.APPROVED


def test_posts_bulk_unpublish(superadmin, client_for):
    client = client_for(superadmin)
    one = live_post("Example one (fixture)", superadmin)
    two = live_post("Example two (fixture)", superadmin)
    data = {"action": "unpublish", "ids": [str(one.pk), str(two.pk)]}
    assert client.post(reverse(POSTS), data).status_code == 200  # confirmation page
    response = client.post(reverse(POSTS), {**data, "confirmed": "1"})
    assert texts(response) == ["2 posts unpublished."]
    assert set(Post.objects.values_list("status", flat=True)) == {PostStatus.DRAFT}


def test_posts_bulk_rejects_unknown_actions_and_ids(superadmin, client_for):
    client = client_for(superadmin)
    post = make_post("Example post (fixture)", superadmin)
    url = reverse(POSTS)
    for action in ("delete", "duplicate", "schedule", "nonsense", ""):
        assert (
            client.post(url, {"action": action, "ids": [str(post.pk)], "confirmed": "1"}).status_code == 400
        )
    assert client.post(url, {"action": "submit", "ids": ["nope"]}).status_code == 400
    missing = "00000000-0000-4000-8000-000000000000"
    assert client.post(url, {"action": "submit", "ids": [str(post.pk), missing]}).status_code == 400
    assert Post.objects.get(pk=post.pk).status == PostStatus.DRAFT


def test_posts_bulk_needs_post_csrf_and_the_right_permission(superadmin, viewer, make_user, client_for):
    post = make_post("Example post (fixture)", superadmin)
    data = {"action": "submit", "ids": [str(post.pk)]}
    url = reverse(POSTS)
    assert client_for(superadmin).get(url).status_code == 405
    assert client_for(viewer).post(url, data).status_code == 403
    assert Client().post(url, data).status_code == 302
    editor = with_perms(make_user, "change_post")
    editor_client = client_for(editor)
    assert (
        editor_client.post(url, {"action": "publish", "ids": [str(post.pk)], "confirmed": "1"}).status_code
        == 403
    )
    assert editor_client.post(url, data).status_code == 302  # editing actions are allowed
    assert Post.objects.get(pk=post.pk).status == PostStatus.IN_REVIEW
    strict = client_for(superadmin)
    strict.handler.enforce_csrf_checks = True
    assert strict.post(url, {"action": "return", "ids": [str(post.pk)]}).status_code == 403


def test_a_live_archive_is_refused_per_item_without_the_publish_permission(superadmin, make_user, client_for):
    live = live_post("Example live post (fixture)", superadmin)
    draft = make_post("Example draft post (fixture)", superadmin)
    editor = with_perms(make_user, "change_post")
    response = client_for(editor).post(
        reverse(POSTS), {"action": "archive", "ids": [str(live.pk), str(draft.pk)], "confirmed": "1"}
    )
    message = texts(response)[0]
    assert message.startswith("1 post archived. 1 could not be archived: Example live post (fixture) — ")
    assert Post.objects.get(pk=live.pk).status == PostStatus.PUBLISHED
    assert Post.objects.get(pk=draft.pk).status == PostStatus.ARCHIVED


def test_posts_list_renders_checkboxes_and_select_all(superadmin, viewer, client_for):
    post = make_post("Example post (fixture)", superadmin)
    html = client_for(superadmin).get(reverse("insights:posts")).content.decode()
    assert "data-bulk-all" in html and 'aria-label="Select all on this page"' in html
    assert f'value="{post.pk}"' in html and 'aria-label="Select Example post (fixture)"' in html
    assert 'action="' + reverse(POSTS) + '"' in html
    assert '<option value="unpublish">Unpublish</option>' in html and 'value="delete"' not in html
    quiet = client_for(viewer).get(reverse("insights:posts")).content.decode()
    assert "data-bulk-item" not in quiet
