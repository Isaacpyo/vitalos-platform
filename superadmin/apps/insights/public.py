"""Builders for the Insights read API (contract: contracts/content-api/v1/openapi.yaml).

Pure functions over the database: views call them, and tests call them directly.

- Snapshots are built from the working copy at publish time (``build_detail`` / ``build_summary``).
- Reads serve only published snapshots, with the query-time filter applied on every request: ``scheduled``
  with ``publish_at <= now`` counts as published (ADR-040).
- At read time author and topic refs are refreshed from the live rows (author edits emit ``insights``)
  and related posts are re-resolved against what is published now, so a related list can never carry
  a post that has since been unpublished.
"""

import math
from datetime import datetime

from django.db.models import Q
from django.utils import timezone

from apps.content_sync import copy, formatting, media, sections, shapes
from apps.content_sync.models import SiteSettings, SlugRedirect

from .models import FORMAT_PLURALS, Author, Post, PostFormat, PostStatus, Topic

PAGE_SIZE = 12
FEED_SIZE = 20
AUTHOR_POSTS = 100
RELATED_MAX = 3
FORMAT_ORDER = list(PostFormat.values)


# --- Shapes --------------------------------------------------------------------------------------


def format_slug(key: str) -> str:
    return key.replace("_", "-")


def format_from_slug(slug: str) -> str | None:
    key = (slug or "").replace("-", "_")
    return key if key in PostFormat.values else None


def format_choice(key: str) -> dict:
    return {
        "key": key,
        "label": PostFormat(key).label,
        "plural": FORMAT_PLURALS[PostFormat(key)],
        "slug": format_slug(key),
    }


def author_avatar(author: Author) -> dict | None:
    return shapes.image(
        media.public_url(author.avatar_path), author.name, author.avatar_width, author.avatar_height
    )


def author_ref(author: Author) -> dict:
    return {
        "id": str(author.id),
        "slug": author.slug,
        "name": author.name,
        "kind": author.kind,
        "roleTitle": author.role_title,
        "initials": formatting.initials(author.name),
        "avatar": author_avatar(author),
    }


def author_detail(author: Author) -> dict:
    return {
        **author_ref(author),
        "firstName": formatting.first_name(author.name),
        "bioMarkdown": author.bio_md,
        "linkedinUrl": author.linkedin_url or None,
    }


def topic_ref(topic: Topic, count: int | None = None) -> dict:
    data = {"id": str(topic.id), "slug": topic.slug, "name": topic.name, "kind": topic.kind}
    if count is not None:
        data["count"] = count
    return data


def cover(post: Post) -> dict | None:
    return shapes.image(
        media.public_url(post.cover_path),
        post.cover_alt,
        post.cover_width,
        post.cover_height,
        post.cover_caption,
    )


def working_authors(post: Post) -> list[Author]:
    return [link.author for link in post.author_links.select_related("author").order_by("position")]


def working_topics(post: Post) -> list[Topic]:
    return [link.topic for link in post.topic_links.select_related("topic").order_by("topic__sort")]


def build_summary(
    post: Post, *, published_at: datetime, updated_at: datetime | None, authors=None, topics=None
) -> dict:
    """PostSummary from the working copy."""
    authors = working_authors(post) if authors is None else authors
    topics = working_topics(post) if topics is None else topics
    return {
        "id": str(post.id),
        "slug": post.slug,
        "title": post.title,
        "excerpt": post.excerpt,
        "format": format_choice(post.format),
        "authors": [author_ref(author) for author in authors],
        "topics": [topic_ref(topic) for topic in topics],
        "practice": shapes.practice_choice(post.practice),
        "cover": cover(post),
        "publishedAt": formatting.date_value(published_at),
        "updatedAt": formatting.date_value(updated_at),
        "readingMinutes": formatting.reading_minutes(post.body_md),
        "featured": bool(post.featured),
    }


