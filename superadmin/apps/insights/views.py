"""Insights admin (brief 7.1 to 7.3 and 7.6). Thin views: rules live in services.py and taxonomy.py,
permissions in access.py. Every page works without JavaScript; the editor script adds autosave,
the Markdown toolbar, previews and image paste."""

import json
from datetime import datetime

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import Http404, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import role_required
from apps.content_sync import formatting, media, sections, signing
from apps.content_sync import render as renderer
from apps.content_sync import services as content_services
from apps.content_sync import status as sync_status
from apps.content_sync.choices import Practice
from apps.content_sync.models import MediaAsset, SiteSettings

from . import access, public, selectors, services, taxonomy
from .forms import (
    AuthorForm,
    CoverForm,
    HomeSectionForm,
    InsightsCopyForm,
    NewPostForm,
    PostForm,
    TopicForm,
)
from .models import Author, Post, PostFormat, PostRevision, PostStatus, Topic

PAGE_SIZE = 50
STATUS_TONES = {
    PostStatus.PUBLISHED: "text-mineral-700 dark:text-mineral-300",
    PostStatus.SCHEDULED: "text-cobalt-600 dark:text-cobalt-300",
    PostStatus.IN_REVIEW: "text-slate-800 dark:text-slate-100",
    PostStatus.APPROVED: "text-slate-800 dark:text-slate-100",
}
MUTED = "text-slate-500 dark:text-slate-400"
EDIT_ACTIONS = {"submit", "return", "restore", "delete", "duplicate"}
PUBLISH_ACTIONS = {"approve", "publish", "schedule", "unschedule", "unpublish"}
PREVIEW_FRAME_CSP = (
    "default-src 'none'; img-src {img}; style-src 'unsafe-inline'; font-src {font}; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
)


def _require(allowed: bool) -> None:
    if not allowed:
        raise PermissionDenied


def _web_base() -> str:
    targets = settings.CONTENT_WEB_TARGETS
    return targets[0] if targets else ""


def _post(pk) -> Post:
    return get_object_or_404(Post, pk=pk)


def _status_label(post: Post) -> str:
    if post.status == PostStatus.SCHEDULED and post.publish_at:
        local = formatting.london(post.publish_at)
        return f"SCHEDULED · {formatting.date_short(post.publish_at).upper()} {local:%H:%M}"
    return post.get_status_display().upper()


SECTIONS = (
    ("posts", "Posts", "insights:posts"),
    ("authors", "Authors", "insights:authors"),
    ("topics", "Topics", "insights:topics"),
    ("settings", "Settings", "insights:settings"),
)


def _common(request) -> dict:
    return {
        "insights_sections": [(key, label, reverse(name)) for key, label, name in SECTIONS],
        "overall": sync_status.overall(),
        "can_edit": access.can_edit(request.user),
        "can_publish": access.can_publish(request.user),
        "insights_open": SiteSettings.load().insights_open,
    }


# --- Posts list ----------------------------------------------------------------------------------


@role_required()
@require_GET
def root(request):
    return redirect("insights:posts")


@role_required()
@require_GET
def post_list(request):
    _require(access.can_view(request.user))
    tab = request.GET.get("tab", "all")
    tab = tab if tab in selectors.TABS else "all"
    query = request.GET.get("q", "").strip()[: selectors.MAX_QUERY]
    filters = {
        "format_key": request.GET.get("format", ""),
        "author_id": request.GET.get("author", ""),
        "topic_id": request.GET.get("topic", ""),
    }
    rows = selectors.posts(tab=tab, query=query, **filters)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page"))
    now = timezone.now()
    statuses = sync_status.statuses_for("post", [(post.pk, services.is_live(post, now)) for post in page])
    counts = selectors.tab_counts()
    base = request.GET.copy()
    base.pop("page", None)
    tabs = []
    for key, (label, _) in selectors.TABS.items():
        params = base.copy()
        params["tab"] = key
        tabs.append({"key": key, "label": label, "count": counts.get(key, 0), "query": params.urlencode()})
    context = {
        **_common(request),
        "tabs": tabs,
        "tab": tab,
        "query": query,
        "filters": filters,
        "formats": PostFormat.choices,
        "authors": Author.objects.order_by("name"),
        "topics": Topic.objects.order_by("kind", "sort", "name"),
        "page": page,
        "rows": [
            {
                "post": post,
                "status": _status_label(post),
                "tone": STATUS_TONES.get(post.status, MUTED),
                "sync": statuses[str(post.pk)],
                "authors": [link.author.name for link in post.author_links.all()],
                "live_url": f"{_web_base()}/insights/{post.published_slug}"
                if _web_base() and services.is_live(post, now)
                else "",
            }
            for post in page
        ],
        "querystring": base.urlencode(),
        "web_base": _web_base(),
    }
    return render(request, "insights/post_list.html", context)


