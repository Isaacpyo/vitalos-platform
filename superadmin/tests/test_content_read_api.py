"""The read API (amendment A3): nothing unpublished ever leaves the admin, query-time filters, closed
sections, pagination, previews, the tick endpoint and rate limits."""

import uuid
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.careers.models import Application, ApplicationNote, Role
from apps.content_sync import render, signing
from apps.content_sync.models import SiteSettings, SyncEvent
from apps.insights import services
from apps.insights.models import Post, PostStatus

from .content_helpers import (
    Contract,
    configure,
    edit,
    expire_role,
    make_author,
    make_post,
    make_role,
    ok_render,
    open_site,
    publish_post,
    response_json,
    signed_get,
    signed_post,
    tick_all,
    topic,
)

pytestmark = pytest.mark.django_db

HIDDEN = "HIDDEN"


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


def _approved(title, actor, author, **kwargs):
    post = make_post(title, actor, authors=[author], topics=[topic("data")], **kwargs)
    services.submit_for_review(post, actor)
    services.approve(post, actor)
    tick_all(post, actor)
    return Post.objects.get(pk=post.pk)


@pytest.fixture
def every_status(superadmin):
    """One post and one role in every status. Titles of everything not public contain HIDDEN."""
    open_site()
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    hidden_author = make_author("Example HIDDEN Author", actor=superadmin, slug="example-hidden-author")
    visible = publish_post(
        "Example published (fixture)",
        superadmin,
        authors=[author],
        topics=[topic()],
        slug="example-published",
    )
    edit(visible, superadmin, title="Example HIDDEN working-copy title", body_md="HIDDEN working-copy body")
    make_post(
        "Example HIDDEN draft",
        superadmin,
        authors=[hidden_author],
        topics=[topic("cloud-and-reliability")],
        slug="hidden-draft",
    )
    review = make_post("Example HIDDEN in review", superadmin, authors=[hidden_author], slug="hidden-review")
    services.submit_for_review(review, superadmin)
    _approved("Example HIDDEN approved", superadmin, hidden_author, slug="hidden-approved")
    future = _approved("Example HIDDEN scheduled", superadmin, hidden_author, slug="hidden-scheduled")
    services.schedule(future, superadmin, timezone.now() + timedelta(days=2))
    due = _approved("Example scheduled and due (fixture)", superadmin, author, slug="example-due")
    services.schedule(due, superadmin, timezone.now() + timedelta(minutes=5))
    Post.objects.filter(pk=due.pk).update(publish_at=timezone.now() - timedelta(minutes=1))
    archived = publish_post(
        "Example HIDDEN archived", superadmin, authors=[hidden_author], slug="hidden-archived"
    )
    services.archive(archived, superadmin)
    unpublished = publish_post(
        "Example HIDDEN unpublished", superadmin, authors=[hidden_author], slug="hidden-unpublished"
    )
    services.unpublish(unpublished, superadmin)

    open_role = make_role("Example open role (fixture)", actor=superadmin)
    make_role("Example HIDDEN draft role", status="draft")
    make_role("Example HIDDEN paused role", status="paused", actor=superadmin)
    make_role("Example HIDDEN archived role", status="archived", actor=superadmin)
    closed = make_role("Example closed role (fixture)", status="closed", actor=superadmin)
    expired = make_role("Example expired role (fixture)", actor=superadmin, closes_in=timedelta(days=1))
    expire_role(expired)
    Role.objects.filter(pk=open_role.pk).update(
        title="Example HIDDEN role working copy", summary="HIDDEN summary"
    )
    application = Application.objects.create(
        role=open_role,
        name="Example HIDDEN Applicant",
        email="applicant@example.test",
        right_to_work="yes",
        consent_at=timezone.now(),
        source="role_page",
        submission_id="00000000-0000-4000-8000-0000000009a1",
    )
    ApplicationNote.objects.create(application=application, admin=superadmin, body="HIDDEN note")
    return {"open_role": open_role, "closed": closed, "expired": expired}


