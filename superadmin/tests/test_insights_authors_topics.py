"""Authors, topics, seeds and image handling (brief 7.3, 4.3)."""

import pytest
from django.core.exceptions import ValidationError

from apps.careers import config as careers_config
from apps.content_sync import copy, media, render, sections
from apps.content_sync.models import SiteSection, SiteSettings, SlugRedirect, SyncEvent
from apps.insights import taxonomy
from apps.insights.models import Topic

from .content_helpers import (
    avif_bytes,
    configure,
    jpeg_bytes,
    make_author,
    make_post,
    ok_render,
    png_bytes,
    publish_post,
    webp_bytes,
)

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _setup(settings, monkeypatch):
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)


def test_seeds_hold_only_the_approved_copy_and_everything_starts_closed():
    names = list(Topic.objects.order_by("sort").values_list("name", "kind"))
    assert names == [
        ("AI and agents", "topic"),
        ("Digital transformation", "topic"),
        ("Software and platforms", "topic"),
        ("Data", "topic"),
        ("Cloud and reliability", "topic"),
        ("Experience and commerce", "topic"),
        ("Health & Care", "sector"),
        ("Retail, Commerce & Consumer", "sector"),
        ("Operations, Industry & Logistics", "sector"),
        ("Growth & Technology", "sector"),
    ]
    assert all(Topic.objects.values_list("is_seeded", flat=True))
    assert not Topic.objects.exclude(description="").exists()
    site = SiteSettings.load()
    assert not site.insights_open and not site.careers_open
    assert (
        site.insights_heading == copy.INSIGHTS_HEADING and site.insights_editorial_note == copy.EDITORIAL_NOTE
    )
    config = careers_config.load()
    assert config["heading"] == "Build what you advise." and config["values"][0] == "Ownership"
    assert config["benefits"] == config["process"] == config["salary_policy"] == ""
    # Owner approvals of 16 Oct 2026 (careers migrations 0004 and 0005).
    assert config["equal_opportunities"].startswith("Vitalos welcomes applications from everyone.")
    assert config["privacy_notice_url"] == "/legal/candidate-privacy"
    # CAR-01 was answered "no" on 16 Oct 2026: the associates line stays off.
    assert config["associates_line_enabled"] is False and config["speculative_applications_enabled"] is False
    assert config["retention_months"] == 6
    assert config["candidate_emails_enabled"] is False
    assert sections.load("home_insights")["count"] == 3
    assert sections.load("home_careers")["when_no_roles"] == "hide"
    assert SiteSection.objects.count() == 2
    from apps.insights.models import Author, Post

    assert not Post.objects.exists() and not Author.objects.exists()


def test_section_config_validation():
    with pytest.raises(ValidationError):
        sections.clean("home_insights", {"count": 5})
    with pytest.raises(ValidationError):
        sections.clean("home_careers", {"count": 0})
    with pytest.raises(ValidationError):
        sections.clean("home_insights", {"mode": "random"})
    assert sections.clean("home_careers", {"count": "5"})["count"] == 5


def test_author_slug_change_keeps_a_redirect_once_public(superadmin):
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    taxonomy.update_author(author, {"name": "Example Author", "slug": "example-quiet"}, actor=superadmin)
    assert not SlugRedirect.objects.exists() and not SyncEvent.objects.filter(entity="author").exists()
    publish_post("Example post (fixture)", superadmin, authors=[author])
    taxonomy.update_author(author, {"name": "Example Author", "slug": "example-public"}, actor=superadmin)
    assert SlugRedirect.objects.get(entity="author", from_slug="example-quiet").to_id == author.pk
    assert SyncEvent.objects.filter(entity="author", action="author.updated").exists()


def test_author_validation(superadmin):
    with pytest.raises(ValidationError):
        taxonomy.create_author({"name": ""}, actor=superadmin)
    with pytest.raises(ValidationError):
        taxonomy.create_author(
            {"name": "Example", "linkedin_url": "https://example.test/in/x"}, actor=superadmin
        )
    author = taxonomy.create_author(
        {"name": "Example Person", "linkedin_url": "https://uk.linkedin.com/in/example"}, actor=superadmin
    )
    assert author.slug == "example-person" and not author.is_confirmed


