"""Insights admin and website-sync pages: permissions on every view, and the editor's behaviour."""

import json
import re
import uuid

import pytest
from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client
from django.urls import reverse

from apps.audit.models import AuditEvent
from apps.content_sync import render, signing
from apps.content_sync.models import SiteSection, SiteSettings, SyncEvent
from apps.insights import services
from apps.insights.models import Author, Post, PostRevision, PostStatus, Topic

from .conftest import HX
from .content_helpers import (
    PREVIEW_KEYS,
    WEB,
    configure,
    make_author,
    make_post,
    ok_render,
    png_bytes,
    publish_post,
    tick_all,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


@pytest.fixture
def world(superadmin):
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    post = publish_post("Example post (fixture)", superadmin, authors=[author], slug="example-post")
    draft = make_post("Example draft (fixture)", superadmin, authors=[author])
    topic = Topic.objects.get(slug="data")
    from apps.content_sync import sync

    sync.deliver_due()  # on_commit callbacks do not run in these tests; deliver like the tick would
    return {
        "author": author,
        "post": post,
        "draft": draft,
        "topic": topic,
        "revision": PostRevision.objects.get(post=post),
        "event": SyncEvent.objects.first(),
    }


def _gets(w):
    post, author, topic, revision = w["post"], w["author"], w["topic"], w["revision"]
    return [
        reverse("insights:root"),
        reverse("insights:posts"),
        reverse("insights:posts") + "?tab=published&q=Example",
        reverse("insights:post", args=[post.pk]),
        reverse("insights:post_rail", args=[post.pk]),
        reverse("insights:post_sync", args=[post.pk]),
        reverse("insights:post_preview_panel", args=[post.pk]),
        reverse("insights:post_preview_frame", args=[post.pk]),
        reverse("insights:revision", args=[post.pk, revision.pk]),
        reverse("insights:authors"),
        reverse("insights:author", args=[author.pk]),
        reverse("insights:topics"),
        reverse("insights:topic", args=[topic.pk]),
        reverse("insights:settings"),
        reverse("content_sync:sync"),
        reverse("content_sync:overall"),
    ]


def _posts(w):
    """Every state-changing endpoint with a harmless body."""
    post, draft, author, topic, revision = w["post"], w["draft"], w["author"], w["topic"], w["revision"]
    return [
        (reverse("insights:post_new"), {"title": "Example new (fixture)", "format": "guide"}),
        (reverse("insights:post", args=[draft.pk]), {"title": "x", "format": "guide", "slug": draft.slug}),
        (
            reverse("insights:post_autosave", args=[draft.pk]),
            {"title": "x", "format": "guide", "slug": draft.slug},
        ),
        (reverse("insights:post_action", args=[draft.pk, "submit"]), {}),
        (reverse("insights:post_action", args=[post.pk, "unpublish"]), {}),
        (reverse("insights:post_action", args=[post.pk, "archive"]), {}),
        (reverse("insights:post_action", args=[draft.pk, "duplicate"]), {}),
        (reverse("insights:post_action", args=[draft.pk, "delete"]), {}),
        (reverse("insights:post_check", args=[draft.pk, "claims"]), {"checked": "1"}),
        (reverse("insights:post_cover", args=[draft.pk]), {"remove": "1"}),
        (reverse("insights:media_upload"), {"alt": "x"}),
        (reverse("insights:revision_restore", args=[post.pk, revision.pk]), {}),
        (reverse("insights:author_new"), {"name": "Example Other"}),
        (reverse("insights:author", args=[author.pk]), {"name": "Example Author"}),
        (reverse("insights:author_action", args=[author.pk, "confirm"]), {}),
        (reverse("insights:author_action", args=[author.pk, "deactivate"]), {}),
        (reverse("insights:topics"), {"name": "Example topic", "kind": "topic"}),
        (reverse("insights:topic", args=[topic.pk]), {"name": "Data", "kind": "topic", "slug": "data"}),
        (reverse("insights:topic_action", args=[topic.pk, "up"]), {}),
        (
            reverse("insights:settings"),
            {"action": "copy", "heading": "x", "intro": "y", "editorial_note": "z"},
        ),
        (reverse("content_sync:resync"), {}),
        (reverse("content_settings:site"), {"insights_open": "on"}),
    ]


def test_anonymous_visitors_are_sent_to_sign_in(world, client: Client):
    for url in _gets(world):
        response = client.get(url)
        assert response.status_code == 302 and "/login/" in response["Location"], url
    for url, data in _posts(world):
        response = client.post(url, data)
        assert response.status_code == 302 and "/login/" in response["Location"], url
    assert Post.objects.filter(title="Example new (fixture)").count() == 0


def test_viewer_can_read_but_not_change_anything(world, viewer, client_for):
    client = client_for(viewer)
    for url in _gets(world):
        assert client.get(url).status_code in (200, 302), url
    for url, data in _posts(world):
        assert client.post(url, data).status_code == 403, url
    assert client.get(reverse("content_settings:site")).status_code == 403
    world["post"].refresh_from_db()
    assert world["post"].status == PostStatus.PUBLISHED
    body = client.get(reverse("insights:post", args=[world["draft"].pk])).content.decode()
    assert "<fieldset" in body and "disabled" in body.split("<fieldset", 2)[1][:200]
    assert "data-editable" not in body


def test_superadmin_sees_every_page(world, superadmin, client_for):
    client = client_for(superadmin)
    for url in _gets(world) + [
        reverse("insights:post_new"),
        reverse("insights:author_new"),
        reverse("content_settings:site"),
    ]:
        response = client.get(url, follow=True)
        assert response.status_code == 200, url


def test_django_permissions_grant_editing_without_superadmin(world, viewer, client_for):
    viewer.user_permissions.add(
        Permission.objects.get(codename="change_post", content_type__app_label="insights")
    )
    client = client_for(viewer)
    draft = world["draft"]
    assert client.post(reverse("insights:post_action", args=[draft.pk, "submit"])).status_code == 302
    assert Post.objects.get(pk=draft.pk).status == PostStatus.IN_REVIEW
    # Approving needs insights.publish_post.
    assert client.post(reverse("insights:post_action", args=[draft.pk, "approve"])).status_code == 403
    viewer.user_permissions.add(Permission.objects.get(codename="publish_post"))
    client = client_for(type(viewer).objects.get(pk=viewer.pk))
    assert client.post(reverse("insights:post_action", args=[draft.pk, "approve"])).status_code == 302
    assert Post.objects.get(pk=draft.pk).status == PostStatus.APPROVED


def test_insights_nav_item_is_active(world, superadmin, client_for):
    body = client_for(superadmin).get(reverse("insights:posts")).content.decode()
    assert re.findall(r'aria-current="page" data-nav="([a-z_]+)"', body) == ["insights"]
    assert "Example post (fixture)" in body and "LIVE" in body


def test_posts_list_tabs_counts_and_search(world, superadmin, client_for):
    client = client_for(superadmin)
    body = client.get(reverse("insights:posts") + "?tab=drafts").content.decode()
    assert "Example draft (fixture)" in body and "Example post (fixture)" not in body
    body = client.get(reverse("insights:posts") + "?q=draft").content.decode()
    assert "Example draft (fixture)" in body and "Example post (fixture)" not in body
    body = client.get(
        reverse("insights:posts") + f"?author={world['author'].pk}&format=engineering_note"
    ).content.decode()
    assert "Example post (fixture)" in body
    body = client.get(reverse("insights:posts") + "?author=not-a-uuid").content.decode()
    assert "Example post (fixture)" in body


def test_new_post_flow(superadmin, client_for):
    client = client_for(superadmin)
    response = client.post(
        reverse("insights:post_new"), {"title": "Example new post (fixture)", "format": "guide"}
    )
    post = Post.objects.get(title="Example new post (fixture)")
    assert response["Location"] == reverse("insights:post", args=[post.pk])
    assert post.slug == "example-new-post-fixture" and post.status == PostStatus.DRAFT
    body = client.get(response["Location"]).content.decode()
    assert "insights-editor.js" in body and "data-md-editor" in body and "data-editable" in body


def _form_data(post, **changes):
    data = {
        "title": post.title,
        "excerpt": post.excerpt,
        "body_md": post.body_md,
        "format": post.format,
        "slug": post.slug,
        "practice": post.practice,
        "updated_at": post.updated_at.isoformat(),
        "author_1": str(post.author_links.first().author_id) if post.author_links.exists() else "",
    }
    data.update(changes)
    return data


def test_autosave_saves_and_detects_conflicts(world, superadmin, client_for):
    client = client_for(superadmin)
    draft = world["draft"]
    url = reverse("insights:post_autosave", args=[draft.pk])
    response = client.post(url, _form_data(draft, title="Example retitled (fixture)"))
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] and payload["savedAt"].startswith("SAVED ")
    assert Post.objects.get(pk=draft.pk).title == "Example retitled (fixture)"
    stale = client.post(url, _form_data(draft, title="Example stale (fixture)"))
    assert stale.status_code == 409 and stale.json()["message"] == "This post changed since you opened it."
    assert Post.objects.get(pk=draft.pk).title == "Example retitled (fixture)"
    forced = client.post(url, _form_data(draft, title="Example mine (fixture)", force="true"))
    assert forced.status_code == 200 and Post.objects.get(pk=draft.pk).title == "Example mine (fixture)"
    invalid = client.post(url, _form_data(Post.objects.get(pk=draft.pk), cta_href="https://example.test/"))
    assert invalid.status_code == 400 and "cta_href" in invalid.json()["errors"]
    # Autosaves are audited at most once per ten minutes per post and editor.
    assert AuditEvent.objects.filter(action="insights.post_edited", entity_id=str(draft.pk)).count() == 1