def _every_response(client: Client) -> dict[str, object]:
    paths = [
        "/api/content/v1/site-state",
        "/api/content/v1/home",
        "/api/content/v1/sitemap",
        "/api/content/v1/insights/posts",
        "/api/content/v1/insights/topics",
        "/api/content/v1/insights/feed",
        "/api/content/v1/careers/page",
    ]
    for post in Post.objects.all():
        paths += [f"/api/content/v1/insights/posts/{post.slug}"]
        if post.published_slug:
            paths += [f"/api/content/v1/insights/posts/{post.published_slug}"]
    for slug in ("example-author", "example-hidden-author"):
        paths += [f"/api/content/v1/insights/authors/{slug}", f"/api/content/v1/insights/posts?author={slug}"]
    for slug in ("ai-and-agents", "data", "cloud-and-reliability"):
        paths += [f"/api/content/v1/insights/topics/{slug}", f"/api/content/v1/insights/posts?topic={slug}"]
    for role in Role.objects.all():
        paths += [f"/api/content/v1/careers/roles/{role.slug}"]
    responses = {}
    for path in paths:
        response = signed_get(client, path)
        assert response.status_code in (200, 404), path
        responses[path] = response
    return responses


def test_nothing_unpublished_leaks_anywhere(every_status, client: Client):
    responses = _every_response(client)
    for path, response in responses.items():
        text = response.content.decode()
        assert HIDDEN not in text, path
        # No admin users, applicants or any email address; the one exception is the company's public
        # support mailbox in the approved equal-opportunities statement.
        assert "@" not in text.replace("support@vitalos.co.uk", ""), path
        assert "applicant" not in text.lower(), path
    listing = response_json(responses["/api/content/v1/insights/posts"])
    titles = [item["title"] for item in listing["items"]] + [listing["featured"]["title"]]
    assert sorted(titles) == ["Example published (fixture)", "Example scheduled and due (fixture)"]
    assert responses["/api/content/v1/insights/authors/example-hidden-author"].status_code == 404
    assert responses["/api/content/v1/insights/topics/cloud-and-reliability"].status_code == 404
    feed = response_json(responses["/api/content/v1/insights/feed"])
    assert len(feed["items"]) == 2
    sitemap = [entry["path"] for entry in response_json(responses["/api/content/v1/sitemap"])["entries"]]
    assert "/insights/example-published" in sitemap and "/insights/example-due" in sitemap
    assert not any("hidden" in path for path in sitemap)
    role_paths = [path for path in sitemap if path.startswith("/careers/")]
    assert role_paths == [f"/careers/{every_status['open_role'].published_slug}"]


def test_role_states_on_the_read_api(every_status, client: Client):
    open_role = every_status["open_role"]
    data = response_json(signed_get(client, f"/api/content/v1/careers/roles/{open_role.published_slug}"))
    assert data["state"] == "open" and data["title"] == "Example open role (fixture)"
    for role in (every_status["closed"], every_status["expired"]):
        data = response_json(signed_get(client, f"/api/content/v1/careers/roles/{role.published_slug}"))
        assert data["state"] == "closed" and set(data) == {"state", "slug", "title", "practice", "closedAt"}
    for title in ("Example HIDDEN draft role", "Example HIDDEN paused role", "Example HIDDEN archived role"):
        role = Role.objects.get(title=title)
        assert signed_get(client, f"/api/content/v1/careers/roles/{role.slug}").status_code == 404
    page = response_json(signed_get(client, "/api/content/v1/careers/page"))
    assert page["total"] == 1
    home = response_json(signed_get(client, "/api/content/v1/home"))
    assert [role["title"] for role in home["careers"]["roles"]] == ["Example open role (fixture)"]


def test_closed_sections_answer_404_and_drop_out_of_home_and_sitemap(every_status, client: Client):
    SiteSettings.objects.filter(pk=1).update(insights_open=False, careers_open=False)
    for path in (
        "/api/content/v1/insights/posts",
        "/api/content/v1/insights/posts/example-published",
        "/api/content/v1/insights/authors/example-author",
        "/api/content/v1/insights/topics",
        "/api/content/v1/insights/topics/ai-and-agents",
        "/api/content/v1/insights/feed",
        "/api/content/v1/careers/page",
        f"/api/content/v1/careers/roles/{every_status['open_role'].published_slug}",
    ):
        assert signed_get(client, path).status_code == 404, path
    assert response_json(signed_get(client, "/api/content/v1/home")) == {"insights": None, "careers": None}
    assert response_json(signed_get(client, "/api/content/v1/sitemap")) == {"entries": []}
    state = response_json(signed_get(client, "/api/content/v1/site-state"))
    assert state["insightsOpen"] is False and state["careersOpen"] is False
    assert state["insights"]["heading"] == "Engineering clarity from complexity."


def test_site_state_next_due_at(every_status, client: Client):
    state = response_json(signed_get(client, "/api/content/v1/site-state"))
    due = Post.objects.get(slug="example-due").publish_at
    assert state["nextDueAt"] is not None and state["nextDueAt"] <= due.strftime("%Y-%m-%dT%H:%M:%SZ")


