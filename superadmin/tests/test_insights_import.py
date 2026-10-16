"""manage.py import_insights_batch: dry run, apply, reruns, whole-run failures, backdated dates and the
organisation author, against the fictional batch in tests/fixtures/insights_batch."""

import io
import shutil
from pathlib import Path

import pytest
from django.core.management import CommandError, call_command
from django.test import Client

from apps.audit.models import AuditEvent
from apps.content_sync import render
from apps.content_sync.models import SiteSettings, SyncEvent
from apps.insights import importing, services
from apps.insights.models import Author, AuthorKind, CheckKey, EditorialCheck, Post, PostRevision, PostStatus

from .content_helpers import (
    Contract,
    configure,
    ok_render,
    open_site,
    publish_post,
    response_json,
    signed_get,
)

pytestmark = pytest.mark.django_db

FIXTURE = Path(__file__).parent / "fixtures" / "insights_batch"
SLUGS = ["example-first-post", "example-second-post", "example-third-post"]


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


@pytest.fixture
def batch(tmp_path) -> Path:
    folder = tmp_path / "batch"
    shutil.copytree(FIXTURE, folder)
    return folder


def run(folder, *args, user="admin@example.test") -> str:
    out = io.StringIO()
    call_command(
        "import_insights_batch", str(folder), "--as-user", user, *args, stdout=out, stderr=io.StringIO()
    )
    return out.getvalue()


def counts() -> dict:
    return {
        "posts": Post.objects.count(),
        "revisions": PostRevision.objects.count(),
        "events": SyncEvent.objects.count(),
        "checks": EditorialCheck.objects.count(),
        "audit": AuditEvent.objects.count(),
    }


def test_dry_run_validates_everything_and_writes_nothing(superadmin, batch):
    before = counts()
    output = run(batch)
    assert counts() == before
    assert not Author.objects.filter(slug="vitalos").exists()
    for slug in SLUGS:
        assert f"| {slug} |" in output
    assert "create and publish" in output
    assert "example keyword two" in output
    assert "Dry run (use --apply to write): 3 posts" in output
    assert not (batch / "IMPORT-REPORT.md").exists()


def test_apply_publishes_each_post_through_the_workflow_as_the_given_user(superadmin, batch):
    output = run(batch, "--apply")
    author = Author.objects.get(slug="vitalos")
    assert author.kind == AuthorKind.ORGANISATION
    assert (author.name, author.role_title, author.is_active) == ("Vitalos", "Vitalos Insights", True)
    assert author.bio_md.startswith("Vitalos is a UK technology consulting")
    assert author.confirmed_real_by == superadmin and author.confirmed_real_at is not None

    posts = {post.slug: post for post in Post.objects.all()}
    assert sorted(posts) == SLUGS
    second = posts["example-second-post"]
    assert second.status == PostStatus.PUBLISHED
    assert (second.format, second.practice, second.featured) == ("guide", "ai_data", True)
    assert second.excerpt == "Example excerpt for the second fixture post. It is not real content."
    assert second.seo_title == "Example second post SEO title"
    assert (second.cta_label, second.cta_href) == ("Talk to Vitalos", "/contact")
    assert second.body_md.startswith("Example opening paragraph that links")
    assert "---" not in second.body_md.splitlines()[0]
    assert sorted(t.slug for t in second.topics.all()) == [
        "data",
        "digital-transformation",
        "growth-and-technology",
        "retail-commerce-and-consumer",
    ]
    assert services.author_ids(second) == [str(author.pk)]
    assert second.reading_minutes >= 1

    for post in posts.values():
        assert post.revisions.count() == 1
        assert post.published_revision.published_by == superadmin
        assert post.published_snapshot["authors"][0]["kind"] == "organisation"
        checks = EditorialCheck.objects.filter(post=post, revision_hash=post.published_hash)
        assert sorted(checks.values_list("check_key", flat=True)) == sorted(CheckKey.values)
        assert {check.checked_by for check in checks} == {superadmin}
        assert (
            SyncEvent.objects.filter(entity="post", entity_id=str(post.pk), action="post.published").count()
            == 1
        )

    published = AuditEvent.objects.filter(action="insights.post_published", entity_id=str(second.pk)).get()
    assert published.actor == superadmin
    assert published.metadata["via"] == importing.VIA
    ticked = AuditEvent.objects.filter(action="insights.check_ticked", entity_id=str(second.pk)).first()
    assert ticked.metadata["note"] == importing.CHECK_NOTE
    batch_row = AuditEvent.objects.get(action="insights.batch_imported")
    assert batch_row.actor == superadmin and batch_row.metadata["via"] == importing.VIA

    report = (batch / "IMPORT-REPORT.md").read_text(encoding="utf-8")
    assert report in output
    event = SyncEvent.objects.get(entity_id=str(second.pk), action="post.published")
    assert f"| {second.published_revision_id} | {event.pk} | example keyword two |" in report


