"""Insights write rules: working copy, editorial workflow, checks, publishing and revisions.

Every state change runs in one transaction that changes the data, writes the revision (when
publishing), writes the audit row and emits the sync event (ADR-040). Authorisation is checked by the
views (``access.py``); these functions enforce the workflow.

Workflow (brief 4.5): draft -> in_review -> approved -> scheduled or published -> archived, and
published -> draft on unpublish. Publish, Schedule and Publish changes are blocked until every
editorial check is ticked for the current revision hash, every author is confirmed as a real person,
and the renderer reports no blocking warning.
"""

import difflib
import hashlib
import json
from dataclasses import dataclass
from datetime import timedelta
from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.audit.models import AuditEvent
from apps.audit.services import record
from apps.content_sync import formatting, media, render, sync
from apps.content_sync.models import MediaAsset, SlugRedirect

from . import public
from .models import (
    CHECK_TEXT,
    Author,
    CheckKey,
    EditorialCheck,
    Post,
    PostAuthor,
    PostFormat,
    PostRelated,
    PostRevision,
    PostStatus,
    PostTopic,
    Topic,
)

HASH_FIELDS = (
    "title",
    "excerpt",
    "body_md",
    "format",
    "slug",
    "practice",
    "cover_path",
    "cover_alt",
    "cover_caption",
    "cover_width",
    "cover_height",
    "featured",
    "pin_home",
    "cta_label",
    "cta_href",
    "seo_title",
    "seo_description",
    "canonical_url",
    "noindex",
)
WORKING_FIELDS = (
    "title",
    "excerpt",
    "body_md",
    "format",
    "slug",
    "practice",
    "cover_alt",
    "cover_caption",
    "featured",
    "pin_home",
    "cta_label",
    "cta_href",
    "seo_title",
    "seo_description",
    "canonical_url",
    "noindex",
    "material_update",
)
MAX_AUTHORS = 4
MAX_RELATED = 3
CTA_HOSTS = ("vitalos.co.uk", "www.vitalos.co.uk")
EDIT_AUDIT_INTERVAL = timedelta(minutes=10)
PUBLIC_STATES = (PostStatus.PUBLISHED, PostStatus.SCHEDULED)


class Conflict(Exception):
    """The working copy changed since the editor opened it (``updated_at`` differs)."""

    def __init__(self, post: Post):
        super().__init__("This post changed since you opened it.")
        self.post = post


# --- Hashes and helpers ------------------------------------------------------------------------


def author_ids(post: Post) -> list[str]:
    return [str(pk) for pk in post.author_links.order_by("position").values_list("author_id", flat=True)]


def topic_ids(post: Post) -> list[str]:
    return sorted(str(pk) for pk in post.topic_links.values_list("topic_id", flat=True))


def related_ids(post: Post) -> list[str]:
    return [
        str(pk) for pk in post.related_links.order_by("position").values_list("related_post_id", flat=True)
    ]


def revision_hash(post: Post) -> str:
    """A hash of every working-copy field that goes into the snapshot. Checks are valid for one hash."""
    data = {name: getattr(post, name) for name in HASH_FIELDS}
    data["authors"] = author_ids(post)
    data["topics"] = topic_ids(post)
    data["related"] = related_ids(post)
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def body_hash(post: Post) -> str:
    return hashlib.sha256((post.body_md or "").encode()).hexdigest()


# Post slugs that collide with website routes (/insights/page/2, /insights/authors/..., feed).
RESERVED_SLUGS = frozenset({"page", "authors", "topics", "feed"})


def unique_slug(base: str, *, exclude_pk=None) -> str:
    base = formatting.slugify(base) or "post"
    candidate, counter = base, 2
    while (
        candidate in RESERVED_SLUGS
        or Post.objects.filter(slug=candidate).exclude(pk=exclude_pk).exists()
        or _published_elsewhere(candidate, exclude_pk)
    ):
        suffix = f"-{counter}"
        candidate = base[: formatting.SLUG_MAX - len(suffix)].rstrip("-") + suffix
        counter += 1
    return candidate