def test_pagination_featured_and_filters(superadmin, client: Client):
    open_site()
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    for index in range(14):
        publish_post(
            f"Example post {index:02d} (fixture)",
            superadmin,
            authors=[author],
            slug=f"example-{index:02d}",
            featured=index == 3,
        )
    first = response_json(signed_get(client, "/api/content/v1/insights/posts"))
    # The lead is the newest post, whatever the "featured" flag says (Website Build Pack, 25 Oct
    # 2026), so page 1 reads newest first.
    assert first["featured"]["slug"] == "example-13"
    assert first["total"] == 14 and first["totalPages"] == 2 and len(first["items"]) == 12
    second = response_json(signed_get(client, "/api/content/v1/insights/posts?page=2"))
    assert second["featured"] is None and len(second["items"]) == 1
    slugs = [item["slug"] for item in first["items"] + second["items"]]
    assert "example-13" not in slugs and len(set(slugs)) == 13
    assert slugs == [f"example-{index:02d}" for index in range(12, -1, -1)]
    assert signed_get(client, "/api/content/v1/insights/posts?page=3").status_code == 404
    assert signed_get(client, "/api/content/v1/insights/posts?page=0").status_code == 404
    assert signed_get(client, "/api/content/v1/insights/posts?format=not-a-format").status_code == 404
    assert signed_get(client, "/api/content/v1/insights/posts?topic=unknown-topic").status_code == 404
    filtered = response_json(signed_get(client, "/api/content/v1/insights/posts?format=engineering-note"))
    assert filtered["featured"] is None and filtered["total"] == 14
    empty_format = response_json(signed_get(client, "/api/content/v1/insights/posts?format=guide"))
    assert empty_format["total"] == 0 and empty_format["items"] == []
    assert [entry["key"] for entry in first["formats"]] == ["engineering_note"]
    assert first["topics"] == []


def test_empty_index_matches_the_empty_fixture(client: Client):
    open_site()
    data = response_json(signed_get(client, "/api/content/v1/insights/posts"))
    assert data == {
        "items": [],
        "page": 1,
        "pageSize": 12,
        "total": 0,
        "totalPages": 0,
        "featured": None,
        "formats": [],
        "topics": [],
    }
    assert response_json(signed_get(client, "/api/content/v1/home")) == {"insights": None, "careers": None}


def test_home_sections_respect_their_settings(superadmin, client: Client):
    from apps.content_sync import services as content_services

    open_site()
    author = make_author(actor=superadmin)
    for index in range(5):
        publish_post(f"Example post {index} (fixture)", superadmin, authors=[author], pin_home=index == 0)
    home = response_json(signed_get(client, "/api/content/v1/home"))
    assert len(home["insights"]["items"]) == 3
    assert home["insights"]["items"][0]["title"] == "Example post 4 (fixture)"
    content_services.update_section("home_insights", {"count": 2, "mode": "pinned"}, actor=superadmin)
    home = response_json(signed_get(client, "/api/content/v1/home"))
    assert [item["title"] for item in home["insights"]["items"]] == [
        "Example post 0 (fixture)",
        "Example post 4 (fixture)",
    ]
    assert home["careers"] is None  # no roles and the section hides by default
    content_services.update_section("home_careers", {"when_no_roles": "show_message"}, actor=superadmin)
    careers = response_json(signed_get(client, "/api/content/v1/home"))["careers"]
    assert careers["roles"] == [] and careers["message"].startswith("There are no open roles right now.")
    assert careers["associatesLine"] is None
    content_services.update_section("home_insights", {"enabled": False}, actor=superadmin)
    assert response_json(signed_get(client, "/api/content/v1/home"))["insights"] is None


def test_related_posts_never_include_unpublished_posts(superadmin, client: Client):
    open_site()
    author = make_author(actor=superadmin)
    shared = topic("data")
    a = publish_post("Example A (fixture)", superadmin, authors=[author], topics=[shared], slug="example-a")
    b = publish_post("Example B (fixture)", superadmin, authors=[author], topics=[shared], slug="example-b")
    detail = response_json(signed_get(client, "/api/content/v1/insights/posts/example-b"))
    assert [item["slug"] for item in detail["related"]] == ["example-a"]
    services.unpublish(Post.objects.get(pk=a.pk), superadmin)
    detail = response_json(signed_get(client, "/api/content/v1/insights/posts/example-b"))
    assert detail["related"] == []
    assert b.published_snapshot["related"][0]["slug"] == "example-a"  # the stored snapshot is untouched