def cta(post: Post) -> dict:
    if post.cta_href:
        return {"label": post.cta_label or copy.DEFAULT_CTA_LABEL, "href": post.cta_href}
    return {"label": copy.DEFAULT_CTA_LABEL, "href": copy.DEFAULT_CTA_HREF}


def build_detail(
    post: Post,
    *,
    published_at: datetime,
    updated_at: datetime | None,
    last_modified: datetime,
    related: list[dict],
) -> dict:
    """PostDetail from the working copy: the exact JSON stored as ``published_snapshot``."""
    summary = build_summary(post, published_at=published_at, updated_at=updated_at)
    return {
        **summary,
        "bodyMarkdown": post.body_md,
        "seo": {
            "title": post.seo_title or post.title,
            "description": post.seo_description or post.excerpt,
            "canonicalUrl": post.canonical_url or None,
            "noindex": bool(post.noindex),
        },
        "cta": cta(post),
        "related": related[:RELATED_MAX],
        "lastModified": formatting.iso(last_modified),
    }


def summary_from_detail(detail: dict) -> dict:
    keys = (
        "id",
        "slug",
        "title",
        "excerpt",
        "format",
        "authors",
        "topics",
        "practice",
        "cover",
        "publishedAt",
        "updatedAt",
        "readingMinutes",
        "featured",
    )
    return {key: detail[key] for key in keys}


# --- Visibility ----------------------------------------------------------------------------------


def visible_posts(now: datetime | None = None):
    """Posts the public may see: published, or scheduled and due. Never anything without a snapshot."""
    now = now or timezone.now()
    return Post.objects.filter(published_snapshot__isnull=False, published_summary__isnull=False).filter(
        Q(status=PostStatus.PUBLISHED) | Q(status=PostStatus.SCHEDULED, publish_at__lte=now)
    )


def insights_open() -> bool:
    return SiteSettings.load().insights_open


class Catalogue:
    """Every visible post's summary, refreshed and newest first, for one request."""

    FIELDS = (
        "id",
        "published_slug",
        "published_summary",
        "published_pin_home",
        "first_published_at",
        "last_published_at",
        "publish_at",
    )

    def __init__(self, now: datetime | None = None):
        self.now = now or timezone.now()
        self.authors = {str(author.id): author for author in Author.objects.all()}
        self.topics = {str(topic.id): topic for topic in Topic.objects.all()}
        rows = list(visible_posts(self.now).only(*self.FIELDS))
        self.posts: list[Post] = rows
        self.summaries: dict[str, dict] = {
            str(post.id): self.refresh(post.published_summary) for post in rows
        }
        self.posts.sort(key=lambda post: (self.published_at(post), str(post.id)), reverse=True)
        self.by_id = {str(post.id): post for post in self.posts}

    def published_at(self, post: Post) -> datetime:
        return post.first_published_at or post.publish_at or self.now

    def refresh(self, summary: dict) -> dict:
        data = dict(summary)
        data["authors"] = [
            author_ref(self.authors[ref["id"]]) if ref.get("id") in self.authors else ref
            for ref in summary.get("authors", [])
        ]
        data["topics"] = [
            topic_ref(self.topics[ref["id"]])
            for ref in summary.get("topics", [])
            if ref.get("id") in self.topics
        ]
        return data

    def summary(self, post: Post) -> dict:
        return self.summaries[str(post.id)]

    def ordered(self) -> list[dict]:
        return [self.summary(post) for post in self.posts]

    def last_modified(self, post: Post) -> datetime:
        return post.last_published_at or post.publish_at or self.now

    def related_for(self, post_id: str, snapshot_related: list[dict], topic_ids: list[str]) -> list[dict]:
        chosen = [ref.get("id") for ref in snapshot_related if ref.get("id") in self.summaries]
        chosen = [item for item in chosen if item != post_id]
        if not chosen:
            chosen = self.auto_related(post_id, topic_ids)
        return [self.summaries[item] for item in chosen[:RELATED_MAX]]

    def auto_related(self, post_id: str, topic_ids: list[str]) -> list[str]:
        wanted = set(topic_ids)
        if not wanted:
            return []
        scored = []
        for index, post in enumerate(self.posts):
            key = str(post.id)
            if key == post_id:
                continue
            shared = len(wanted & {ref["id"] for ref in self.summaries[key]["topics"]})
            if shared:
                scored.append((-shared, index, key))
        return [key for _, _, key in sorted(scored)[:RELATED_MAX]]