@role_required()
@require_http_methods(["GET", "POST"])
def post_new(request):
    _require(access.can_edit(request.user))
    form = NewPostForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            post = services.create_post(**form.cleaned_data, actor=request.user, request=request)
        except ValidationError as exc:
            for field, errors in exc.message_dict.items():
                form.add_error(field if field in form.fields else None, errors)
        else:
            return redirect("insights:post", pk=post.pk)
    return render(request, "insights/post_new.html", {**_common(request), "form": form})


# --- Editor --------------------------------------------------------------------------------------


def _rail_context(request, post: Post) -> dict:
    now = timezone.now()
    live = services.is_live(post, now)
    current_hash = services.revision_hash(post)
    checks = services.checks_for(post, current_hash)
    blockers = services.publish_blockers(post, check_render=False)
    return {
        "post": post,
        "status_label": _status_label(post),
        "status_tone": STATUS_TONES.get(post.status, MUTED),
        "sync": sync_status.item_status("post", post.pk, live=live),
        "checks": checks,
        "blockers": blockers,
        "live": live,
        "live_url": f"{_web_base()}/insights/{post.published_slug}" if live and _web_base() else "",
        "can_delete": services.can_delete(post),
        "can_edit": access.can_edit(request.user),
        "can_publish": access.can_publish(request.user),
        "authors_problem": services.authors_problem(post),
        "schedule_default": formatting.london(now).strftime("%Y-%m-%dT%H:%M"),
        "preview_ready": bool(_web_base() and signing.keys_for("preview")),
    }


def _editor_context(request, post: Post, form: PostForm | None = None) -> dict:
    form = form or PostForm(post=post)
    return {
        **_common(request),
        **_rail_context(request, post),
        "form": form,
        "cover_url": media.public_url(post.cover_path),
        "slug_notes": services.slug_notes(post),
        "revisions": post.revisions.select_related("published_by")[:20],
        "web_base": _web_base(),
        "media_enabled": media.media_enabled(),
        "practices": Practice.choices,
    }


@role_required()
@require_http_methods(["GET", "POST"])
def post_edit(request, pk):
    _require(access.can_view(request.user))
    post = _post(pk)
    if request.method == "POST":
        _require(access.can_edit(request.user))
        form = PostForm(request.POST, post=post)
        if form.is_valid():
            try:
                post = services.save_working_copy(
                    post,
                    form.working_data(),
                    authors=form.authors(),
                    topics=form.cleaned_data["topics"],
                    related=form.related(),
                    actor=request.user,
                    expected_updated_at=form.expected_updated_at(),
                    request=request,
                )
            except services.Conflict:
                messages.error(
                    request, "This post changed since you opened it. Reload it to see the latest version."
                )
            except ValidationError as exc:
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                messages.success(request, "Saved.")
                return redirect("insights:post", pk=post.pk)
        return render(request, "insights/post_edit.html", _editor_context(request, post, form), status=400)
    return render(request, "insights/post_edit.html", _editor_context(request, post))


