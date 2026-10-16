"""The admin against contracts/content-api/v1: vendored copies, shared fixtures and live responses."""

import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from apps.content_sync import render, tags
from apps.insights import services
from apps.insights.models import Post

from .content_helpers import (
    CONTRACT_DIR,
    Contract,
    configure,
    make_author,
    make_role,
    ok_render,
    open_site,
    publish_post,
    response_json,
    signed_get,
    tick_all,
    topic,
)

FIXTURE_OPERATIONS = {
    "AuthorResponse": ("/api/content/v1/insights/authors/{slug}", 0),
    "TopicsResponse": ("/api/content/v1/insights/topics", None),
    "TopicResponse": ("/api/content/v1/insights/topics/{slug}", None),
    "FeedResponse": ("/api/content/v1/insights/feed", None),
}


@pytest.fixture(scope="module")
def contract():
    return Contract()


def test_vendored_contract_files_are_byte_identical_to_the_contract():
    for name in ("tags.json", "openapi.yaml"):
        assert (tags.CONTRACT_DIR / name).read_bytes() == (CONTRACT_DIR / name).read_bytes(), name


def test_every_shared_fixture_validates(contract):
    index = json.loads((CONTRACT_DIR / "fixtures" / "index.json").read_text(encoding="utf-8"))["fixtures"]
    assert index
    for name, schema in index.items():
        data = json.loads((CONTRACT_DIR / "fixtures" / f"{name}.json").read_text(encoding="utf-8"))
        if schema in FIXTURE_OPERATIONS:
            path, branch = FIXTURE_OPERATIONS[schema]
            validator = contract.operation(path)
            if branch is not None:
                validator = contract.validator(validator.schema["$ref"].split("#", 1)[1] + f"/oneOf/{branch}")
        else:
            validator = contract.component(schema)
        assert contract.errors(validator, data) == [], name


def test_every_event_tag_template_expands_to_valid_tags():
    for action in tags.contract()["events"]:
        expanded = tags.expand_tags(
            action,
            slug="example-slug",
            old_slug="example-old",
            author_slugs=["example-author"],
            topic_slugs=["ai-and-agents"],
        )
        assert expanded and all(tags.tag_pattern().match(tag) for tag in expanded)
        assert not any("{" in tag or "*" in tag for tag in expanded)


@pytest.fixture
def dataset(db, settings, monkeypatch, superadmin):
    """A seeded dataset with one of everything the public may see, plus things it must not."""
    configure(settings, targets=())
    monkeypatch.setattr(render, "render", ok_render)
    open_site()
    author = make_author("Example Author", actor=superadmin, slug="example-author")
    second = make_author("Example Second Author", actor=superadmin, slug="example-second")
    one = publish_post(
        "Example post one (fixture)", superadmin, authors=[author], topics=[topic()], slug="example-one"
    )
    publish_post(
        "Example post two (fixture)",
        superadmin,
        authors=[author, second],
        topics=[topic(), topic("health-and-care")],
        slug="example-two",
        featured=True,
        pin_home=True,
    )
    three = publish_post(
        "Example post three (fixture)",
        superadmin,
        authors=[second],
        topics=[topic("data")],
        slug="example-three",
        format="guide",
    )
    three = services.save_working_copy(
        three,
        {name: getattr(three, name) for name in services.WORKING_FIELDS},
        authors=services.author_ids(three),
        topics=services.topic_ids(three),
        related=[str(one.pk)],
        actor=superadmin,
    )
    tick_all(three, superadmin)
    services.publish(Post.objects.get(pk=three.pk), superadmin)
    moved = services.save_working_copy(
        Post.objects.get(pk=one.pk),
        {**{name: getattr(one, name) for name in services.WORKING_FIELDS}, "slug": "example-one-moved"},
        authors=services.author_ids(one),
        topics=services.topic_ids(one),
        actor=superadmin,
    )
    tick_all(moved, superadmin)
    services.publish(Post.objects.get(pk=one.pk), superadmin)
    make_role(
        "Example role (fixture)",
        actor=superadmin,
        closes_in=timedelta(days=30),
        show_salary=True,
        salary_min=10000,
        salary_max=20000,
        show_on_home=True,
    )
    make_role(
        "Example day-rate role (fixture)",
        actor=superadmin,
        show_salary=True,
        salary_min=600,
        salary_max=700,
        salary_period="day",
        practice="labs",
        employment_type="contract",
    )
    closed = make_role("Example closed role (fixture)", actor=superadmin, status="closed")
    return {"closed_role": closed}