def test_deactivation_is_blocked_while_the_author_has_published_posts(superadmin):
    author = make_author(actor=superadmin)
    post = publish_post("Example post (fixture)", superadmin, authors=[author])
    with pytest.raises(ValidationError, match="Reassign or archive"):
        taxonomy.set_author_active(author, False, actor=superadmin)
    with pytest.raises(ValidationError):
        taxonomy.withdraw_confirmation(author, actor=superadmin)
    from apps.insights import services

    services.archive(post, superadmin)
    taxonomy.set_author_active(author, False, actor=superadmin)
    author.refresh_from_db()
    assert author.is_active is False


def test_author_photo_must_be_square(superadmin):
    author = make_author(actor=superadmin)
    with pytest.raises(ValidationError, match="square"):
        taxonomy.set_author_photo(author, png_bytes(400, 300), actor=superadmin)
    author = taxonomy.set_author_photo(author, png_bytes(400, 400), actor=superadmin)
    assert author.avatar_width == author.avatar_height == 400 and author.avatar_path.startswith("content/")


def test_topic_rules(superadmin):
    used = Topic.objects.get(slug="data")
    make_post("Example post (fixture)", superadmin, topics=[used])
    with pytest.raises(ValidationError, match="approved seed"):
        taxonomy.delete_topic(used, actor=superadmin)
    unused = Topic.objects.get(slug="growth-and-technology")
    taxonomy.delete_topic(unused, actor=superadmin)
    assert not Topic.objects.filter(slug="growth-and-technology").exists()
    new = taxonomy.create_topic({"name": "Example topic", "kind": "topic"}, actor=superadmin)
    assert new.slug == "example-topic" and not new.is_seeded
    before = list(Topic.objects.order_by("sort", "name").values_list("slug", flat=True))
    taxonomy.move_topic(new, "up", actor=superadmin)
    after = list(Topic.objects.order_by("sort", "name").values_list("slug", flat=True))
    assert after.index("example-topic") == before.index("example-topic") - 1
    with pytest.raises(ValidationError):
        taxonomy.update_topic(
            new, {"name": "Example topic", "kind": "topic", "slug": "data"}, actor=superadmin
        )


@pytest.mark.parametrize(
    ("data", "content_type", "size"),
    [
        (png_bytes(1600, 900), "image/png", (1600, 900)),
        (jpeg_bytes(1200, 675), "image/jpeg", (1200, 675)),
        (webp_bytes(800, 600), "image/webp", (800, 600)),
        (avif_bytes(640, 480), "image/avif", (640, 480)),
    ],
)
def test_image_types_and_dimensions_from_the_bytes(data, content_type, size):
    info = media.inspect_image(data)
    assert info.content_type == content_type and (info.width, info.height) == size


@pytest.mark.parametrize(
    "data",
    [
        b"<svg xmlns='http://www.w3.org/2000/svg'></svg>",
        b"GIF89a\x01\x00\x01\x00",
        b"%PDF-1.7",
        b"MZ\x90\x00",
        b"",
    ],
)
def test_other_files_are_refused(data):
    with pytest.raises(ValidationError):
        media.inspect_image(data)


def test_oversized_images_are_refused():
    with pytest.raises(ValidationError, match="5 MB"):
        media.inspect_image(png_bytes() + b"\x00" * (5 * 1024 * 1024))


def test_uploads_are_refused_without_storage(settings):
    settings.CONTENT_MEDIA_STORAGE_ENABLED = False
    with pytest.raises(ValidationError, match="object storage"):
        media.store_image(png_bytes(), purpose="inline")
    settings.CAREERS_CV_STORAGE_ENABLED = False
    assert media.cv_storage_enabled() is False