@role_required()
@require_POST
def post_autosave(request, pk):
    if not access.can_edit(request.user):
        return JsonResponse({"error": "You do not have permission to edit posts."}, status=403)
    post = _post(pk)
    form = PostForm(request.POST, post=post)
    if not form.is_valid():
        return JsonResponse({"errors": {k: [str(e) for e in v] for k, v in form.errors.items()}}, status=400)
    try:
        post = services.save_working_copy(
            post,
            form.working_data(),
            authors=form.authors(),
            topics=form.cleaned_data["topics"],
            related=form.related(),
            actor=request.user,
            expected_updated_at=form.expected_updated_at(),
            request=request,
        )
    except services.Conflict as conflict:
        return JsonResponse(
            {
                "conflict": True,
                "message": "This post changed since you opened it.",
                "updatedAt": conflict.post.updated_at.isoformat(),
            },
            status=409,
        )
    except ValidationError as exc:
        return JsonResponse({"errors": exc.message_dict}, status=400)
    return JsonResponse(
        {
            "ok": True,
            "savedAt": f"SAVED {formatting.clock(post.updated_at)}",
            "updatedAt": post.updated_at.isoformat(),
            "hasUnpublishedChanges": post.has_unpublished_changes,
            "readingMinutes": post.reading_minutes,
            "slugNotes": services.slug_notes(post),
        }
    )


@role_required()
@require_GET
def post_rail(request, pk):
    _require(access.can_view(request.user))
    post = _post(pk)
    return render(request, "insights/_rail.html", _rail_context(request, post))


@role_required()
@require_GET
def post_sync(request, pk):
    _require(access.can_view(request.user))
    post = _post(pk)
    status = sync_status.item_status("post", post.pk, live=services.is_live(post))
    return render(
        request,
        "content_sync/_item_status.html",
        {
            "sync": status,
            "poll_url": request.path,
            "next_url": reverse("insights:post", args=[post.pk]),
            "can_edit": access.can_edit(request.user),
        },
    )


def _parse_local(value: str) -> datetime | None:
    try:
        naive = datetime.strptime(value.strip(), "%Y-%m-%dT%H:%M")
    except (ValueError, AttributeError):
        return None
    return naive.replace(tzinfo=formatting.LONDON)


@role_required()
@require_POST
def post_action(request, pk, action):
    post = _post(pk)
    if action in PUBLISH_ACTIONS:
        _require(access.can_publish(request.user))
    elif action == "archive":
        public_now = post.status in (PostStatus.PUBLISHED, PostStatus.SCHEDULED)
        _require(access.can_publish(request.user) if public_now else access.can_edit(request.user))
    elif action in EDIT_ACTIONS:
        _require(access.can_edit(request.user))
    else:
        raise Http404
    user = request.user
    try:
        if action == "submit":
            services.submit_for_review(post, user, request=request)
            message = "Submitted for review."
        elif action == "approve":
            services.approve(post, user, request=request)
            message = "Approved."
        elif action == "return":
            services.return_to_draft(post, user, request=request)
            message = "Returned to draft."
        elif action == "publish":
            was_live = post.status == PostStatus.PUBLISHED
            services.publish(post, user, request=request)
            message = "Changes published." if was_live else "Published."
        elif action == "schedule":
            services.schedule(post, user, _parse_local(request.POST.get("publish_at", "")), request=request)
            message = "Scheduled."
        elif action == "unschedule":
            services.unschedule(post, user, request=request)
            message = "Schedule cancelled. The post is approved."
        elif action == "unpublish":
            services.unpublish(post, user, request=request)
            message = "Unpublished. The post is a draft again."
        elif action == "archive":
            services.archive(post, user, request=request)
            message = "Archived."
        elif action == "restore":
            services.restore(post, user, request=request)
            message = "Restored to draft."
        elif action == "duplicate":
            clone = services.duplicate(post, user, request=request)
            messages.success(request, "Duplicated. You are editing the copy.")
            return redirect("insights:post", pk=clone.pk)
        else:  # delete
            services.delete(post, user, request=request)
            messages.success(request, "Deleted.")
            return redirect("insights:posts")
    except ValidationError as exc:
        for text in exc.messages:
            messages.error(request, text)
        return redirect("insights:post", pk=post.pk)
    messages.success(request, message)
    return redirect("insights:post", pk=post.pk)


