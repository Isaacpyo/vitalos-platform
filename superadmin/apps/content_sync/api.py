"""The signed read API under /api/content/v1/ (amendment A3; contract: openapi.yaml).

Plain Django views: CSRF-exempt, GET only (except the tick), signed with scheme v1, ``no-store``.
Only published snapshots leave the admin, and the query-time filters run on every request. A closed
section (site settings) answers 404 on its endpoints and is left out of ``home`` and ``sitemap``;
``site-state`` still answers and previews still work. Bodies and signatures are never logged.
"""

import functools
import logging
import re
import uuid

from django.conf import settings
from django.core.cache import cache
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from apps.enquiries import providers

from . import formatting, signing, tick
from .models import SiteSettings

logger = logging.getLogger(__name__)

MAX_BODY = 1024
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
PREVIEW_HEADER = "X-Vitalos-Preview-Token"


def _json(data, status: int = 200) -> JsonResponse:
    response = JsonResponse(data, status=status, json_dumps_params={"ensure_ascii": False}, safe=False)
    response["Cache-Control"] = "no-store"
    response["X-Robots-Tag"] = "noindex"
    return response


def _error(message: str, status: int) -> JsonResponse:
    return _json({"error": message}, status)


def _rate_limited(key_id: str) -> bool:
    minute = int(timezone.now().timestamp() // 60)
    bucket = f"content-api-rate:{key_id}:{minute}"
    added = cache.add(bucket, 1, 120)
    count = 1 if added else cache.incr(bucket)
    return count > settings.CONTENT_READ_RATE_LIMIT


def signed(scope: str, methods: tuple[str, ...] = ("GET",)):
    """Verify the v1 signature for ``scope`` before the view runs; 503 when the scope has no keys."""

    def decorator(view):
        @csrf_exempt
        @functools.wraps(view)
        def wrapped(request, *args, **kwargs):
            if request.method not in methods:
                response = _error("Method not allowed", 405)
                response["Allow"] = ", ".join(methods)
                return response
            if not signing.keys_for(scope):
                return _error("Not configured", 503)
            try:
                body = providers.read_body(request, MAX_BODY)
            except providers.BodyTooLarge:
                return _error("Payload too large", 413)
            try:
                key = signing.verify_request(request, scope, body)
            except signing.NotConfigured:
                return _error("Not configured", 503)
            except signing.InvalidSignature as exc:
                logger.info("Content API signature refused", extra={"reason": str(exc), "path": request.path})
                return _error("Invalid signature", 401)
            if _rate_limited(key.key_id):
                return _error("Too many requests", 429)
            request.content_key_id = key.key_id
            response = view(request, *args, **kwargs)
            response["Cache-Control"] = "no-store"
            return response

        return wrapped

    return decorator


def _page(request) -> int | None:
    raw = request.GET.get("page", "1")
    if not raw.isdigit():
        return None
    page = int(raw)
    return page if 1 <= page <= 9999 else None


def _slug_param(request, name: str) -> str | None:
    """'' when absent, None when malformed."""
    value = request.GET.get(name)
    if value is None:
        return ""
    return value if SLUG_RE.match(value) and len(value) <= 80 else None


def _site() -> SiteSettings:
    return SiteSettings.load()


# --- Site, home, sitemap, health, tick -----------------------------------------------------------


@signed("read")
def site_state(request):
    site = _site()
    return _json(
        {
            "insightsOpen": site.insights_open,
            "careersOpen": site.careers_open,
            "insights": {
                "heading": site.insights_heading,
                "intro": site.insights_intro,
                "editorialNote": site.insights_editorial_note,
            },
            "nextDueAt": formatting.iso(tick.next_due_at()),
        }
    )


@signed("read")
def home(request):
    from apps.careers import public as careers_public
    from apps.insights import public as insights_public

    site = _site()
    now = timezone.now()
    insights = insights_public.home_section(insights_public.Catalogue(now)) if site.insights_open else None
    careers = careers_public.home_section(now) if site.careers_open else None
    return _json({"insights": insights, "careers": careers})


@signed("read")
def sitemap(request):
    from apps.careers import public as careers_public
    from apps.insights import public as insights_public

    site = _site()
    now = timezone.now()
    entries = []
    if site.insights_open:
        entries += insights_public.sitemap_entries(insights_public.Catalogue(now))
    if site.careers_open:
        entries += careers_public.sitemap_entries(now)
    return _json({"entries": entries})


@signed("read")
def health(request):
    return _json({"status": "ok"})


@signed("tick", methods=("POST",))
def run_tick(request):
    return _json(tick.run())


# --- Insights ------------------------------------------------------------------------------------


def _insights_closed():
    return _error("Not found", 404)


@signed("read")
def insights_posts(request):
    from apps.insights import public
    from apps.insights.models import Author, Topic

    if not _site().insights_open:
        return _insights_closed()
    page = _page(request)
    format_slug = _slug_param(request, "format")
    topic_slug = _slug_param(request, "topic")
    author_slug = _slug_param(request, "author")
    if page is None or None in (format_slug, topic_slug, author_slug):
        return _error("Not found", 404)
    format_key = public.format_from_slug(format_slug) if format_slug else None
    if format_slug and format_key is None:
        return _error("Not found", 404)
    topic_id = author_id = None
    if topic_slug:
        topic = Topic.objects.filter(slug=topic_slug).first()
        if topic is None:
            return _error("Not found", 404)
        topic_id = str(topic.id)
    if author_slug:
        author = Author.objects.filter(slug=author_slug).first()
        if author is None:
            return _error("Not found", 404)
        author_id = str(author.id)
    data = public.post_page(
        public.Catalogue(), page=page, format_key=format_key, topic_id=topic_id, author_id=author_id
    )
    return _json(data) if data is not None else _error("Not found", 404)


@signed("read")
def insights_post(request, slug):
    from apps.insights import public

    if not _site().insights_open:
        return _insights_closed()
    data = public.post_detail(public.Catalogue(), slug)
    return _json(data) if data is not None else _error("Not found", 404)


@signed("read")
def insights_author(request, slug):
    from apps.insights import public

    if not _site().insights_open:
        return _insights_closed()
    data = public.author_page(public.Catalogue(), slug)
    return _json(data) if data is not None else _error("Not found", 404)


@signed("read")
def insights_topics(request):
    from apps.insights import public

    if not _site().insights_open:
        return _insights_closed()
    return _json(public.topics_list(public.Catalogue()))


@signed("read")
def insights_topic(request, slug):
    from apps.insights import public

    if not _site().insights_open:
        return _insights_closed()
    page = _page(request)
    if page is None:
        return _error("Not found", 404)
    data = public.topic_page(public.Catalogue(), slug, page)
    return _json(data) if data is not None else _error("Not found", 404)


@signed("read")
def insights_feed(request):
    from apps.insights import public

    if not _site().insights_open:
        return _insights_closed()
    return _json(public.feed(public.Catalogue()))


# --- Careers -------------------------------------------------------------------------------------


@signed("read")
def careers_page(request):
    from apps.careers import public

    if not _site().careers_open:
        return _error("Not found", 404)
    return _json(public.careers_page())


@signed("read")
def careers_role(request, slug):
    from apps.careers import public

    if not _site().careers_open:
        return _error("Not found", 404)
    data = public.role_detail(slug)
    return _json(data) if data is not None else _error("Not found", 404)


# --- Preview -------------------------------------------------------------------------------------


@signed("read")
def preview(request, entity, item_id):
    """The working copy shaped like the snapshot. Needs the read signature and a preview token for the
    same entity and id. Works whether or not the section is open."""
    if entity not in signing.PREVIEW_ENTITIES:
        return _error("Not found", 404)
    try:
        item_uuid = uuid.UUID(str(item_id))
    except ValueError:
        return _error("Not found", 404)
    try:
        signing.verify_preview_token(request.headers.get(PREVIEW_HEADER, ""), entity, item_uuid)
    except signing.NotConfigured:
        return _error("Not configured", 503)
    except signing.InvalidSignature:
        return _error("Invalid preview token", 401)
    if entity == "post":
        from apps.insights import public
        from apps.insights.models import Post

        post = Post.objects.filter(pk=item_uuid).first()
        detail = public.preview_detail(post) if post is not None else None
        if detail is None:
            return _error("Not found", 404)
        return _json({"entity": "post", "status": post.status, "post": detail, "role": None})
    from apps.careers import public as careers_public
    from apps.careers.models import Role

    role = Role.objects.filter(pk=item_uuid).first()
    detail = careers_public.preview_detail(role) if role is not None else None
    if detail is None:
        return _error("Not found", 404)
    return _json({"entity": "role", "status": role.status, "post": None, "role": detail})


def not_found(request, *args, **kwargs):
    return _error("Not found", 404)