# --- Endpoints -----------------------------------------------------------------------------------


def _format_counts(summaries: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for summary in summaries:
        counts[summary["format"]["key"]] = counts.get(summary["format"]["key"], 0) + 1
    return [{**format_choice(key), "count": counts[key]} for key in FORMAT_ORDER if counts.get(key)]


def _topic_counts(catalogue: Catalogue, summaries: list[dict]) -> list[dict]:
    counts: dict[str, int] = {}
    for summary in summaries:
        for ref in summary["topics"]:
            counts[ref["id"]] = counts.get(ref["id"], 0) + 1
    topics = sorted(
        (catalogue.topics[key] for key in counts if key in catalogue.topics), key=lambda t: (t.sort, t.name)
    )
    return [topic_ref(topic, counts[str(topic.id)]) for topic in topics]


def post_page(
    catalogue: Catalogue,
    *,
    page: int = 1,
    format_key: str | None = None,
    topic_id: str | None = None,
    author_id: str | None = None,
) -> dict | None:
    """PostPage, or None when the page is out of range (404)."""
    everything = catalogue.ordered()
    filtered = everything
    if format_key:
        filtered = [s for s in filtered if s["format"]["key"] == format_key]
    if topic_id:
        filtered = [s for s in filtered if any(ref["id"] == topic_id for ref in s["topics"])]
    if author_id:
        filtered = [s for s in filtered if any(ref["id"] == author_id for ref in s["authors"])]
    unfiltered = not (format_key or topic_id or author_id)
    featured = None
    pool = filtered
    if unfiltered and filtered:
        featured = next((s for s in filtered if s["featured"]), filtered[0])
        pool = [s for s in filtered if s["id"] != featured["id"]]
    total = len(filtered)
    total_pages = 0 if total == 0 else max(1, math.ceil(len(pool) / PAGE_SIZE))
    if page < 1 or page > max(total_pages, 1):
        return None
    start = (page - 1) * PAGE_SIZE
    return {
        "items": pool[start : start + PAGE_SIZE],
        "page": page,
        "pageSize": PAGE_SIZE,
        "total": total,
        "totalPages": total_pages,
        "featured": featured if page == 1 else None,
        "formats": _format_counts(everything),
        "topics": _topic_counts(catalogue, everything),
    }


def post_detail(catalogue: Catalogue, slug: str) -> dict | None:
    """PostDetail, ``{"redirect": slug}`` for an old slug, or None (404)."""
    post = visible_posts(catalogue.now).filter(published_slug=slug).first()
    if post is not None and str(post.id) in catalogue.summaries:
        return detail_for(catalogue, post)
    redirect = SlugRedirect.objects.filter(entity="post", from_slug=slug).first()
    if redirect is not None:
        target = catalogue.by_id.get(str(redirect.to_id))
        if target is not None and target.published_slug and target.published_slug != slug:
            return {"redirect": target.published_slug}
    return None


def detail_for(catalogue: Catalogue, post: Post) -> dict:
    snapshot = post.published_snapshot
    summary = catalogue.summary(post)
    topic_ids = [ref["id"] for ref in summary["topics"]]
    return {
        **snapshot,
        **summary,
        "related": catalogue.related_for(str(post.id), snapshot.get("related", []), topic_ids),
    }


def author_page(catalogue: Catalogue, slug: str) -> dict | None:
    author = Author.objects.filter(slug=slug).first()
    if author is None:
        redirect = SlugRedirect.objects.filter(entity="author", from_slug=slug).first()
        target = Author.objects.filter(pk=redirect.to_id).first() if redirect else None
        if target is not None and target.slug != slug and _author_posts(catalogue, target):
            return {"redirect": target.slug}
        return None
    posts = _author_posts(catalogue, author)
    if not posts:
        return None
    return {"author": author_detail(author), "posts": posts[:AUTHOR_POSTS]}


def _author_posts(catalogue: Catalogue, author: Author) -> list[dict]:
    key = str(author.id)
    return [s for s in catalogue.ordered() if any(ref["id"] == key for ref in s["authors"])]


def topics_list(catalogue: Catalogue) -> dict:
    return {"topics": _topic_counts(catalogue, catalogue.ordered())}


def topic_page(catalogue: Catalogue, slug: str, page: int = 1) -> dict | None:
    topic = Topic.objects.filter(slug=slug).first()
    if topic is None:
        return None
    posts = post_page(catalogue, page=page, topic_id=str(topic.id))
    if posts is None or posts["total"] == 0:
        return None
    return {
        "topic": {**topic_ref(topic), "description": topic.description},
        "posts": posts,
    }


def feed(catalogue: Catalogue) -> dict:
    return {"items": catalogue.ordered()[:FEED_SIZE]}


def home_section(catalogue: Catalogue) -> dict | None:
    config = sections.load(sections.HOME_INSIGHTS)
    if not config["enabled"] or not catalogue.posts:
        return None
    posts = catalogue.posts
    if config["mode"] == "pinned":
        posts = [p for p in posts if p.published_pin_home] + [p for p in posts if not p.published_pin_home]
    items = [catalogue.summary(post) for post in posts[: config["count"]]]
    return {"heading": config["heading"], "intro": config["intro"], "items": items}


def sitemap_entries(catalogue: Catalogue) -> list[dict]:
    hidden = set(
        str(pk)
        for pk in visible_posts(catalogue.now)
        .filter(published_snapshot__seo__noindex=True)
        .values_list("id", flat=True)
    )
    entries = []
    newest = max((catalogue.last_modified(post) for post in catalogue.posts), default=None)
    settings_row = SiteSettings.load()
    entries.append({"path": "/insights", "lastModified": formatting.iso(newest or settings_row.updated_at)})
    topics: dict[str, datetime] = {}
    authors: dict[str, datetime] = {}
    for post in catalogue.posts:
        summary = catalogue.summary(post)
        modified = catalogue.last_modified(post)
        if str(post.id) not in hidden:
            entries.append(
                {"path": f"/insights/{post.published_slug}", "lastModified": formatting.iso(modified)}
            )
        for ref in summary["topics"]:
            topics[ref["slug"]] = max(topics.get(ref["slug"], modified), modified)
        for ref in summary["authors"]:
            authors[ref["slug"]] = max(authors.get(ref["slug"], modified), modified)
    entries += [
        {"path": f"/insights/topics/{slug}", "lastModified": formatting.iso(at)}
        for slug, at in topics.items()
    ]
    entries += [
        {"path": f"/insights/authors/{slug}", "lastModified": formatting.iso(at)}
        for slug, at in authors.items()
    ]
    return entries


def preview_detail(post: Post, now: datetime | None = None) -> dict | None:
    """The working copy shaped like PostDetail (Preview). None when it cannot be shaped (no author)."""
    now = now or timezone.now()
    authors = working_authors(post)
    if not authors or not formatting.is_slug(post.slug) or post.format not in PostFormat.values:
        return None
    published_at = post.first_published_at or post.publish_at or now
    updated_at = post.public_updated_at
    if post.material_update and post.first_published_at:
        updated_at = now
    catalogue = Catalogue(now)
    related = [
        catalogue.summaries[str(link.related_post_id)]
        for link in post.related_links.all()
        if str(link.related_post_id) in catalogue.summaries
    ]
    if not related:
        related = [
            catalogue.summaries[key]
            for key in catalogue.auto_related(str(post.id), [str(t.id) for t in working_topics(post)])
        ]
    return build_detail(
        post, published_at=published_at, updated_at=updated_at, last_modified=now, related=related
    )