def test_full_save_without_javascript(world, superadmin, client_for):
    draft = world["draft"]
    response = client_for(superadmin).post(
        reverse("insights:post", args=[draft.pk]), _form_data(draft, excerpt="Example new excerpt (fixture).")
    )
    assert response.status_code == 302
    assert Post.objects.get(pk=draft.pk).excerpt == "Example new excerpt (fixture)."


def test_checks_through_the_rail(world, superadmin, client_for):
    client = client_for(superadmin)
    draft = world["draft"]
    response = client.post(reverse("insights:post_check", args=[draft.pk, "claims"]), {"checked": "1"}, **HX)
    assert response.status_code == 200 and 'aria-checked="true"' in response.content.decode()
    assert services.checks_for(draft)[1].done
    client.post(reverse("insights:post_check", args=[draft.pk, "claims"]), {"checked": "0"}, **HX)
    assert not services.checks_for(draft)[1].done


def test_publish_button_is_disabled_with_reasons(world, superadmin, client_for):
    client = client_for(superadmin)
    draft = world["draft"]
    services.submit_for_review(draft, superadmin)
    services.approve(draft, superadmin)
    body = client.get(reverse("insights:post", args=[draft.pk])).content.decode()
    assert 'data-testid="publish-blockers"' in body and "Tick the editorial checks" in body
    publish = re.search(r'<button[^>]*data-testid="publish"[^>]*>', body).group(0)
    assert "disabled" in publish
    response = client.post(reverse("insights:post_action", args=[draft.pk, "publish"]), follow=True)
    assert "Tick the editorial checks" in response.content.decode()
    assert Post.objects.get(pk=draft.pk).status == PostStatus.APPROVED