@role_required()
@require_POST
def post_check(request, pk, key):
    _require(access.can_edit(request.user))
    post = _post(pk)
    try:
        if request.POST.get("checked") == "1":
            services.tick_check(post, key, request.user, request=request)
        else:
            services.untick_check(post, key, request.user, request=request)
    except ValidationError as exc:
        if getattr(request, "htmx", False):
            response = render(request, "insights/_rail.html", _rail_context(request, post))
            response["HX-Trigger"] = json.dumps({"vsa-toast": {"message": " ".join(exc.messages)}})
            return response
        for text in exc.messages:
            messages.error(request, text)
        return redirect("insights:post", pk=post.pk)
    if getattr(request, "htmx", False):
        return render(request, "insights/_rail.html", _rail_context(request, post))
    return redirect("insights:post", pk=post.pk)


@role_required()
@require_POST
def post_cover(request, pk):
    _require(access.can_edit(request.user))
    post = _post(pk)
    if request.POST.get("remove") == "1":
        services.remove_cover(post, actor=request.user, request=request)
        messages.success(request, "Cover removed.")
        return redirect("insights:post", pk=post.pk)
    form = CoverForm(request.POST, request.FILES)
    if not form.is_valid():
        messages.error(request, "Choose an image and describe it in the alt text.")
        return redirect("insights:post", pk=post.pk)
    try:
        data = media.read_upload(form.cleaned_data["image"])
        services.set_cover(post, data, alt=form.cleaned_data["alt"], actor=request.user, request=request)
    except ValidationError as exc:
        for text in exc.messages:
            messages.error(request, text)
    else:
        messages.success(request, "Cover uploaded.")
    return redirect("insights:post", pk=post.pk)


@role_required()
@require_POST
def media_upload(request):
    """Inline body image: JSON {url, width, height, markdown}. Alt text is asked for first."""
    if not access.can_edit(request.user):
        return JsonResponse({"error": "You do not have permission to upload images."}, status=403)
    upload = request.FILES.get("image")
    alt = (request.POST.get("alt") or "").strip()
    if upload is None:
        return JsonResponse({"error": "Choose an image."}, status=400)
    if not alt:
        return JsonResponse({"error": "Describe the image in the alt text first."}, status=400)
    try:
        asset = media.store_image(
            media.read_upload(upload), purpose=MediaAsset.Purpose.INLINE, alt=alt, user=request.user
        )
    except ValidationError as exc:
        return JsonResponse({"error": " ".join(exc.messages)}, status=400)
    url = media.public_url(asset.key)
    safe_alt = alt.replace("[", "(").replace("]", ")")
    return JsonResponse(
        {"url": url, "width": asset.width, "height": asset.height, "markdown": f"![{safe_alt}]({url})"},
        status=201,
    )


# --- Previews ------------------------------------------------------------------------------------


@role_required()
@require_GET
def post_preview_panel(request, pk):
    """The rendered body (website renderer) with its warnings; the HTML itself loads in a sandboxed frame."""
    _require(access.can_view(request.user))
    post = _post(pk)
    result = renderer.render(post.body_md, "post")
    return render(
        request,
        "insights/_preview_panel.html",
        {
            "post": post,
            "result": result,
            "frame_url": reverse("insights:post_preview_frame", args=[post.pk])
            + f"?v={services.body_hash(post)[:16]}",
        },
    )


def _frame_csp(request) -> str:
    own = f"{request.scheme}://{request.get_host()}"
    images = ["data:", own]
    if settings.CONTENT_MEDIA_PUBLIC_BASE_URL:
        images.append(settings.CONTENT_MEDIA_PUBLIC_BASE_URL)
    return PREVIEW_FRAME_CSP.format(img=" ".join(images), font=own)