def _published_elsewhere(slug: str, exclude_pk) -> bool:
    return Post.objects.filter(published_slug=slug, status__in=PUBLIC_STATES).exclude(pk=exclude_pk).exists()


def slug_problem(post: Post, slug: str) -> str:
    if not formatting.is_slug(slug):
        return "Use lowercase letters, numbers and hyphens (at most 80 characters)."
    if slug in RESERVED_SLUGS:
        return "This slug is reserved by the website. Choose another."
    if Post.objects.filter(slug=slug).exclude(pk=post.pk).exists() or _published_elsewhere(slug, post.pk):
        return "Another post already uses this slug."
    return ""


def slug_notes(post: Post) -> list[str]:
    """Warnings shown beside the slug field."""
    notes = []
    if post.published_slug and post.slug != post.published_slug:
        notes.append(
            f"The old address /insights/{post.published_slug} will redirect to /insights/{post.slug} "
            "once you publish the change."
        )
    held = SlugRedirect.objects.filter(entity="post", from_slug=post.slug).exclude(to_id=post.pk).exists()
    if held:
        notes.append("This slug currently redirects to another post. Publishing replaces that redirect.")
    return notes


def cta_problem(href: str) -> str:
    """CTA links must be internal paths or on vitalos.co.uk (brief section 9)."""
    if not href:
        return ""
    if href.startswith("/") and not href.startswith("//"):
        return ""
    parts = urlsplit(href)
    if parts.scheme == "https" and parts.hostname in CTA_HOSTS and not parts.username:
        return ""
    return "Use an internal path (/contact) or an https://vitalos.co.uk address."


def canonical_problem(url: str) -> str:
    if url and not url.startswith("https://"):
        return "Use an https:// address."
    return ""


def is_live(post: Post, now=None) -> bool:
    now = now or timezone.now()
    if post.published_summary is None:  # set and cleared together with the snapshot
        return False
    return post.status == PostStatus.PUBLISHED or (
        post.status == PostStatus.SCHEDULED and post.publish_at is not None and post.publish_at <= now
    )


def _audit_edit(post: Post, actor, request) -> None:
    """Working-copy saves are audited at most once per ten minutes per post and editor."""
    since = timezone.now() - EDIT_AUDIT_INTERVAL
    recent = AuditEvent.objects.filter(
        action="insights.post_edited",
        entity_type="insights.post",
        entity_id=str(post.pk),
        created_at__gte=since,
    )
    if actor is not None:
        recent = recent.filter(actor=actor)
    if not recent.exists():
        record("insights.post_edited", request=request, actor=actor, entity=post, summary=post.title)


# --- Creating and editing ------------------------------------------------------------------------


def create_post(*, title: str, format: str, actor, request=None) -> Post:
    title = (title or "").strip()
    if not title:
        raise ValidationError({"title": "Enter a title."})
    if format not in PostFormat.values:
        raise ValidationError({"format": "Choose a format."})
    with transaction.atomic():
        post = Post.objects.create(
            title=title[:200],
            format=format,
            slug=unique_slug(title),
            created_by=actor,
            updated_by=actor,
        )
        record("insights.post_created", request=request, actor=actor, entity=post, summary=post.title)
    return post


def _set_links(post: Post, authors: list[str], topics: list[str], related: list[str]) -> None:
    post.author_links.all().delete()
    PostAuthor.objects.bulk_create(
        PostAuthor(post=post, author_id=pk, position=index) for index, pk in enumerate(authors)
    )
    post.topic_links.all().delete()
    PostTopic.objects.bulk_create(PostTopic(post=post, topic_id=pk) for pk in topics)
    post.related_links.all().delete()
    PostRelated.objects.bulk_create(
        PostRelated(post=post, related_post_id=pk, position=index) for index, pk in enumerate(related)
    )


def _clean_ids(values, model, *, limit: int, exclude=None) -> list[str]:
    ids = []
    for value in values or []:
        text = str(value).strip()
        if text and text not in ids and text != str(exclude or ""):
            ids.append(text)
    ids = ids[:limit]
    known = (
        {str(pk) for pk in model.objects.filter(pk__in=ids).values_list("pk", flat=True)} if ids else set()
    )
    return [pk for pk in ids if pk in known]