def test_schedule_through_the_view(world, superadmin, client_for):
    draft = world["draft"]
    services.submit_for_review(draft, superadmin)
    services.approve(draft, superadmin)
    tick_all(draft, superadmin)
    client = client_for(superadmin)
    client.post(
        reverse("insights:post_action", args=[draft.pk, "schedule"]), {"publish_at": "2099-01-02T09:30"}
    )
    draft.refresh_from_db()
    assert draft.status == PostStatus.SCHEDULED
    assert draft.publish_at.isoformat().startswith("2099-01-02T09:30")  # Europe/London is UTC in January
    body = client.get(reverse("insights:post", args=[draft.pk])).content.decode()
    assert "SCHEDULED · 2 JAN 2099 09:30" in body


def test_preview_panel_and_frame(world, superadmin, client_for, monkeypatch):
    client = client_for(superadmin)
    post = world["post"]
    panel = client.get(reverse("insights:post_preview_panel", args=[post.pk])).content.decode()
    assert "sandbox" in panel and "preview/frame/" in panel
    frame = client.get(reverse("insights:post_preview_frame", args=[post.pk]))
    policy = frame["Content-Security-Policy"]
    assert "sandbox" in policy and "script-src" not in policy and "default-src 'none'" in policy
    assert "style-src 'unsafe-inline'" in policy
    html = frame.content.decode()
    assert "<script" not in html and "Example body (fixture)." in html and "JetBrains Mono" in html
    assert frame["X-Frame-Options"] == "SAMEORIGIN"
    monkeypatch.setattr(
        render, "render", lambda markdown, context="post": render.RenderResult.unavailable("timeout")
    )
    panel = client.get(reverse("insights:post_preview_panel", args=[post.pk])).content.decode()
    assert "Preview unavailable. Your changes are saved." in panel and "<iframe" not in panel