def test_rerun_without_changes_changes_nothing(superadmin, batch):
    run(batch, "--apply")
    before = counts()
    output = run(batch, "--apply")
    assert counts() == before
    assert "unchanged: 3" in output


def test_rerun_after_an_edit_publishes_only_that_post(superadmin, batch):
    run(batch, "--apply")
    path = batch / "02-example-second-post.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            "Example paragraph (fixture).", "Example paragraph, corrected (fixture)."
        ),
        encoding="utf-8",
    )
    before = counts()
    output = run(batch, "--apply")
    assert "publish changes: 1" in output and "unchanged: 2" in output
    post = Post.objects.get(slug="example-second-post")
    assert post.revisions.count() == 2
    assert "corrected" in post.published_snapshot["bodyMarkdown"]
    assert SyncEvent.objects.filter(entity_id=str(post.pk), action="post.changes_published").count() == 1
    assert counts()["posts"] == before["posts"]
    # Still the original date: a correction is not a new publication.
    assert post.first_published_at.isoformat() == "2026-01-13T09:00:00+00:00"
    assert post.public_updated_at is None


@pytest.mark.parametrize(
    "change, problem",
    [
        (
            ("topics: [Data, Digital transformation]", "topics: [Data, Quantum gardening]"),
            "'Quantum gardening' does not exist",
        ),
        (
            ('sectors: ["Retail, Commerce & Consumer", Growth & Technology]', "sectors: [Retail]"),
            "sector 'Retail' does not exist",
        ),
        (("format: Guide", "format: Listicle"), "format 'Listicle'"),
        (("practice: AI & Data", "practice: Data science"), "practice 'Data science'"),
        (("/insights/example-first-post", "/insights/no-such-post"), "does not point to a post"),
        (("Example paragraph (fixture).", "Example <b>bold</b> paragraph."), "raw HTML"),
        (("## Example heading", "# Example heading"), "level 1 heading"),
        (
            ("Example paragraph (fixture).", "See [this](http://example.test/plain)."),
            "is not an https:// link",
        ),
        (("cta_href: /contact", "cta_href: https://example.test/contact"), "must be an internal path"),
        (
            ('seo_title: "Example second post SEO title"', 'seo_title: "' + "x" * 61 + '"'),
            "seo_title is 61 characters",
        ),
        (("slug: example-second-post", "slug: example-first-post"), "file name does not match"),
        (("authors: [Vitalos]", "authors: [Example Person]"), "authors must be [Vitalos]"),
        (("publish_date: 2026-01-13", "publish_date: 2099-01-13"), "in the future"),
    ],
)
def test_any_problem_fails_the_whole_run_before_any_write(superadmin, batch, change, problem):
    path = batch / "02-example-second-post.md"
    text = path.read_text(encoding="utf-8")
    assert change[0] in text
    path.write_text(text.replace(change[0], change[1]), encoding="utf-8")
    before = counts()
    with pytest.raises(CommandError) as raised:
        run(batch, "--apply")
    assert problem in str(raised.value)
    assert "Nothing was imported" in str(raised.value)
    assert counts() == before
    assert not Author.objects.filter(slug="vitalos").exists()


def test_publishing_fails_closed_when_the_renderer_is_unreachable(superadmin, batch, monkeypatch):
    monkeypatch.setattr(
        render, "render", lambda markdown, context="post": render.RenderResult.unavailable("no_target")
    )
    before = counts()
    with pytest.raises(CommandError, match="renderer is unreachable"):
        run(batch, "--apply")
    assert counts() == before
    # A dry run still checks everything else, and says the bodies were not rendered.
    assert "bodies were not rendered" in run(batch)


def test_blocking_render_warnings_fail_the_run(superadmin, batch, monkeypatch):
    def warned(markdown, context="post"):
        return render.RenderResult(
            True,
            "<p></p>",
            [],
            0,
            [{"code": "missing_alt", "message": "Image 1 has no alt text.", "blocking": True}],
        )

    monkeypatch.setattr(render, "render", warned)
    with pytest.raises(CommandError, match="Image 1 has no alt text"):
        run(batch)


def test_draft_status_creates_working_copies_only(superadmin, batch):
    run(batch, "--apply", "--status", "draft")
    assert Post.objects.filter(status=PostStatus.DRAFT).count() == 3
    assert PostRevision.objects.count() == 0
    assert not SyncEvent.objects.filter(entity="post").exists()
    # Publishing the same folder later takes the drafts through review to published.
    output = run(batch, "--apply")
    assert "publish: 3" in output
    assert Post.objects.filter(status=PostStatus.PUBLISHED).count() == 3