def validate_working(post: Post, data: dict) -> dict[str, str]:
    errors = {}
    if not (data.get("title") or "").strip():
        errors["title"] = "Enter a title."
    if len(data.get("excerpt") or "") > 220:
        errors["excerpt"] = "The excerpt must be 220 characters or fewer."
    if data.get("format") not in PostFormat.values:
        errors["format"] = "Choose a format."
    problem = slug_problem(post, data.get("slug") or "")
    if problem:
        errors["slug"] = problem
    if problem := cta_problem(data.get("cta_href") or ""):
        errors["cta_href"] = problem
    if problem := canonical_problem(data.get("canonical_url") or ""):
        errors["canonical_url"] = problem
    return errors


def save_working_copy(
    post: Post,
    data: dict,
    *,
    authors=(),
    topics=(),
    related=(),
    actor=None,
    expected_updated_at=None,
    request=None,
) -> Post:
    """Save the editor's working copy (autosave and Save). Never touches the published snapshot."""
    errors = validate_working(post, data)
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if expected_updated_at is not None and current.updated_at != expected_updated_at:
            raise Conflict(current)
        for name in WORKING_FIELDS:
            if name in data:
                setattr(current, name, data[name])
        current.title = current.title.strip()[:200]
        current.excerpt = current.excerpt.strip()
        author_list = _clean_ids(authors, Author, limit=MAX_AUTHORS)
        topic_list = _clean_ids(topics, Topic, limit=50)
        related_list = _clean_ids(related, Post, limit=MAX_RELATED, exclude=current.pk)
        _set_links(current, author_list, topic_list, related_list)
        current.reading_minutes = formatting.reading_minutes(current.body_md)
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.has_unpublished_changes = (
            bool(current.published_hash) and revision_hash(current) != current.published_hash
        )
        current.save()
        _audit_edit(current, actor, request)
    return current


def set_cover(post: Post, data: bytes, *, alt: str, actor, request=None) -> Post:
    alt = (alt or "").strip()
    if not alt:
        raise ValidationError({"cover_alt": "Describe the image for people who cannot see it."})
    asset = media.store_image(data, purpose=MediaAsset.Purpose.COVER, alt=alt, user=actor)
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        current.cover_path = asset.key
        current.cover_width = asset.width
        current.cover_height = asset.height
        current.cover_alt = alt[:300]
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.has_unpublished_changes = (
            bool(current.published_hash) and revision_hash(current) != current.published_hash
        )
        current.save()
        record(
            "insights.post_cover_changed", request=request, actor=actor, entity=current, summary=current.title
        )
    return current


def remove_cover(post: Post, *, actor, request=None) -> Post:
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        current.cover_path = ""
        current.cover_width = current.cover_height = None
        current.cover_alt = current.cover_caption = ""
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.has_unpublished_changes = (
            bool(current.published_hash) and revision_hash(current) != current.published_hash
        )
        current.save()
        record(
            "insights.post_cover_changed",
            request=request,
            actor=actor,
            entity=current,
            summary="Removed cover",
        )
    return current


# --- Editorial checks ----------------------------------------------------------------------------


@dataclass
class CheckState:
    key: str
    label: str
    text: str
    check: EditorialCheck | None

    @property
    def done(self) -> bool:
        return self.check is not None


def checks_for(post: Post, current_hash: str | None = None) -> list[CheckState]:
    current_hash = current_hash or revision_hash(post)
    done = {
        check.check_key: check
        for check in post.checks.filter(revision_hash=current_hash).select_related("checked_by")
    }
    return [CheckState(key.value, key.label, CHECK_TEXT[key], done.get(key.value)) for key in CheckKey]


def authors_problem(post: Post) -> str:
    authors = public.working_authors(post)
    if not authors:
        return "Assign at least one named author."
    unconfirmed = [author.name for author in authors if not author.is_confirmed]
    if unconfirmed:
        return f"Confirm that every author is a real person who approved their profile: {', '.join(unconfirmed)}."
    inactive = [author.name for author in authors if not author.is_active]
    if inactive:
        return f"Inactive authors cannot be published: {', '.join(inactive)}."
    return ""