def _pages(client: Client):
    """Every read endpoint with the dataset's slugs, with the operation path each answers."""
    paths = {
        "/api/content/v1/site-state": "/api/content/v1/site-state",
        "/api/content/v1/insights/posts": "/api/content/v1/insights/posts",
        "/api/content/v1/insights/posts?format=guide": "/api/content/v1/insights/posts",
        "/api/content/v1/insights/posts?topic=ai-and-agents": "/api/content/v1/insights/posts",
        "/api/content/v1/insights/posts?author=example-second": "/api/content/v1/insights/posts",
        "/api/content/v1/insights/posts/example-two": "/api/content/v1/insights/posts/{slug}",
        "/api/content/v1/insights/posts/example-three": "/api/content/v1/insights/posts/{slug}",
        "/api/content/v1/insights/posts/example-one": "/api/content/v1/insights/posts/{slug}",
        "/api/content/v1/insights/authors/example-author": "/api/content/v1/insights/authors/{slug}",
        "/api/content/v1/insights/topics": "/api/content/v1/insights/topics",
        "/api/content/v1/insights/topics/ai-and-agents": "/api/content/v1/insights/topics/{slug}",
        "/api/content/v1/insights/feed": "/api/content/v1/insights/feed",
        "/api/content/v1/careers/page": "/api/content/v1/careers/page",
        "/api/content/v1/home": "/api/content/v1/home",
        "/api/content/v1/sitemap": "/api/content/v1/sitemap",
        "/api/content/v1/health": "/api/content/v1/health",
    }
    return paths


def test_every_read_response_for_a_seeded_dataset_validates(contract, dataset, client: Client):
    from apps.careers.models import Role

    role_paths = {
        f"/api/content/v1/careers/roles/{role.published_slug}": "/api/content/v1/careers/roles/{slug}"
        for role in Role.objects.all()
    }
    for path, operation in {**_pages(client), **role_paths}.items():
        response = signed_get(client, path)
        assert response.status_code == 200, path
        assert response["Cache-Control"] == "no-store"
        assert contract.errors(contract.operation(operation), response_json(response)) == [], path


def test_redirect_and_closed_role_shapes(contract, dataset, client: Client):
    data = response_json(signed_get(client, "/api/content/v1/insights/posts/example-one"))
    assert data == {"redirect": "example-one-moved"}
    closed = dataset["closed_role"]
    data = response_json(signed_get(client, f"/api/content/v1/careers/roles/{closed.published_slug}"))
    assert data["state"] == "closed"
    assert contract.errors(contract.component("ClosedRole"), data) == []


def test_formatted_values(dataset, client: Client):
    page = response_json(signed_get(client, "/api/content/v1/careers/page"))
    labels = {role["title"]: role for group in page["groups"] for role in group["roles"]}
    assert labels["Example role (fixture)"]["salary"]["label"] == "£10,000–£20,000 a year"
    assert labels["Example day-rate role (fixture)"]["salary"]["label"] == "£600–£700 a day"
    assert labels["Example role (fixture)"]["level"] == {"key": "l3_senior", "label": "Senior"}
    assert labels["Example role (fixture)"]["workModel"]["label"] == "Hybrid"
    assert labels["Example day-rate role (fixture)"]["employmentType"]["label"] == "Contract"
    assert [group["practice"]["key"] for group in page["groups"]] == ["engineering", "labs"]
    post = response_json(signed_get(client, "/api/content/v1/insights/posts/example-two"))
    assert post["format"] == {
        "key": "engineering_note",
        "label": "Engineering note",
        "plural": "Engineering notes",
        "slug": "engineering-note",
    }
    published = timezone.localtime(Post.objects.get(slug="example-two").first_published_at)
    assert post["publishedAt"]["long"] == f"{published.day} {published:%B} {published.year}"
    assert post["publishedAt"]["iso"].endswith("Z")
    assert post["readingMinutes"] == 1
    assert post["authors"][0]["initials"] == "EA"
    assert post["cta"] == {"label": "Talk to Vitalos", "href": "/contact"}