def test_preview_panel_lists_blocking_warnings(world, superadmin, client_for, monkeypatch):
    warning = {"code": "h1_in_body", "message": "The body has an H1 heading.", "blocking": True}
    monkeypatch.setattr(
        render,
        "render",
        lambda markdown, context="post": render.RenderResult(True, "<p>x</p>", [], 0, [warning]),
    )
    panel = (
        client_for(superadmin)
        .get(reverse("insights:post_preview_panel", args=[world["post"].pk]))
        .content.decode()
    )
    assert "Blocks publishing" in panel and "The body has an H1 heading." in panel


def test_site_preview_redirects_with_a_fresh_token(world, superadmin, client_for, settings):
    client = client_for(superadmin)
    url = reverse("insights:post_site_preview", args=[world["draft"].pk])
    response = client.get(url)
    assert response.status_code == 302 and response["Location"] == reverse(
        "insights:post", args=[world["draft"].pk]
    )
    configure(settings, targets=(WEB,))
    response = client.get(url)
    assert response["Location"].startswith(f"{WEB}/api/content/preview?token=")
    token = response["Location"].split("token=", 1)[1]
    assert signing.verify_preview_token(token, "post", world["draft"].pk)["entity"] == "post"
    settings.CONTENT_PREVIEW_SECRET = ""
    assert client.get(url)["Location"] == reverse("insights:post", args=[world["draft"].pk])
    settings.CONTENT_PREVIEW_SECRET = PREVIEW_KEYS


def test_media_upload_requires_alt_text_and_a_real_image(world, superadmin, client_for):
    client = client_for(superadmin)
    url = reverse("insights:media_upload")
    image = SimpleUploadedFile("photo.png", png_bytes(1600, 900), content_type="image/png")
    assert client.post(url, {"image": image}).status_code == 400
    image = SimpleUploadedFile("photo.png", png_bytes(1600, 900), content_type="image/png")
    response = client.post(url, {"image": image, "alt": "Example [chart] (fixture)"})
    assert response.status_code == 201
    payload = response.json()
    assert payload["width"] == 1600 and payload["height"] == 900
    assert re.match(r"^https://media\.example\.test/content/[0-9a-f-]{36}\.png$", payload["url"])
    assert payload["markdown"] == f"![Example (chart) (fixture)]({payload['url']}#w=1600&h=900)"
    svg = SimpleUploadedFile(
        "x.svg", b"<svg xmlns='http://www.w3.org/2000/svg'><script/></svg>", content_type="image/svg+xml"
    )
    assert client.post(url, {"image": svg, "alt": "x"}).status_code == 400
    fake = SimpleUploadedFile("x.png", b"MZ\x90\x00not an image", content_type="image/png")
    assert client.post(url, {"image": fake, "alt": "x"}).status_code == 400