def tick_check(post: Post, key: str, actor, *, request=None) -> EditorialCheck:
    if key not in CheckKey.values:
        raise ValidationError("Unknown check.")
    if key == CheckKey.AUTHORS and (problem := authors_problem(post)):
        raise ValidationError(problem)
    current_hash = revision_hash(post)
    with transaction.atomic():
        check, _ = EditorialCheck.objects.get_or_create(
            post=post, revision_hash=current_hash, check_key=key, defaults={"checked_by": actor}
        )
        record(
            "insights.check_ticked",
            request=request,
            actor=actor,
            entity=post,
            summary=CheckKey(key).label,
            check=key,
            revision_hash=current_hash,
        )
    return check


def untick_check(post: Post, key: str, actor, *, request=None) -> None:
    current_hash = revision_hash(post)
    with transaction.atomic():
        EditorialCheck.objects.filter(post=post, revision_hash=current_hash, check_key=key).delete()
        record("insights.check_cleared", request=request, actor=actor, entity=post, summary=key, check=key)


# --- Gating --------------------------------------------------------------------------------------


def publish_blockers(post: Post, *, render_result=None, check_render: bool = True) -> list[str]:
    """Why Publish, Schedule or Publish changes is disabled right now (empty when it may go ahead).

    With ``check_render=False`` (page views) the body is judged only from a cached render, so opening
    the editor never waits on the website; the actions themselves always check it."""
    blockers = []
    if not post.title.strip():
        blockers.append("Enter a title.")
    if problem := slug_problem(post, post.slug):
        blockers.append(f"Slug: {problem}")
    if problem := authors_problem(post):
        blockers.append(problem)
    if post.cover_path and not post.cover_alt.strip():
        blockers.append("Add alt text to the cover image.")
    if problem := cta_problem(post.cta_href):
        blockers.append(f"Call to action: {problem}")
    missing = [state.label for state in checks_for(post) if not state.done]
    if missing:
        blockers.append(f"Tick the editorial checks for this version: {', '.join(missing)}.")
    if render_result is not None:
        result = render_result
    elif check_render:
        result = render.render(post.body_md, "post")
    else:
        result = render.cached(post.body_md, "post")
        if result is None:
            return blockers
    if not result.available:
        blockers.append(
            "The body could not be checked because the preview renderer is unavailable. Try again shortly."
        )
    else:
        blockers += [f"Body: {warning['message']}" for warning in result.blocking_warnings]
    return blockers


def _render_body(post: Post) -> tuple[str, render.RenderResult]:
    """Render outside the row lock, so the transaction never waits on the website."""
    body = Post.objects.only("body_md").get(pk=post.pk).body_md
    return body, render.render(body, "post")


def _require_publishable(post: Post, rendered: tuple[str, render.RenderResult] | None = None) -> None:
    # The pre-rendered result counts only if the body has not changed since (otherwise render again).
    result = rendered[1] if rendered is not None and rendered[0] == post.body_md else None
    blockers = publish_blockers(post, render_result=result)
    if blockers:
        raise ValidationError(blockers)


# --- Publishing ----------------------------------------------------------------------------------


def _slugs_for(ids: list[str], refs: list[dict], model) -> list[str]:
    slugs = [ref.get("slug", "") for ref in refs]
    slugs += list(model.objects.filter(pk__in=ids).values_list("slug", flat=True)) if ids else []
    return [slug for slug in dict.fromkeys(slugs) if slug]


def _related_summaries(post: Post, catalogue: public.Catalogue) -> list[dict]:
    chosen = [key for key in related_ids(post) if key in catalogue.summaries and key != str(post.pk)]
    if not chosen:
        chosen = catalogue.auto_related(str(post.pk), [str(t.pk) for t in public.working_topics(post)])
    return [catalogue.summaries[key] for key in chosen[: public.RELATED_MAX]]


def _build_snapshot(post: Post, *, published_at, updated_at, last_modified, now) -> tuple[dict, dict]:
    catalogue = public.Catalogue(now)
    detail = public.build_detail(
        post,
        published_at=published_at,
        updated_at=updated_at,
        last_modified=last_modified,
        related=_related_summaries(post, catalogue),
    )
    return detail, public.summary_from_detail(detail)