@role_required()
@require_GET
@xframe_options_sameorigin
def post_preview_frame(request, pk):
    _require(access.can_view(request.user))
    post = _post(pk)
    result = renderer.render(post.body_md, "post")
    html = render(
        request,
        "insights/preview_frame.html",
        {"post": post, "result": result, "cover_url": media.public_url(post.cover_path)},
    ).content.decode()
    response = HttpResponse(html)
    response["Content-Security-Policy"] = _frame_csp(request)
    response._csp_exempt = True  # django-csp must not replace this document's policy.
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@role_required()
@require_GET
def post_site_preview(request, pk):
    """Open the website in Draft Mode with a fresh 15-minute preview token (brief 3.6)."""
    _require(access.can_view(request.user))
    post = _post(pk)
    base = _web_base()
    if not base:
        messages.error(
            request,
            "No website target is configured (CONTENT_WEB_TARGETS), so there is nothing to preview on.",
        )
        return redirect("insights:post", pk=post.pk)
    if not public.working_authors(post):
        messages.error(request, "Add an author before previewing on the website.")
        return redirect("insights:post", pk=post.pk)
    try:
        token = signing.preview_token("post", post.pk, services.revision_hash(post))
    except signing.NotConfigured:
        messages.error(request, "Preview is not configured (CONTENT_PREVIEW_SECRET is not set).")
        return redirect("insights:post", pk=post.pk)
    return HttpResponseRedirect(f"{base}/api/content/preview?token={token}")


# --- Revisions -----------------------------------------------------------------------------------


@role_required()
@require_GET
def revision_view(request, pk, revision_id):
    _require(access.can_view(request.user))
    post = _post(pk)
    revision = get_object_or_404(
        PostRevision.objects.select_related("published_by"), pk=revision_id, post=post
    )
    return render(
        request,
        "insights/revision.html",
        {**_common(request), "post": post, "revision": revision, "diff": services.diff(revision, post)},
    )


@role_required()
@require_POST
def revision_restore(request, pk, revision_id):
    _require(access.can_edit(request.user))
    post = _post(pk)
    revision = get_object_or_404(PostRevision, pk=revision_id, post=post)
    services.restore_revision(post, revision, request.user, request=request)
    messages.success(
        request, "Revision restored to the working copy. Nothing changes on the website until you publish."
    )
    return redirect("insights:post", pk=post.pk)


# --- Authors -------------------------------------------------------------------------------------


@role_required()
@require_GET
def author_list(request):
    _require(access.can_view(request.user))
    authors = Author.objects.select_related("confirmed_real_by").order_by("name")
    rows = [{"author": author, "public": taxonomy.author_is_public(author)} for author in authors]
    return render(
        request,
        "insights/author_list.html",
        {**_common(request), "rows": rows, "can_edit_authors": access.can_edit_authors(request.user)},
    )


@role_required()
@require_http_methods(["GET", "POST"])
def author_new(request):
    _require(access.can_edit_authors(request.user))
    form = AuthorForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        try:
            author = taxonomy.create_author(
                form.data_for_service(include_slug=True), actor=request.user, request=request
            )
        except ValidationError as exc:
            for field, errors in exc.message_dict.items():
                form.add_error(field if field in form.fields else None, errors)
        else:
            messages.success(
                request, "Author added. Confirm they are a real person before their posts can publish."
            )
            return redirect("insights:author", pk=author.pk)
    return render(request, "insights/author_edit.html", {**_common(request), "form": form, "author": None})