def test_cover_upload_and_removal(world, superadmin, client_for):
    client = client_for(superadmin)
    draft = world["draft"]
    url = reverse("insights:post_cover", args=[draft.pk])
    image = SimpleUploadedFile("cover.png", png_bytes(1600, 900), content_type="image/png")
    client.post(url, {"image": image, "alt": "Example cover (fixture)"})
    draft.refresh_from_db()
    assert (
        draft.cover_path.startswith("content/")
        and draft.cover_width == 1600
        and draft.cover_alt == "Example cover (fixture)"
    )
    assert "photo" not in draft.cover_path and "cover.png" not in draft.cover_path
    image = SimpleUploadedFile("cover.png", png_bytes(), content_type="image/png")
    response = client.post(url, {"image": image, "alt": ""}, follow=True)
    assert "describe it in the alt text" in response.content.decode()
    client.post(url, {"remove": "1"})
    draft.refresh_from_db()
    assert draft.cover_path == "" and draft.cover_width is None


def test_revision_view_and_restore(world, superadmin, client_for):
    client = client_for(superadmin)
    post, revision = world["post"], world["revision"]
    from .content_helpers import edit

    edit(post, superadmin, title="Example changed (fixture)")
    body = client.get(reverse("insights:revision", args=[post.pk, revision.pk])).content.decode()
    assert "Example changed (fixture)" in body and 'data-testid="diff"' in body
    client.post(reverse("insights:revision_restore", args=[post.pk, revision.pk]))
    assert Post.objects.get(pk=post.pk).title == "Example post (fixture)"
    assert client.get(reverse("insights:revision", args=[world["draft"].pk, revision.pk])).status_code == 404


def test_actions_unknown_and_published_archive_need_publish_permission(world, lead, client_for):
    client = client_for(lead)
    assert client.post(reverse("insights:post_action", args=[world["post"].pk, "explode"])).status_code in (
        403,
        404,
    )
    assert client.post(reverse("insights:post_action", args=[world["post"].pk, "archive"])).status_code == 403


def test_settings_page_saves_the_section_and_copy(world, superadmin, client_for):
    client = client_for(superadmin)
    response = client.post(
        reverse("insights:settings"),
        {
            "action": "section",
            "enabled": "on",
            "heading": "Example heading.",
            "intro": "Example intro.",
            "count": "2",
            "mode": "pinned",
        },
    )
    assert response.status_code == 302
    section = SiteSection.objects.get(key="home_insights")
    assert section.config == {
        "enabled": True,
        "heading": "Example heading.",
        "intro": "Example intro.",
        "count": 2,
        "mode": "pinned",
    }
    assert SyncEvent.objects.filter(action="home_section.updated").exists()
    assert AuditEvent.objects.filter(action="content.home_section_updated").exists()
    bad = client.post(
        reverse("insights:settings"),
        {"action": "section", "heading": "", "intro": "x", "count": "9", "mode": "latest"},
    )
    assert bad.status_code == 200 and SiteSection.objects.get(key="home_insights").config["count"] == 2
    client.post(
        reverse("insights:settings"),
        {"action": "copy", "heading": "Example H.", "intro": "Example I.", "editorial_note": "Example N."},
    )
    assert SiteSettings.load().insights_heading == "Example H."
    assert SyncEvent.objects.filter(action="site.updated", kind="publish").exists()
    preview = client.post(
        reverse("insights:settings_preview"),
        {"enabled": "on", "heading": "Live heading", "intro": "i", "count": "2", "mode": "latest"},
    )
    assert "Live heading" in preview.content.decode() and "Example post (fixture)" in preview.content.decode()