def _event_slugs(post: Post, previous: dict | None) -> tuple[list[str], list[str]]:
    old_authors = (previous or {}).get("authors", [])
    old_topics = (previous or {}).get("topics", [])
    author_slugs = _slugs_for(
        author_ids(post) + [ref.get("id") for ref in old_authors if ref.get("id")], old_authors, Author
    )
    topic_slugs = _slugs_for(
        topic_ids(post) + [ref.get("id") for ref in old_topics if ref.get("id")], old_topics, Topic
    )
    return author_slugs, topic_slugs


def _move_slug(post: Post, old_slug: str) -> None:
    """Point the old public slug at this post; a redirect held on the new slug is replaced."""
    SlugRedirect.objects.filter(entity="post", from_slug=post.slug).delete()
    if (
        old_slug
        and old_slug != post.slug
        and not Post.objects.filter(slug=old_slug).exclude(pk=post.pk).exists()
    ):
        SlugRedirect.objects.update_or_create(entity="post", from_slug=old_slug, defaults={"to_id": post.pk})


def publish(post: Post, actor, *, request=None) -> Post:
    """Publish an approved (or scheduled) post now, or publish the changes of a published one."""
    now = timezone.now()
    rendered = _render_body(post)
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if current.status not in (PostStatus.APPROVED, PostStatus.SCHEDULED, PostStatus.PUBLISHED):
            raise ValidationError("Only an approved, scheduled or published post can be published.")
        _require_publishable(current, rendered)
        was_published = current.status == PostStatus.PUBLISHED and current.published_snapshot is not None
        previous = current.published_snapshot if was_published else None
        old_slug = current.published_slug
        updated_at = current.public_updated_at
        if current.material_update and current.first_published_at:
            updated_at = now
        published_at = current.first_published_at or now
        detail, summary = _build_snapshot(
            current, published_at=published_at, updated_at=updated_at, last_modified=now, now=now
        )
        current_hash = revision_hash(current)
        revision = PostRevision.objects.create(
            post=current,
            snapshot=detail,
            body_hash=body_hash(current),
            revision_hash=current_hash,
            published_by=actor,
            published_at=now,
            note="Changes published" if was_published else "Published",
        )
        current.status = PostStatus.PUBLISHED
        current.first_published_at = published_at
        current.last_published_at = now
        current.public_updated_at = updated_at
        current.material_update = False
        current.publish_at = None
        current.published_snapshot = detail
        current.published_summary = summary
        current.published_hash = current_hash
        current.published_pin_home = current.pin_home
        current.published_revision = revision
        current.published_slug = current.slug
        current.has_unpublished_changes = False
        current.save()
        author_slugs, topic_slugs = _event_slugs(current, previous)
        slug_changed = bool(old_slug) and old_slug != current.slug
        _move_slug(current, old_slug if slug_changed else "")
        if slug_changed:
            sync.emit(
                "post",
                current.pk,
                "post.slug_changed",
                current.title,
                slug=current.slug,
                old_slug=old_slug,
                author_slugs=author_slugs,
                topic_slugs=topic_slugs,
            )
        action = "post.changes_published" if was_published else "post.published"
        sync.emit(
            "post",
            current.pk,
            action,
            current.title,
            slug=current.slug,
            author_slugs=author_slugs,
            topic_slugs=topic_slugs,
        )
        record(
            "insights.changes_published" if was_published else "insights.post_published",
            request=request,
            actor=actor,
            entity=current,
            summary=current.title,
            revision=revision.pk,
            revision_hash=current_hash,
        )
    return current