def test_links_to_an_already_published_post_are_accepted(superadmin, batch):
    from .content_helpers import make_author, topic

    publish_post(
        "Introducing Example (fixture)",
        superadmin,
        authors=[make_author(actor=superadmin)],
        topics=[topic()],
        slug="introducing-example",
    )
    path = batch / "01-example-first-post.md"
    path.write_text(
        path.read_text(encoding="utf-8").replace(
            "[source](https://example.test/source)", "[launch](/insights/introducing-example)"
        ),
        encoding="utf-8",
    )
    assert "create and publish: 3" in run(batch)


def test_unknown_user_or_one_who_cannot_publish_is_refused(superadmin, viewer, batch):
    with pytest.raises(CommandError, match="No active admin user"):
        run(batch, user="nobody@example.test")
    with pytest.raises(CommandError, match="may not publish"):
        run(batch, user=viewer.email)


def test_backdated_dates_appear_in_the_read_api_feed_and_sitemap(superadmin, batch, settings):
    configure(settings, targets=())
    open_site()
    run(batch, "--apply")
    client = Client()
    contract = Contract()

    detail = response_json(signed_get(client, "/api/content/v1/insights/posts/example-first-post"))
    contract.component("PostDetail").validate(detail)
    # 17 September 2025 is BST: 09:00 London is 08:00 UTC.
    assert detail["publishedAt"]["iso"] == "2025-09-17T08:00:00Z"
    assert detail["publishedAt"]["long"] == "17 September 2025"
    assert detail["updatedAt"] is None
    assert detail["lastModified"] == "2025-09-17T08:00:00Z"
    assert detail["authors"][0]["kind"] == "organisation"
    assert detail["authors"][0]["name"] == "Vitalos"

    winter = Post.objects.get(slug="example-second-post")
    assert (
        winter.publish_at.isoformat() == winter.first_published_at.isoformat() == "2026-01-13T09:00:00+00:00"
    )
    assert winter.last_published_at == winter.first_published_at == winter.published_revision.published_at

    feed = response_json(signed_get(client, "/api/content/v1/insights/feed"))
    assert [item["slug"] for item in feed["items"]] == list(reversed(SLUGS))
    assert [item["publishedAt"]["iso"][:10] for item in feed["items"]] == [
        "2026-06-16",
        "2026-01-13",
        "2025-09-17",
    ]

    posts = response_json(signed_get(client, "/api/content/v1/insights/posts"))
    assert posts["featured"]["slug"] == "example-second-post"

    sitemap = response_json(signed_get(client, "/api/content/v1/sitemap"))
    entries = {entry["path"]: entry["lastModified"] for entry in sitemap["entries"]}
    assert entries["/insights/example-first-post"] == "2025-09-17T08:00:00Z"
    assert entries["/insights/example-third-post"] == "2026-06-16T08:00:00Z"
    assert entries["/insights/authors/vitalos"] == "2026-06-16T08:00:00Z"

    author = response_json(signed_get(client, "/api/content/v1/insights/authors/vitalos"))
    assert author["author"]["kind"] == "organisation"
    assert len(author["posts"]) == 3


def test_site_state_carries_the_organisation_editorial_note(superadmin, client):
    state = response_json(signed_get(Client(), "/api/content/v1/site-state"))
    Contract().component("SiteState").validate(state)
    assert state["insights"]["organisationEditorialNote"].startswith(
        "Vitalos Insights are written and reviewed by the Vitalos team"
    )
    assert state["insights"]["editorialNote"] == SiteSettings.load().insights_editorial_note


REAL_BATCH = Path(__file__).resolve().parents[1] / "apps" / "insights" / "imports" / "insights-batch-2"
DOCS_BATCH = Path(__file__).resolve().parents[2] / "docs" / "content" / "imports" / "insights-batch-2"


def test_the_real_batch_validates(superadmin):
    """The approved batch passes every check (dry run, nothing written)."""
    items = importing.load(REAL_BATCH)
    assert len(items) == 20
    assert importing.plan(items, PostStatus.PUBLISHED) == []
    assert items[0].slug == "agent-washing-how-to-spot-a-real-ai-agent"
    assert items[-1].slug == "cyber-security-and-resilience-bill-managed-service-providers"
    assert sum(item.featured for item in items) == 1


def test_the_vendored_batch_matches_the_docs_copy():
    """The image only holds superadmin/, so the batch is copied there; the copy must not drift."""
    if not DOCS_BATCH.is_dir():
        pytest.skip("docs/ is not in this checkout (container build).")
    names = sorted(path.name for path in DOCS_BATCH.glob("*.md") if path.name != "IMPORT-REPORT.md")
    assert names == sorted(path.name for path in REAL_BATCH.glob("*.md") if path.name != "IMPORT-REPORT.md")
    for name in names:
        assert (DOCS_BATCH / name).read_bytes() == (REAL_BATCH / name).read_bytes(), name
