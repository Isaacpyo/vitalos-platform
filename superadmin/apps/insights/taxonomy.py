"""Authors and topics (brief 7.3). Edits are live (no working copy): they emit ``author.updated`` or
``topic.updated`` when the item appears on the website, with the audit row, in one transaction."""

from urllib.parse import urlsplit

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.audit.services import record
from apps.content_sync import formatting, media, sync
from apps.content_sync.models import MediaAsset, SlugRedirect

from .models import Author, Post, PostStatus, Topic, TopicKind

PUBLIC = (PostStatus.PUBLISHED, PostStatus.SCHEDULED)


def _unique(model, base: str, exclude_pk=None) -> str:
    base = formatting.slugify(base) or "item"
    candidate, counter = base, 2
    while model.objects.filter(slug=candidate).exclude(pk=exclude_pk).exists():
        suffix = f"-{counter}"
        candidate = base[: formatting.SLUG_MAX - len(suffix)].rstrip("-") + suffix
        counter += 1
    return candidate


def _slug_error(model, slug: str, exclude_pk) -> str:
    if not formatting.is_slug(slug):
        return "Use lowercase letters, numbers and hyphens (at most 80 characters)."
    if model.objects.filter(slug=slug).exclude(pk=exclude_pk).exists():
        return "Another item already uses this slug."
    return ""


# --- Authors -------------------------------------------------------------------------------------


def published_posts_of(author: Author):
    return Post.objects.filter(author_links__author=author, status__in=PUBLIC).distinct()


def author_is_public(author: Author) -> bool:
    return published_posts_of(author).exists()


def linkedin_problem(url: str) -> str:
    if not url:
        return ""
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or not (host == "linkedin.com" or host.endswith(".linkedin.com")):
        return "Use an https://www.linkedin.com/ address."
    return ""


def _author_errors(author: Author | None, data: dict) -> dict:
    errors = {}
    if not (data.get("name") or "").strip():
        errors["name"] = "Enter the author's name."
    if len(data.get("bio_md") or "") > 5000:
        errors["bio_md"] = "The biography must be 5,000 characters or fewer."
    if "slug" in data and (problem := _slug_error(Author, data["slug"], author.pk if author else None)):
        errors["slug"] = problem
    if problem := linkedin_problem(data.get("linkedin_url") or ""):
        errors["linkedin_url"] = problem
    return errors


def create_author(data: dict, *, actor, request=None) -> Author:
    errors = _author_errors(None, {key: value for key, value in data.items() if key != "slug"})
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        author = Author.objects.create(
            name=data["name"].strip()[:120],
            slug=_unique(Author, data.get("slug") or data["name"]),
            role_title=(data.get("role_title") or "").strip()[:120],
            bio_md=data.get("bio_md") or "",
            linkedin_url=data.get("linkedin_url") or "",
            admin_user=data.get("admin_user"),
            created_by=actor,
            updated_by=actor,
        )
        record("insights.author_created", request=request, actor=actor, entity=author, summary=author.name)
    return author


def update_author(author: Author, data: dict, *, actor, request=None) -> Author:
    errors = _author_errors(author, data)
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        old_slug = current.slug
        current.name = data["name"].strip()[:120]
        current.slug = data.get("slug") or current.slug
        current.role_title = (data.get("role_title") or "").strip()[:120]
        current.bio_md = data.get("bio_md") or ""
        current.linkedin_url = data.get("linkedin_url") or ""
        current.admin_user = data.get("admin_user")
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.save()
        public = author_is_public(current)
        if old_slug != current.slug:
            SlugRedirect.objects.filter(entity="author", from_slug=current.slug).delete()
            if public:
                SlugRedirect.objects.update_or_create(
                    entity="author", from_slug=old_slug, defaults={"to_id": current.pk}
                )
        record("insights.author_updated", request=request, actor=actor, entity=current, summary=current.name)
        if public:
            sync.emit(
                "author", current.pk, "author.updated", current.name, slug=current.slug, old_slug=old_slug
            )
    return current


def set_author_photo(author: Author, data: bytes, *, actor, request=None) -> Author:
    info = media.inspect_image(data)
    if info.width != info.height:
        raise ValidationError(
            f"Upload a square photo (this one is {info.width} × {info.height} pixels). Crop it to a square first."
        )
    asset = media.store_image(data, purpose=MediaAsset.Purpose.AVATAR, alt=author.name, user=actor)
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        current.avatar_path = asset.key
        current.avatar_width = asset.width
        current.avatar_height = asset.height
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.save()
        record(
            "insights.author_photo_changed",
            request=request,
            actor=actor,
            entity=current,
            summary=current.name,
        )
        if author_is_public(current):
            sync.emit("author", current.pk, "author.updated", current.name, slug=current.slug)
    return current


def remove_author_photo(author: Author, *, actor, request=None) -> Author:
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        current.avatar_path = ""
        current.avatar_width = current.avatar_height = None
        current.updated_at = timezone.now()
        current.updated_by = actor
        current.save()
        record(
            "insights.author_photo_changed",
            request=request,
            actor=actor,
            entity=current,
            summary="Removed photo",
        )
        if author_is_public(current):
            sync.emit("author", current.pk, "author.updated", current.name, slug=current.slug)
    return current