def schedule(post: Post, actor, publish_at, *, request=None) -> Post:
    """Freeze the snapshot now and let the tick (or the query-time filter) take it live at ``publish_at``."""
    now = timezone.now()
    if publish_at is None or publish_at <= now:
        raise ValidationError("Choose a date and time in the future (Europe/London).")
    rendered = _render_body(post)
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if current.status not in (PostStatus.APPROVED, PostStatus.SCHEDULED):
            raise ValidationError("Only an approved post can be scheduled.")
        _require_publishable(current, rendered)
        updated_at = current.public_updated_at
        if current.material_update and current.first_published_at:
            updated_at = publish_at
        published_at = current.first_published_at or publish_at
        detail, summary = _build_snapshot(
            current, published_at=published_at, updated_at=updated_at, last_modified=publish_at, now=now
        )
        old_slug = current.published_slug
        current.status = PostStatus.SCHEDULED
        current.publish_at = publish_at
        current.material_update = False
        current.public_updated_at = updated_at
        current.published_snapshot = detail
        current.published_summary = summary
        current.published_hash = revision_hash(current)
        current.published_pin_home = current.pin_home
        current.published_slug = current.slug
        current.has_unpublished_changes = False
        current.save()
        _move_slug(current, old_slug if old_slug and old_slug != current.slug else "")
        record(
            "insights.post_scheduled",
            request=request,
            actor=actor,
            entity=current,
            summary=f"{current.title} for {formatting.date_long(publish_at)} {formatting.clock(publish_at)}",
            publish_at=formatting.iso(publish_at),
        )
        # Refresh the website's site state so its tick learns the new nextDueAt (ADR-042).
        sync.emit("post", current.pk, "post.scheduled", current.title, paths=[])
    return current


def unschedule(post: Post, actor, *, request=None) -> Post:
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if current.status != PostStatus.SCHEDULED:
            raise ValidationError("This post is not scheduled.")
        current.status = PostStatus.APPROVED
        current.publish_at = None
        current.published_snapshot = None
        current.published_summary = None
        current.published_hash = ""
        if current.first_published_at is None:
            current.published_slug = ""  # it was never public, so it holds no public address
        current.has_unpublished_changes = False
        current.save()
        record(
            "insights.post_unscheduled", request=request, actor=actor, entity=current, summary=current.title
        )
        sync.emit("post", current.pk, "post.unscheduled", current.title, paths=[])
    return current


def promote_due(now=None) -> int:
    """Take due scheduled posts live (the tick). Each row is claimed with ``skip_locked`` and the status
    change is conditional, so overlapping runs promote each post exactly once. The snapshot was frozen
    and checked when the post was scheduled."""
    now = now or timezone.now()
    promoted = 0
    due = Post.objects.filter(status=PostStatus.SCHEDULED, publish_at__lte=now).values_list("pk", flat=True)
    for pk in list(due):
        with transaction.atomic():
            post = (
                Post.objects.select_for_update(skip_locked=True)
                .filter(pk=pk, status=PostStatus.SCHEDULED, publish_at__lte=now)
                .first()
            )
            if post is None or post.published_snapshot is None:
                continue
            go_live = post.publish_at
            updated_iso = (post.published_snapshot.get("updatedAt") or {}).get("iso")
            updated = Post.objects.filter(pk=pk, status=PostStatus.SCHEDULED).update(
                status=PostStatus.PUBLISHED,
                first_published_at=post.first_published_at or go_live,
                last_published_at=go_live,
                public_updated_at=parse_datetime(updated_iso) if updated_iso else None,
                publish_at=None,
            )
            if not updated:
                continue
            revision = PostRevision.objects.create(
                post=post,
                snapshot=post.published_snapshot,
                body_hash=hashlib.sha256(
                    (post.published_snapshot.get("bodyMarkdown") or "").encode()
                ).hexdigest(),
                revision_hash=post.published_hash,
                published_by=None,
                published_at=now,
                note="Published on schedule",
            )
            Post.objects.filter(pk=pk).update(
                published_revision=revision,
                has_unpublished_changes=revision_hash(post) != post.published_hash,
            )
            author_slugs, topic_slugs = _event_slugs(post, post.published_snapshot)
            record(
                "insights.post_published",
                entity=post,
                summary=post.title,
                reason="schedule",
                revision=revision.pk,
            )
            sync.emit(
                "post",
                post.pk,
                "post.published",
                post.title,
                slug=post.published_slug,
                author_slugs=author_slugs,
                topic_slugs=topic_slugs,
            )
            promoted += 1
    return promoted