def test_site_state_page_is_superadmin_only_audited_and_emits(world, superadmin, lead, client_for):
    assert client_for(lead).get(reverse("content_settings:site")).status_code == 403
    client = client_for(superadmin)
    body = client.get(reverse("content_settings:site")).content.decode()
    assert "Website content" in body
    client.post(reverse("content_settings:site"), {"insights_open": "on"})
    site = SiteSettings.load()
    assert site.insights_open and not site.careers_open
    assert AuditEvent.objects.filter(action="content.site_opened").exists()
    event = SyncEvent.objects.filter(action="site.opened").get()
    assert "site" in event.tags and "/" in event.paths
    client.post(reverse("content_settings:site"), {})
    assert not SiteSettings.load().insights_open
    assert SyncEvent.objects.filter(action="site.closed", kind="remove").exists()


def test_sync_page_retry_and_resync(world, superadmin, viewer, client_for, settings, monkeypatch):
    from apps.content_sync import sync

    configure(settings, targets=(WEB,))
    monkeypatch.setattr(sync, "http_post", lambda *args, **kwargs: 503)
    with __import__("django").db.transaction.atomic():
        event = sync.emit("site", "", "site.resync", "Example failing event", deliver=False)
    sync.deliver(event.pk)
    client = client_for(superadmin)
    body = client.get(reverse("content_sync:sync")).content.decode()
    assert "Example failing event" in body and "http_503" in body and 'hx-trigger="every 5s"' in body
    assert client_for(viewer).post(reverse("content_sync:retry", args=[event.pk])).status_code == 403
    monkeypatch.setattr(sync, "http_post", lambda *args, **kwargs: 200)
    client.post(reverse("content_sync:retry", args=[event.pk]))
    event.refresh_from_db()
    assert event.delivered_at is not None
    assert AuditEvent.objects.filter(action="content.sync_retried").exists()
    client.post(reverse("content_sync:resync"))
    assert SyncEvent.objects.filter(action="site.resync").count() == 2
    assert AuditEvent.objects.filter(action="content.resynced").exists()
    sync.deliver_due()
    overall = client.get(reverse("content_sync:overall")).content.decode()
    assert "SITE IN SYNC" in overall


def test_post_ids_from_the_client_are_checked(world, superadmin, client_for):
    client = client_for(superadmin)
    missing = uuid.uuid4()
    assert client.get(reverse("insights:post", args=[missing])).status_code == 404
    other = make_post("Example other (fixture)", superadmin)
    data = _form_data(world["draft"], related_1=str(world["draft"].pk), author_1=str(uuid.uuid4()))
    response = client.post(reverse("insights:post_autosave", args=[world["draft"].pk]), data)
    assert response.status_code == 400  # unknown author id is not a valid choice
    data = _form_data(world["draft"], related_1=str(other.pk))
    response = client.post(reverse("insights:post_autosave", args=[world["draft"].pk]), data)
    assert response.status_code == 400  # an unpublished post is not a valid related choice
    assert json.loads(response.content)["errors"]


def test_authors_and_topics_ui(world, superadmin, client_for):
    client = client_for(superadmin)
    response = client.post(
        reverse("insights:author_new"),
        {"name": "Example New Author", "linkedin_url": "https://www.linkedin.com/in/example"},
    )
    author = Author.objects.get(name="Example New Author")
    assert response["Location"] == reverse("insights:author", args=[author.pk]) and not author.is_confirmed
    bad = client.post(
        reverse("insights:author_new"), {"name": "Example Bad", "linkedin_url": "http://example.test"}
    )
    assert bad.status_code == 200 and not Author.objects.filter(name="Example Bad").exists()
    client.post(reverse("insights:author_action", args=[author.pk, "confirm"]))
    author.refresh_from_db()
    assert author.confirmed_real_by == superadmin and author.confirmed_real_at
    body = client.get(reverse("insights:author", args=[author.pk])).content.decode()
    assert "admin@example.test" in body
    client.post(reverse("insights:topics"), {"name": "Example Topic", "kind": "topic"})
    assert Topic.objects.filter(slug="example-topic", is_seeded=False).exists()