def confirm_author(author: Author, *, actor, request=None) -> Author:
    """Record that the author is a real person who has approved this profile (who and when)."""
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        current.confirmed_real_by = actor
        current.confirmed_real_at = timezone.now()
        current.save(update_fields=["confirmed_real_by", "confirmed_real_at"])
        record(
            "insights.author_confirmed",
            request=request,
            actor=actor,
            entity=current,
            summary=f"{current.name} confirmed as a real person who approved the profile",
        )
    return current


def withdraw_confirmation(author: Author, *, actor, request=None) -> Author:
    if author_is_public(author):
        raise ValidationError("Archive or reassign this author's published posts first.")
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        current.confirmed_real_by = None
        current.confirmed_real_at = None
        current.save(update_fields=["confirmed_real_by", "confirmed_real_at"])
        record(
            "insights.author_unconfirmed", request=request, actor=actor, entity=current, summary=current.name
        )
    return current


def set_author_active(author: Author, active: bool, *, actor, request=None) -> Author:
    if not active and author_is_public(author):
        raise ValidationError(
            "This author has published posts. Reassign or archive those posts before deactivating them."
        )
    with transaction.atomic():
        current = Author.objects.select_for_update().get(pk=author.pk)
        current.is_active = active
        current.save(update_fields=["is_active"])
        record(
            "insights.author_activated" if active else "insights.author_deactivated",
            request=request,
            actor=actor,
            entity=current,
            summary=current.name,
        )
    return current


# --- Topics --------------------------------------------------------------------------------------


def topic_is_public(topic: Topic) -> bool:
    return Post.objects.filter(topic_links__topic=topic, status__in=PUBLIC).exists()


def _topic_errors(topic: Topic | None, data: dict) -> dict:
    errors = {}
    if not (data.get("name") or "").strip():
        errors["name"] = "Enter a name."
    if data.get("kind") not in TopicKind.values:
        errors["kind"] = "Choose topic or sector."
    if len(data.get("description") or "") > 1000:
        errors["description"] = "The description must be 1,000 characters or fewer."
    if "slug" in data and (problem := _slug_error(Topic, data["slug"], topic.pk if topic else None)):
        errors["slug"] = problem
    return errors


def create_topic(data: dict, *, actor, request=None) -> Topic:
    errors = _topic_errors(None, {key: value for key, value in data.items() if key != "slug"})
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        last = Topic.objects.order_by("-sort").values_list("sort", flat=True).first() or 0
        topic = Topic.objects.create(
            name=data["name"].strip()[:120],
            slug=_unique(Topic, data.get("slug") or data["name"]),
            description=(data.get("description") or "").strip(),
            kind=data["kind"],
            sort=last + 10,
        )
        record("insights.topic_created", request=request, actor=actor, entity=topic, summary=topic.name)
    return topic


def update_topic(topic: Topic, data: dict, *, actor, request=None) -> Topic:
    errors = _topic_errors(topic, data)
    if errors:
        raise ValidationError(errors)
    with transaction.atomic():
        current = Topic.objects.select_for_update().get(pk=topic.pk)
        old_slug = current.slug
        current.name = data["name"].strip()[:120]
        current.slug = data.get("slug") or current.slug
        current.description = (data.get("description") or "").strip()
        current.kind = data["kind"]
        current.updated_at = timezone.now()
        current.save()
        record("insights.topic_updated", request=request, actor=actor, entity=current, summary=current.name)
        if topic_is_public(current):
            sync.emit(
                "topic", current.pk, "topic.updated", current.name, slug=current.slug, old_slug=old_slug
            )
    return current


def move_topic(topic: Topic, direction: str, *, actor, request=None) -> None:
    ordered = list(Topic.objects.order_by("sort", "name"))
    index = next(i for i, item in enumerate(ordered) if item.pk == topic.pk)
    swap = index - 1 if direction == "up" else index + 1
    if not 0 <= swap < len(ordered):
        return
    ordered[index], ordered[swap] = ordered[swap], ordered[index]
    with transaction.atomic():
        for position, item in enumerate(ordered):
            Topic.objects.filter(pk=item.pk).update(sort=(position + 1) * 10)
        record("insights.topic_reordered", request=request, actor=actor, entity=topic, summary=topic.name)
        if any(topic_is_public(item) for item in (ordered[index], ordered[swap])):
            sync.emit("topic", topic.pk, "topic.updated", topic.name, slug=topic.slug)


def delete_topic(topic: Topic, *, actor, request=None) -> None:
    used = topic.post_links.count()
    if used:
        kind = "an approved seed topic" if topic.is_seeded else "a topic"
        raise ValidationError(
            f"This is {kind} used by {used} post{'s' if used != 1 else ''}. Remove it from them first."
        )
    with transaction.atomic():
        record(
            "insights.topic_deleted",
            request=request,
            actor=actor,
            entity_type="insights.topic",
            entity_id=str(topic.pk),
            summary=topic.name,
        )
        topic.delete()