@role_required()
@require_http_methods(["GET", "POST"])
def author_edit(request, pk):
    _require(access.can_view(request.user))
    author = get_object_or_404(Author, pk=pk)
    initial = {
        "name": author.name,
        "slug": author.slug,
        "role_title": author.role_title,
        "bio_md": author.bio_md,
        "linkedin_url": author.linkedin_url,
        "admin_user": author.admin_user_id,
    }
    form = AuthorForm(request.POST or None, initial=initial)
    if request.method == "POST":
        _require(access.can_edit_authors(request.user))
        if form.is_valid():
            try:
                taxonomy.update_author(
                    author, form.data_for_service(include_slug=True), actor=request.user, request=request
                )
            except ValidationError as exc:
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                messages.success(request, "Author saved.")
                return redirect("insights:author", pk=author.pk)
    return render(
        request,
        "insights/author_edit.html",
        {
            **_common(request),
            "form": form,
            "author": author,
            "avatar_url": media.public_url(author.avatar_path),
            "public": taxonomy.author_is_public(author),
            "post_count": author.post_links.count(),
            "can_edit_authors": access.can_edit_authors(request.user),
            "can_confirm": access.can_confirm_authors(request.user),
            "media_enabled": media.media_enabled(),
        },
    )


@role_required()
@require_POST
def author_action(request, pk, action):
    author = get_object_or_404(Author, pk=pk)
    if action in ("confirm", "unconfirm"):
        _require(access.can_confirm_authors(request.user))
    elif action in ("photo", "remove_photo", "activate", "deactivate"):
        _require(access.can_edit_authors(request.user))
    else:
        raise Http404
    try:
        if action == "confirm":
            taxonomy.confirm_author(author, actor=request.user, request=request)
            messages.success(request, "Recorded: a real person who approved this profile.")
        elif action == "unconfirm":
            taxonomy.withdraw_confirmation(author, actor=request.user, request=request)
            messages.success(request, "Confirmation withdrawn.")
        elif action == "photo":
            upload = request.FILES.get("image")
            if upload is None:
                raise ValidationError("Choose a photo.")
            taxonomy.set_author_photo(author, media.read_upload(upload), actor=request.user, request=request)
            messages.success(request, "Photo uploaded.")
        elif action == "remove_photo":
            taxonomy.remove_author_photo(author, actor=request.user, request=request)
            messages.success(request, "Photo removed.")
        else:
            taxonomy.set_author_active(author, action == "activate", actor=request.user, request=request)
            messages.success(request, "Author activated." if action == "activate" else "Author deactivated.")
    except ValidationError as exc:
        for text in exc.messages:
            messages.error(request, text)
    return redirect("insights:author", pk=author.pk)


# --- Topics --------------------------------------------------------------------------------------


@role_required()
@require_http_methods(["GET", "POST"])
def topic_list(request):
    _require(access.can_view(request.user))
    form = TopicForm(request.POST or None)
    if request.method == "POST":
        _require(access.can_edit_topics(request.user))
        if form.is_valid():
            try:
                taxonomy.create_topic(
                    form.data_for_service(include_slug=True), actor=request.user, request=request
                )
            except ValidationError as exc:
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                messages.success(request, "Topic added.")
                return redirect("insights:topics")
    topics = list(Topic.objects.order_by("sort", "name"))
    used = {str(t.pk): t.post_links.count() for t in topics}
    return render(
        request,
        "insights/topic_list.html",
        {
            **_common(request),
            "form": form,
            "rows": [{"topic": topic, "used": used[str(topic.pk)]} for topic in topics],
            "can_edit_topics": access.can_edit_topics(request.user),
        },
    )


@role_required()
@require_http_methods(["GET", "POST"])
def topic_edit(request, pk):
    _require(access.can_view(request.user))
    topic = get_object_or_404(Topic, pk=pk)
    form = TopicForm(
        request.POST or None,
        initial={
            "name": topic.name,
            "slug": topic.slug,
            "kind": topic.kind,
            "description": topic.description,
        },
    )
    if request.method == "POST":
        _require(access.can_edit_topics(request.user))
        if form.is_valid():
            try:
                taxonomy.update_topic(
                    topic, form.data_for_service(include_slug=True), actor=request.user, request=request
                )
            except ValidationError as exc:
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                messages.success(request, "Topic saved.")
                return redirect("insights:topics")
    return render(
        request,
        "insights/topic_edit.html",
        {
            **_common(request),
            "form": form,
            "topic": topic,
            "used": topic.post_links.count(),
            "can_edit_topics": access.can_edit_topics(request.user),
        },
    )