def _take_down(post: Post, actor, *, status: str, action: str, audit: str, request=None) -> Post:
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        was_public = current.published_snapshot is not None and current.status in PUBLIC_STATES
        previous = current.published_snapshot
        current.status = status
        current.publish_at = None
        current.published_snapshot = None
        current.published_summary = None
        current.published_hash = ""
        current.published_pin_home = False
        current.has_unpublished_changes = False
        current.save()
        record(audit, request=request, actor=actor, entity=current, summary=current.title)
        if was_public:
            author_slugs, topic_slugs = _event_slugs(current, previous)
            sync.emit(
                "post",
                current.pk,
                action,
                current.title,
                slug=current.published_slug or current.slug,
                author_slugs=author_slugs,
                topic_slugs=topic_slugs,
            )
    return current


def unpublish(post: Post, actor, *, request=None) -> Post:
    if post.status != PostStatus.PUBLISHED:
        raise ValidationError("Only a published post can be unpublished.")
    return _take_down(
        post,
        actor,
        status=PostStatus.DRAFT,
        action="post.unpublished",
        audit="insights.post_unpublished",
        request=request,
    )


def archive(post: Post, actor, *, request=None) -> Post:
    if post.status == PostStatus.ARCHIVED:
        raise ValidationError("This post is already archived.")
    return _take_down(
        post,
        actor,
        status=PostStatus.ARCHIVED,
        action="post.archived",
        audit="insights.post_archived",
        request=request,
    )


def _transition(post: Post, actor, *, allowed, target, audit, message, request=None) -> Post:
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if current.status not in allowed:
            raise ValidationError(message)
        current.status = target
        current.save(update_fields=["status"])
        record(audit, request=request, actor=actor, entity=current, summary=current.title)
    return current


def submit_for_review(post: Post, actor, *, request=None) -> Post:
    return _transition(
        post,
        actor,
        allowed=(PostStatus.DRAFT,),
        target=PostStatus.IN_REVIEW,
        audit="insights.post_submitted",
        message="Only a draft can be submitted for review.",
        request=request,
    )


def approve(post: Post, actor, *, request=None) -> Post:
    return _transition(
        post,
        actor,
        allowed=(PostStatus.IN_REVIEW,),
        target=PostStatus.APPROVED,
        audit="insights.post_approved",
        message="Only a post in review can be approved.",
        request=request,
    )


def return_to_draft(post: Post, actor, *, request=None) -> Post:
    return _transition(
        post,
        actor,
        allowed=(PostStatus.IN_REVIEW, PostStatus.APPROVED),
        target=PostStatus.DRAFT,
        audit="insights.post_returned",
        message="Only a post in review or approved can go back to draft.",
        request=request,
    )


def restore(post: Post, actor, *, request=None) -> Post:
    return _transition(
        post,
        actor,
        allowed=(PostStatus.ARCHIVED,),
        target=PostStatus.DRAFT,
        audit="insights.post_restored",
        message="Only an archived post can be restored.",
        request=request,
    )


def can_delete(post: Post) -> bool:
    return (
        post.status in (PostStatus.DRAFT, PostStatus.IN_REVIEW, PostStatus.APPROVED, PostStatus.ARCHIVED)
        and not post.ever_published
        and not post.revisions.exists()
    )


def delete(post: Post, actor, *, request=None) -> None:
    """Hard delete, only for posts that were never published (otherwise archive)."""
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        if not can_delete(current):
            raise ValidationError("Only a post that was never published can be deleted. Archive it instead.")
        record(
            "insights.post_deleted",
            request=request,
            actor=actor,
            entity_type="insights.post",
            entity_id=str(current.pk),
            summary=current.title,
        )
        PostRelated.objects.filter(related_post=current).delete()
        current.delete()


def duplicate(post: Post, actor, *, request=None) -> Post:
    with transaction.atomic():
        copy_title = f"{post.title} (copy)"[:200]
        clone = Post.objects.create(
            title=copy_title,
            slug=unique_slug(copy_title),
            format=post.format,
            excerpt=post.excerpt,
            body_md=post.body_md,
            cover_path=post.cover_path,
            cover_alt=post.cover_alt,
            cover_caption=post.cover_caption,
            cover_width=post.cover_width,
            cover_height=post.cover_height,
            practice=post.practice,
            cta_label=post.cta_label,
            cta_href=post.cta_href,
            seo_title=post.seo_title,
            seo_description=post.seo_description,
            noindex=post.noindex,
            reading_minutes=post.reading_minutes,
            created_by=actor,
            updated_by=actor,
        )
        _set_links(clone, author_ids(post), topic_ids(post), related_ids(post))
        record(
            "insights.post_duplicated",
            request=request,
            actor=actor,
            entity=clone,
            summary=clone.title,
            source=str(post.pk),
        )
    return clone