def test_author_edits_show_without_republishing(superadmin, client: Client):
    from apps.insights import taxonomy

    open_site()
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    publish_post("Example post (fixture)", superadmin, authors=[author], slug="example-post")
    taxonomy.update_author(
        author,
        {"name": "Example Renamed", "slug": "example-renamed", "role_title": "Example title"},
        actor=superadmin,
    )
    detail = response_json(signed_get(client, "/api/content/v1/insights/posts/example-post"))
    assert detail["authors"][0]["name"] == "Example Renamed"
    assert response_json(signed_get(client, "/api/content/v1/insights/authors/example-author")) == {
        "redirect": "example-renamed"
    }
    event = SyncEvent.objects.filter(action="author.updated").latest("created_at")
    assert event.tags == ["insights"] and "/insights/authors/example-author" in event.paths


def test_preview_needs_the_signature_and_a_matching_token(superadmin, client: Client, settings):
    author = make_author(actor=superadmin)
    post = make_post("Example draft (fixture)", superadmin, authors=[author])
    path = f"/api/content/v1/preview/post/{post.pk}"
    token = signing.preview_token("post", post.pk, services.revision_hash(post))
    ok = signed_get(client, path, headers={"X-Vitalos-Preview-Token": token})
    assert ok.status_code == 200
    data = response_json(ok)
    assert (
        data["status"] == "draft"
        and data["post"]["title"] == "Example draft (fixture)"
        and data["role"] is None
    )
    contract = Contract()
    assert contract.errors(contract.operation("/api/content/v1/preview/{entity}/{id}"), data) == []
    assert signed_get(client, path).status_code == 401
    other = signing.preview_token("post", uuid.uuid4(), "x")
    assert signed_get(client, path, headers={"X-Vitalos-Preview-Token": other}).status_code == 401
    assert (
        client.get(path, HTTP_X_VITALOS_PREVIEW_TOKEN=token).status_code == 401
    )  # token alone is not enough
    role = make_role("Example draft role (fixture)", status="draft")
    role_token = signing.preview_token("role", role.pk, "x")
    role_path = f"/api/content/v1/preview/role/{role.pk}"
    data = response_json(signed_get(client, role_path, headers={"X-Vitalos-Preview-Token": role_token}))
    assert data["entity"] == "role" and data["role"]["title"] == "Example draft role (fixture)"
    assert contract.errors(contract.operation("/api/content/v1/preview/{entity}/{id}"), data) == []
    # Preview works while the sections are closed.
    assert SiteSettings.load().insights_open is False


def test_preview_of_a_post_without_an_author_is_404(superadmin, client: Client):
    post = make_post("Example draft (fixture)", superadmin)
    token = signing.preview_token("post", post.pk, "x")
    response = signed_get(
        client, f"/api/content/v1/preview/post/{post.pk}", headers={"X-Vitalos-Preview-Token": token}
    )
    assert response.status_code == 404


def test_tick_endpoint(superadmin, client: Client):
    response = signed_post(client, "/api/content/v1/tick", scope="tick")
    assert response.status_code == 200
    assert set(response_json(response)) == {"promoted", "closed", "delivered", "nextDueAt"}
    contract = Contract()
    assert contract.errors(contract.operation("/api/content/v1/tick", "post"), response_json(response)) == []
    assert signed_post(client, "/api/content/v1/tick", scope="read").status_code == 401
    assert signed_get(client, "/api/content/v1/tick").status_code == 405


def test_rate_limit_by_key_id(settings, client: Client):
    from django.core.cache import cache

    cache.clear()
    settings.CONTENT_READ_RATE_LIMIT = 3
    statuses = [signed_get(client, "/api/content/v1/health").status_code for _ in range(4)]
    assert statuses == [200, 200, 200, 429]
    cache.clear()


def test_unknown_api_paths_and_methods(client: Client):
    assert client.get("/api/content/v1/nope").status_code == 404
    response = client.post("/api/content/v1/home")
    assert response.status_code == 405
    assert signed_get(client, "/api/content/v1/insights/posts/Not_A_Slug").status_code == 404


def test_responses_never_carry_post_status_or_internal_fields(superadmin, client: Client):
    open_site()
    publish_post(
        "Example post (fixture)", superadmin, authors=[make_author(actor=superadmin)], slug="example-post"
    )
    text = signed_get(client, "/api/content/v1/insights/posts/example-post").content.decode()
    for word in ("status", "published_hash", "created_by", "updated_by", "revision"):
        assert f'"{word}"' not in text
    assert Post.objects.get(slug="example-post").status == PostStatus.PUBLISHED