@role_required()
@require_POST
def topic_action(request, pk, action):
    _require(access.can_edit_topics(request.user))
    topic = get_object_or_404(Topic, pk=pk)
    try:
        if action in ("up", "down"):
            taxonomy.move_topic(topic, action, actor=request.user, request=request)
        elif action == "delete":
            taxonomy.delete_topic(topic, actor=request.user, request=request)
            messages.success(request, "Topic deleted.")
        else:
            raise Http404
    except ValidationError as exc:
        for text in exc.messages:
            messages.error(request, text)
    return redirect("insights:topics")


# --- Settings ------------------------------------------------------------------------------------


def _section_preview(config: dict) -> dict:
    catalogue = public.Catalogue()
    posts = catalogue.posts
    if config.get("mode") == "pinned":
        posts = [p for p in posts if p.published_pin_home] + [p for p in posts if not p.published_pin_home]
    return {"config": config, "items": [catalogue.summary(p) for p in posts[: config.get("count") or 3]]}


@role_required()
@require_http_methods(["GET", "POST"])
def settings_page(request):
    _require(access.can_view(request.user))
    site = SiteSettings.load()
    config = sections.load(sections.HOME_INSIGHTS)
    action = request.POST.get("action") if request.method == "POST" else None
    section_form = HomeSectionForm(request.POST if action == "section" else None, initial=config)
    copy_form = InsightsCopyForm(
        request.POST if action == "copy" else None,
        initial={
            "heading": site.insights_heading,
            "intro": site.insights_intro,
            "editorial_note": site.insights_editorial_note,
        },
    )
    if action:
        _require(access.can_edit_settings(request.user))
    if action == "section" and section_form.is_valid():
        try:
            content_services.update_section(
                sections.HOME_INSIGHTS, section_form.cleaned_data, actor=request.user, request=request
            )
        except ValidationError as exc:
            for field, errors in exc.message_dict.items():
                section_form.add_error(field if field in section_form.fields else None, errors)
        else:
            messages.success(request, "Homepage section saved.")
            return redirect("insights:settings")
    if action == "copy" and copy_form.is_valid():
        try:
            content_services.update_insights_copy(
                **copy_form.cleaned_data, actor=request.user, request=request
            )
        except ValidationError as exc:
            for field, errors in exc.message_dict.items():
                copy_form.add_error(field if field in copy_form.fields else None, errors)
        else:
            messages.success(request, "Insights page copy saved.")
            return redirect("insights:settings")
    preview_config = config
    if action == "section" and section_form.is_bound:
        preview_config = {**config, **{k: v for k, v in section_form.data.items() if k in config}}
    return render(
        request,
        "insights/settings.html",
        {
            **_common(request),
            "section_form": section_form,
            "copy_form": copy_form,
            "preview": _section_preview(_preview_config(preview_config)),
            "can_edit_settings": access.can_edit_settings(request.user),
        },
    )


def _preview_config(data: dict) -> dict:
    try:
        count = int(data.get("count") or 3)
    except (TypeError, ValueError):
        count = 3
    return {
        "enabled": data.get("enabled") in (True, "on", "true", "1"),
        "heading": str(data.get("heading") or ""),
        "intro": str(data.get("intro") or ""),
        "count": min(max(count, 2), 4),
        "mode": data.get("mode") if data.get("mode") in ("latest", "pinned") else "latest",
    }


@role_required()
@require_POST
def settings_preview(request):
    """Live preview of the homepage section as the form is edited (HTMX)."""
    _require(access.can_view(request.user))
    return render(
        request, "insights/_home_preview.html", {"preview": _section_preview(_preview_config(request.POST))}
    )