# --- Revisions -----------------------------------------------------------------------------------

REVISION_TEXT_FIELDS = (("title", "Title"), ("excerpt", "Excerpt"), ("bodyMarkdown", "Body"))


def working_as_snapshot_text(post: Post) -> dict:
    return {"title": post.title, "excerpt": post.excerpt, "bodyMarkdown": post.body_md}


def diff(revision: PostRevision, post: Post) -> list[dict]:
    """A unified text diff per field between a revision and the current working copy."""
    current = working_as_snapshot_text(post)
    result = []
    for key, label in REVISION_TEXT_FIELDS:
        before = str(revision.snapshot.get(key) or "").splitlines()
        after = str(current.get(key) or "").splitlines()
        lines = list(difflib.unified_diff(before, after, "Revision", "Working copy", lineterm="", n=2))
        result.append({"label": label, "lines": lines, "same": not lines})
    return result


def restore_revision(post: Post, revision: PostRevision, actor, *, request=None) -> Post:
    """Copy a revision back into the working copy (the slug stays as it is). Nothing goes live."""
    if revision.post_id != post.pk:
        raise ValidationError("That revision belongs to another post.")
    snapshot = revision.snapshot
    with transaction.atomic():
        current = Post.objects.select_for_update().get(pk=post.pk)
        current.title = snapshot.get("title", current.title)
        current.excerpt = snapshot.get("excerpt", "")
        current.body_md = snapshot.get("bodyMarkdown", "")
        format_key = (snapshot.get("format") or {}).get("key")
        if format_key in PostFormat.values:
            current.format = format_key
        current.practice = (snapshot.get("practice") or {}).get("key", "")
        current.featured = bool(snapshot.get("featured"))
        seo = snapshot.get("seo") or {}
        current.seo_title = seo.get("title", "") if seo.get("title") != snapshot.get("title") else ""
        current.seo_description = (
            seo.get("description", "") if seo.get("description") != snapshot.get("excerpt") else ""
        )
        current.canonical_url = seo.get("canonicalUrl") or ""
        current.noindex = bool(seo.get("noindex"))
        cta = snapshot.get("cta") or {}
        if cta.get("href") == "/contact" and cta.get("label") == "Talk to Vitalos":
            current.cta_label = current.cta_href = ""
        else:
            current.cta_label, current.cta_href = cta.get("label", ""), cta.get("href", "")
        cover = snapshot.get("cover")
        if cover:
            key = cover["url"].split("/content/", 1)[-1]
            current.cover_path = f"content/{key}"
            current.cover_alt = cover.get("alt", "")
            current.cover_caption = cover.get("caption") or ""
            current.cover_width, current.cover_height = cover.get("width"), cover.get("height")
        else:
            current.cover_path = current.cover_alt = current.cover_caption = ""
            current.cover_width = current.cover_height = None
        current.reading_minutes = formatting.reading_minutes(current.body_md)
        _set_links(
            current,
            _clean_ids([ref.get("id") for ref in snapshot.get("authors", [])], Author, limit=MAX_AUTHORS),
            _clean_ids([ref.get("id") for ref in snapshot.get("topics", [])], Topic, limit=50),
            _clean_ids(
                [ref.get("id") for ref in snapshot.get("related", [])],
                Post,
                limit=MAX_RELATED,
                exclude=current.pk,
            ),
        )
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.has_unpublished_changes = (
            bool(current.published_hash) and revision_hash(current) != current.published_hash
        )
        current.save()
        record(
            "insights.revision_restored",
            request=request,
            actor=actor,
            entity=current,
            summary=current.title,
            revision=revision.pk,
        )
    return current
