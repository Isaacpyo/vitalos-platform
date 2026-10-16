"""Insights workflow (brief 4.5, 7.2): editorial checks per revision hash, publish gating, slugs and
redirects, revisions, scheduling and the Phase 2 acceptance scenario."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.utils import timezone

from apps.audit.models import AuditEvent
from apps.content_sync import render
from apps.content_sync.models import SlugRedirect, SyncEvent
from apps.insights import public, services
from apps.insights.models import CheckKey, EditorialCheck, Post, PostRevision, PostStatus

from .content_helpers import configure, edit, make_author, make_post, ok_render, publish_post, tick_all, topic

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


def test_acceptance_draft_to_review_to_approved_to_published_with_every_check_recorded(superadmin):
    author = make_author("Example Author", actor=superadmin)
    post = make_post("Example post (fixture)", superadmin, authors=[author], topics=[topic()])
    assert post.status == PostStatus.DRAFT

    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    post.refresh_from_db()
    assert post.status == PostStatus.APPROVED
    with pytest.raises(ValidationError, match="editorial checks"):
        services.publish(post, superadmin)

    tick_all(post, superadmin)
    current = services.revision_hash(post)
    checks = EditorialCheck.objects.filter(post=post, revision_hash=current)
    assert sorted(checks.values_list("check_key", flat=True)) == sorted(CheckKey.values)
    assert all(check.checked_by == superadmin and check.checked_at for check in checks)

    post = services.publish(post, superadmin)
    assert post.status == PostStatus.PUBLISHED
    assert post.published_snapshot["title"] == "Example post (fixture)"
    assert post.published_slug == post.slug
    revision = PostRevision.objects.get(post=post)
    assert revision.revision_hash == current and revision.published_by == superadmin
    assert post.published_revision == revision
    actions = list(AuditEvent.objects.filter(entity_id=str(post.pk)).values_list("action", flat=True))
    for action in (
        "insights.post_submitted",
        "insights.post_approved",
        "insights.check_ticked",
        "insights.post_published",
    ):
        assert action in actions
    assert AuditEvent.objects.filter(action="insights.check_ticked", entity_id=str(post.pk)).count() == 5
    event = SyncEvent.objects.get(entity="post", entity_id=str(post.pk))
    assert event.action == "post.published" and event.kind == "publish"
    assert f"insights:post:{post.slug}" in event.tags and f"insights:author:{author.slug}" in event.tags
    assert "insights:topic:ai-and-agents" in event.tags
    assert f"/insights/{post.slug}" in event.paths


def test_editing_after_ticking_checks_invalidates_them(superadmin):
    author = make_author(actor=superadmin)
    post = make_post("Example post (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    tick_all(post, superadmin)
    assert all(state.done for state in services.checks_for(post))
    post = edit(post, superadmin, body_md="## Example heading\n\nChanged paragraph (fixture).\n")
    assert not any(state.done for state in services.checks_for(post))
    with pytest.raises(ValidationError):
        services.publish(post, superadmin)
    # Material update and the published-snapshot flags are not part of the hash.
    tick_all(post, superadmin)
    post = edit(post, superadmin, material_update=True)
    assert all(state.done for state in services.checks_for(post))


def test_unconfirmed_author_blocks_publishing_and_the_authors_check(superadmin):
    author = make_author("Example Unconfirmed", confirmed=False)
    post = make_post("Example post (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    with pytest.raises(ValidationError, match="real person"):
        services.tick_check(post, CheckKey.AUTHORS, superadmin)
    for key in CheckKey.values:
        if key != CheckKey.AUTHORS:
            services.tick_check(post, key, superadmin)
    blockers = services.publish_blockers(post, render_result=ok_render())
    assert any("Example Unconfirmed" in blocker for blocker in blockers)
    with pytest.raises(ValidationError):
        services.publish(post, superadmin)


def test_post_without_author_cannot_publish(superadmin):
    post = make_post("Example post (fixture)", superadmin)
    blockers = services.publish_blockers(post, render_result=ok_render())
    assert "Assign at least one named author." in blockers


def test_blocking_render_warning_blocks_publish(superadmin, monkeypatch):
    author = make_author(actor=superadmin)
    post = make_post("Example post (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    tick_all(post, superadmin)

    def warned(markdown, context="post"):
        warning = {"code": "missing_alt", "message": "An image has no alt text.", "blocking": True}
        return render.RenderResult(True, "<p>x</p>", [], 0, [warning])

    monkeypatch.setattr(render, "render", warned)
    with pytest.raises(ValidationError, match="An image has no alt text"):
        services.publish(post, superadmin)

    def note_only(markdown, context="post"):
        warning = {"code": "heading_level", "message": "A heading level is skipped.", "blocking": False}
        return render.RenderResult(True, "<p>x</p>", [], 0, [warning])

    monkeypatch.setattr(render, "render", note_only)
    assert services.publish(post, superadmin).status == PostStatus.PUBLISHED


def test_unavailable_renderer_blocks_publish(superadmin, monkeypatch):
    author = make_author(actor=superadmin)
    post = make_post("Example post (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    tick_all(post, superadmin)
    monkeypatch.setattr(
        render, "render", lambda markdown, context="post": render.RenderResult.unavailable("timeout")
    )
    with pytest.raises(ValidationError, match="renderer is unavailable"):
        services.publish(post, superadmin)


def test_workflow_refuses_out_of_order_transitions(superadmin):
    post = make_post("Example post (fixture)", superadmin, authors=[make_author(actor=superadmin)])
    with pytest.raises(ValidationError):
        services.approve(post, superadmin)
    with pytest.raises(ValidationError):
        services.publish(post, superadmin)
    with pytest.raises(ValidationError):
        services.unpublish(post, superadmin)
    services.submit_for_review(post, superadmin)
    services.return_to_draft(post, superadmin)
    assert Post.objects.get(pk=post.pk).status == PostStatus.DRAFT


def test_publish_changes_replaces_the_snapshot_and_keeps_edits_private_until_then(superadmin):
    author = make_author(actor=superadmin)
    post = publish_post("Example post (fixture)", superadmin, authors=[author])
    post = edit(post, superadmin, title="Example post, revised (fixture)")
    assert post.has_unpublished_changes
    assert post.published_snapshot["title"] == "Example post (fixture)"
    with pytest.raises(ValidationError):
        services.publish(post, superadmin)
    tick_all(post, superadmin)
    post = services.publish(post, superadmin)
    assert post.published_snapshot["title"] == "Example post, revised (fixture)"
    assert not post.has_unpublished_changes
    assert PostRevision.objects.filter(post=post).count() == 2
    assert SyncEvent.objects.filter(entity_id=str(post.pk), action="post.changes_published").exists()


def test_material_update_sets_the_public_updated_date_once(superadmin):
    post = publish_post("Example post (fixture)", superadmin, authors=[make_author(actor=superadmin)])
    assert post.published_snapshot["updatedAt"] is None
    post = edit(post, superadmin, body_md="## Example\n\nRevised (fixture).\n", material_update=True)
    tick_all(post, superadmin)
    post = services.publish(post, superadmin)
    assert post.published_snapshot["updatedAt"] is not None
    assert post.material_update is False


def test_slug_change_of_a_published_post_creates_a_redirect_on_publish(superadmin):
    post = publish_post("Example post (fixture)", superadmin, authors=[make_author(actor=superadmin)])
    old = post.slug
    post = edit(post, superadmin, slug="example-post-renamed")
    assert any("will redirect" in note for note in services.slug_notes(post))
    assert not SlugRedirect.objects.filter(from_slug=old).exists()  # nothing changes until publish
    tick_all(post, superadmin)
    post = services.publish(post, superadmin)
    redirect = SlugRedirect.objects.get(entity="post", from_slug=old)
    assert redirect.to_id == post.pk
    assert post.published_slug == "example-post-renamed"
    event = SyncEvent.objects.get(entity_id=str(post.pk), action="post.slug_changed")
    assert f"insights:post:{old}" in event.tags and "insights:post:example-post-renamed" in event.tags
    assert f"/insights/{old}" in event.paths
    catalogue = public.Catalogue()
    assert public.post_detail(catalogue, old) == {"redirect": "example-post-renamed"}
    assert public.post_detail(catalogue, "example-post-renamed")["slug"] == "example-post-renamed"


def test_reusing_a_slug_held_by_a_redirect_replaces_the_redirect(superadmin):
    author = make_author(actor=superadmin)
    first = publish_post("Example first (fixture)", superadmin, authors=[author], slug="example-first")
    first = edit(first, superadmin, slug="example-first-moved")
    tick_all(first, superadmin)
    services.publish(first, superadmin)
    assert SlugRedirect.objects.filter(from_slug="example-first").exists()
    second = make_post("Example second (fixture)", superadmin, authors=[author], slug="example-first")
    assert any("redirects to another post" in note for note in services.slug_notes(second))
    services.submit_for_review(second, superadmin)
    services.approve(second, superadmin)
    tick_all(second, superadmin)
    services.publish(Post.objects.get(pk=second.pk), superadmin)
    assert not SlugRedirect.objects.filter(from_slug="example-first").exists()


def test_slug_validation(superadmin):
    author = make_author(actor=superadmin)
    publish_post("Example post (fixture)", superadmin, authors=[author], slug="example-taken")
    other = make_post("Example other (fixture)", superadmin, authors=[author])
    with pytest.raises(ValidationError):
        edit(other, superadmin, slug="example-taken")
    with pytest.raises(ValidationError):
        edit(other, superadmin, slug="Not A Slug")


def test_cta_and_canonical_rules(superadmin):
    post = make_post("Example post (fixture)", superadmin)
    for href in ("/contact", "https://vitalos.co.uk/contact", "https://www.vitalos.co.uk/x", ""):
        assert services.cta_problem(href) == ""
    for href in (
        "https://evil.example.test",
        "http://vitalos.co.uk",
        "//vitalos.co.uk",
        "javascript:alert(1)",
    ):
        assert services.cta_problem(href)
    with pytest.raises(ValidationError):
        edit(post, superadmin, cta_href="https://example.test/")
    with pytest.raises(ValidationError):
        edit(post, superadmin, canonical_url="http://example.test/")


def test_unpublish_and_archive_take_the_post_off_the_site(superadmin):
    author = make_author(actor=superadmin)
    post = publish_post("Example post (fixture)", superadmin, authors=[author])
    post = services.unpublish(post, superadmin)
    assert post.status == PostStatus.DRAFT and post.published_snapshot is None
    assert SyncEvent.objects.filter(entity_id=str(post.pk), action="post.unpublished", kind="remove").exists()
    assert public.post_detail(public.Catalogue(), post.slug) is None

    other = publish_post("Example other (fixture)", superadmin, authors=[author])
    other = services.archive(other, superadmin)
    assert other.status == PostStatus.ARCHIVED and other.published_snapshot is None
    assert SyncEvent.objects.filter(entity_id=str(other.pk), action="post.archived").exists()
    services.restore(other, superadmin)
    assert Post.objects.get(pk=other.pk).status == PostStatus.DRAFT


def test_archiving_a_never_published_draft_emits_nothing(superadmin):
    post = make_post("Example post (fixture)", superadmin)
    services.archive(post, superadmin)
    assert not SyncEvent.objects.filter(entity_id=str(post.pk)).exists()


def test_delete_only_for_never_published_posts(superadmin):
    author = make_author(actor=superadmin)
    draft = make_post("Example draft (fixture)", superadmin, authors=[author])
    services.delete(draft, superadmin)
    assert not Post.objects.filter(pk=draft.pk).exists()
    assert AuditEvent.objects.filter(action="insights.post_deleted", entity_id=str(draft.pk)).exists()
    published = publish_post("Example post (fixture)", superadmin, authors=[author])
    services.unpublish(published, superadmin)
    with pytest.raises(ValidationError, match="never published"):
        services.delete(Post.objects.get(pk=published.pk), superadmin)


def test_revisions_are_immutable_and_restore_into_the_working_copy(superadmin):
    author = make_author(actor=superadmin)
    post = publish_post("Example post (fixture)", superadmin, authors=[author])
    revision = PostRevision.objects.get(post=post)
    revision.note = "changed"
    with pytest.raises(Exception, match="immutable"):
        revision.save()
    with pytest.raises(Exception, match="immutable"):
        revision.delete()
    with pytest.raises(Exception, match="immutable"):
        PostRevision.objects.filter(pk=revision.pk).update(note="x")
    post = edit(post, superadmin, title="Example retitled (fixture)", body_md="Different body (fixture).")
    lines = services.diff(revision, post)
    assert not lines[0]["same"] and not lines[2]["same"]
    post = services.restore_revision(post, revision, superadmin)
    assert post.title == "Example post (fixture)"
    assert post.status == PostStatus.PUBLISHED
    assert post.published_snapshot["title"] == "Example post (fixture)"
    assert not post.has_unpublished_changes


def test_conflict_detection_by_updated_at(superadmin):
    post = make_post("Example post (fixture)", superadmin)
    stale = post.updated_at - timedelta(seconds=5)
    data = {name: getattr(post, name) for name in services.WORKING_FIELDS}
    with pytest.raises(services.Conflict):
        services.save_working_copy(post, data, actor=superadmin, expected_updated_at=stale)
    saved = services.save_working_copy(post, data, actor=superadmin, expected_updated_at=post.updated_at)
    assert saved.updated_at > post.updated_at


def test_schedule_freezes_a_checked_snapshot_and_the_query_filter_serves_it_when_due(superadmin):
    author = make_author(actor=superadmin)
    post = make_post("Example scheduled (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    with pytest.raises(ValidationError):
        services.schedule(post, superadmin, timezone.now() + timedelta(hours=1))
    tick_all(post, superadmin)
    with pytest.raises(ValidationError, match="future"):
        services.schedule(post, superadmin, timezone.now() - timedelta(minutes=1))
    post = services.schedule(post, superadmin, timezone.now() + timedelta(hours=1))
    assert post.status == PostStatus.SCHEDULED and post.published_snapshot
    assert public.post_detail(public.Catalogue(), post.slug) is None
    Post.objects.filter(pk=post.pk).update(publish_at=timezone.now() - timedelta(seconds=1))
    assert public.post_detail(public.Catalogue(), post.slug)["title"] == "Example scheduled (fixture)"
    services.unschedule(Post.objects.get(pk=post.pk), superadmin)
    post.refresh_from_db()
    assert post.status == PostStatus.APPROVED and post.published_slug == "" and services.can_delete(post)


def test_duplicate_creates_an_unpublished_copy(superadmin):
    author = make_author(actor=superadmin)
    post = publish_post("Example post (fixture)", superadmin, authors=[author], topics=[topic()])
    clone = services.duplicate(post, superadmin)
    assert clone.status == PostStatus.DRAFT and clone.slug != post.slug
    assert clone.published_snapshot is None and services.author_ids(clone) == [str(author.pk)]


@pytest.mark.parametrize("reserved", ["page", "authors", "topics", "feed"])
def test_reserved_post_slugs_are_refused_and_skipped(superadmin, reserved):
    post = services.create_post(title=reserved.title(), format="guide", actor=superadmin)
    assert post.slug == f"{reserved}-2"
    with pytest.raises(ValidationError, match="reserved"):
        edit(post, superadmin, slug=reserved)


def test_scheduling_and_unscheduling_refresh_the_site_state_for_the_website_tick(superadmin):
    """ADR-042: the website's tick reads nextDueAt from its cached site state, so scheduling must
    revalidate the `site` tag; otherwise a scheduled post would wait for the cache TTL."""
    from apps.content_sync.models import SyncEvent

    author = make_author(actor=superadmin)
    post = make_post("Example scheduled event (fixture)", superadmin, authors=[author])
    services.submit_for_review(post, superadmin)
    services.approve(post, superadmin)
    tick_all(post, superadmin)
    services.schedule(post, superadmin, timezone.now() + timedelta(hours=1))
    scheduled = SyncEvent.objects.get(action="post.scheduled")
    assert scheduled.tags == ["site"] and scheduled.paths == [] and scheduled.kind == "publish"
    services.unschedule(Post.objects.get(pk=post.pk), superadmin)
    assert SyncEvent.objects.get(action="post.unscheduled").tags == ["site"]


def test_the_summary_is_the_seo_description_or_the_opening_paragraph():
    body = (
        "## Example heading\n\n"
        "Example **opening** paragraph with [a link](/work).[^1]\n\n"
        "- Example list item\n"
    )
    assert services.derive_excerpt("", body) == "Example opening paragraph with a link."
    assert services.derive_excerpt("  Example SEO   text. ", body) == "Example SEO text."
    long = services.derive_excerpt("", "word " * 100)
    assert len(long) <= 220 and long.endswith("…") and not long.endswith(" …")
    assert services.derive_excerpt("", "## Only a heading\n\n- and a list") == ""
