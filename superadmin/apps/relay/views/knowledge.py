"""Relay knowledge: what Relay may answer from. Entries, sources, gaps, the retrieval test, the Master
FAQ views and the team-answer editor. Publish, archive, re-index and FAQ sync are SuperAdmin only."""

from __future__ import annotations

from django.contrib import messages
from django.http import HttpResponse, HttpResponseRedirect
from django.utils import timezone
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.http import require_http_methods, require_POST

from .. import markdown, presenters, services
from ..client import RelayError, get_client
from ..forms import KnowledgeForm, RetrievalTestForm
from .common import error_response, is_htmx, relay_view, render_page, toast

NOTION_FAQ_URL = "https://app.notion.com/p/3fae4b3411f9808cb450c69d43e8f22c"
VIEWS = ("entries", "confirm", "held")
SOURCES = (("cms", "Website · CMS"), ("repo", "Repo"), ("team_answer", "Team answer"), ("faq", "Master FAQ"))
SOURCE_LABELS = dict(SOURCES)
STATUSES = (("published", "Published"), ("draft", "Draft"), ("archived", "Archived"))


def status_label(item: dict) -> tuple[str, str]:
    """(label, tone) for an entry's status."""
    status = item.get("status") or ""
    if status == "published":
        return "Published", "mineral"
    if status == "archived":
        return "Archived", "muted"
    if item.get("source") == "faq":
        return "Awaiting founder sign-off", "muted"
    return "Draft · review", "muted"


def _entry(item: dict) -> dict:
    label, tone = status_label(item)
    return {
        **item,
        "source_label": SOURCE_LABELS.get(item.get("source"), item.get("source") or ""),
        "status_label": label,
        "status_tone": tone,
        "updated": presenters.parse_time(item.get("updatedAt")),
    }


SYNC_STALE_HOURS = 24


def sync_age(run: dict | None, fallback=None) -> dict:
    """Last sync of one source: ``{"detail": "synced 3 h ago", "stale": bool}``.

    ``run`` is the website's ``sync`` entry (last finished sync run, docs/relay/API.md). Older
    websites send only ``syncedAt`` (the last time content changed), used as the fallback. A
    source not synced in the last 24 hours is flagged so the page can warn (finding D4).
    """
    run = run or {}
    moment = presenters.parse_time(run.get("lastSyncAt") or fallback)
    if moment is None:
        return {"detail": "not synced yet", "stale": True}
    hours = run.get("ageHours")
    if not isinstance(hours, int | float):
        hours = (timezone.now() - moment).total_seconds() / 3600
    stale = bool(run.get("stale")) if "stale" in run else hours > SYNC_STALE_HOURS
    return {"detail": f"synced {presenters.long_age(moment)} ago", "stale": stale}


def _source_strip(sources: dict, sync: dict | None = None) -> list[dict]:
    sync = sync or {}
    cms = sources.get("cms") or {}
    repo = sources.get("repo") or {}
    team = sources.get("team_answer") or {}
    faq = sources.get("faq") or {}
    cms_age = sync_age(sync.get("cms"), cms.get("syncedAt"))
    repo_age = sync_age(sync.get("repo"), repo.get("syncedAt"))
    faq_age = sync_age(sync.get("faq"), faq.get("syncedAt"))
    faq_when = "using snapshot" if faq.get("mode") == "snapshot" else faq_age["detail"]
    return [
        {
            "label": "WEBSITE · CMS",
            "value": f"{cms.get('count', 0)} pages",
            "detail": cms_age["detail"],
            "stale": cms_age["stale"],
        },
        {
            "label": "RELAY KNOWLEDGE · REPO",
            "value": f"{repo.get('count', 0)} entries",
            "detail": repo_age["detail"],
            "stale": repo_age["stale"],
        },
        {
            "label": "TEAM ANSWERS",
            "value": f"{team.get('count', 0)} entries",
            "detail": "Saved from conversations, reviewed",
        },
        {
            "label": "MASTER FAQ · NOTION",
            "value": f"{faq.get('verified', 0)} live",
            "detail": f"{faq.get('awaiting', 0)} awaiting confirmation · {faq_when}",
            "stale": faq.get("mode") != "snapshot" and faq_age["stale"],
        },
    ]


@relay_view()
@require_http_methods(["GET"])
def knowledge(request):
    view = request.GET.get("view", "entries")
    view = view if view in VIEWS else "entries"
    filters = {
        "source": request.GET.get("source", "") if request.GET.get("source", "") in SOURCE_LABELS else "",
        "status": request.GET.get("status", "") if request.GET.get("status", "") in dict(STATUSES) else "",
        "section": request.GET.get("section", "").strip()[:80],
        "q": request.GET.get("q", "").strip()[:100],
    }
    client = get_client(request.user)
    context = {
        "view": view,
        "filters": filters,
        "sources": SOURCES,
        "statuses": STATUSES,
        "notion_faq_url": NOTION_FAQ_URL,
        "test_form": RetrievalTestForm(),
        "threshold": None,
    }
    try:
        data = client.knowledge(**filters) or {}
        items = [_entry(item) for item in data.get("items") or []]
        sections = sorted(
            {item.get("section") for item in items if item.get("section")} | ({filters["section"]} - {""})
        )
        context.update(
            {
                "strip": _source_strip(data.get("sources") or {}, data.get("sync")),
                "items": items,
                "sections": sections,
                "gaps": (client.gaps(30) or {}).get("gaps") or [],
            }
        )
        if view != "entries":
            faq = client.faq() or {}
            run = faq.get("lastRun") or {}
            context["faq"] = faq
            context["faq_run_at"] = presenters.parse_time(run.get("finishedAt") or run.get("startedAt"))
        relay_settings = services.relay_settings(request.user)
        if relay_settings:
            context["threshold"] = relay_settings.get("confidenceThreshold")
    except RelayError as error:
        context["relay_error"] = error.user_message
    if is_htmx(request) and request.htmx.target == "relay-knowledge-table":
        return render(request, "relay/_knowledge_table.html", context)
    return render_page(request, "relay/knowledge.html", context, "knowledge")


@relay_view()
@require_POST
def test_retrieval(request):
    form = RetrievalTestForm(request.POST)
    if not form.is_valid():
        return render(
            request, "relay/_test_results.html", {"form_error": "Enter a question of up to 300 characters."}
        )
    try:
        data = (
            get_client(request.user).test_retrieval(
                form.cleaned_data["question"], form.cleaned_data["page_path"]
            )
            or {}
        )
    except RelayError as error:
        return render(request, "relay/_test_results.html", {"form_error": error.user_message})
    threshold = data.get("threshold")
    chunks = []
    for chunk in data.get("chunks") or []:
        confidence = chunk.get("confidence")
        above = (
            isinstance(confidence, int | float)
            and isinstance(threshold, int | float)
            and confidence >= threshold
        )
        chunks.append({**chunk, "above": above})
    return render(
        request,
        "relay/_test_results.html",
        {"chunks": chunks, "threshold": threshold, "confident": bool(data.get("confident"))},
    )


@relay_view()
@require_POST
def preview(request):
    return render(
        request, "relay/_preview.html", {"html": markdown.render(request.POST.get("body_md", "")[:60000])}
    )


@relay_view()
@require_http_methods(["GET", "POST"])
def knowledge_new(request):
    question = request.GET.get("question", "").strip()[:300]
    initial = {"title": question, "type": "faq", "body_md": ""} if question else {"type": "faq"}
    form = KnowledgeForm(request.POST or None, initial=initial)
    if request.method == "POST" and form.is_valid():
        try:
            document = services.create_document(request.user, form.api_fields(), request=request)
        except RelayError as error:
            form.add_error(None, error.user_message)
        else:
            messages.success(request, "Draft saved. A super admin publishes it when it is ready.")
            if document.get("id"):
                return HttpResponseRedirect(reverse("relay:knowledge_edit", args=[document["id"]]))
            return HttpResponseRedirect(reverse("relay:knowledge"))
    context = {
        "form": form,
        "document": None,
        "is_new": True,
        "preview": markdown.render(form["body_md"].value() or ""),
    }
    return render_page(request, "relay/knowledge_edit.html", context, "knowledge")


@relay_view()
@require_http_methods(["GET", "POST"])
def knowledge_edit(request, document_id):
    document_id = str(document_id)
    try:
        document = (get_client(request.user).document(document_id) or {}).get("document") or {}
    except RelayError as error:
        return error_response(request, error)
    read_only = bool(document.get("readOnly")) or document.get("source") != "team_answer"
    form = KnowledgeForm(
        request.POST if request.method == "POST" and not read_only else None,
        initial=KnowledgeForm.initial_from(document),
    )
    if request.method == "POST":
        if read_only:
            messages.error(request, "This entry comes from its source and cannot be edited here.")
            return HttpResponseRedirect(reverse("relay:knowledge_edit", args=[document_id]))
        if form.is_valid():
            try:
                services.update_document(request.user, document_id, form.api_fields(), request=request)
            except RelayError as error:
                form.add_error(None, error.user_message)
            else:
                messages.success(request, "Entry saved.")
                return HttpResponseRedirect(reverse("relay:knowledge_edit", args=[document_id]))
    if read_only:
        for field in form.fields.values():
            field.disabled = True
    label, tone = status_label(document)
    context = {
        "form": form,
        "document": document,
        "document_id": document_id,
        "read_only": read_only,
        "status_label": label,
        "status_tone": tone,
        "source_label": SOURCE_LABELS.get(document.get("source"), document.get("source") or ""),
        "source_link": document.get("notionUrl") or document.get("url") or "",
        "preview": markdown.render(form["body_md"].value() or document.get("bodyMd") or ""),
        "updated": presenters.parse_time(document.get("updatedAt")),
    }
    return render_page(request, "relay/knowledge_edit.html", context, "knowledge")


def _manage(request, document_id, apply, message: str):
    try:
        apply(str(document_id))
    except RelayError as error:
        if is_htmx(request):
            return error_response(request, error)
        messages.error(request, error.user_message)
    else:
        messages.success(request, message)
    return HttpResponseRedirect(reverse("relay:knowledge_edit", args=[str(document_id)]))


@relay_view(manage=True)
@require_POST
def knowledge_publish(request, document_id):
    return _manage(
        request,
        document_id,
        lambda doc: services.publish(request.user, doc, request=request),
        "Published. Relay can answer from it once indexing finishes.",
    )


@relay_view(manage=True)
@require_POST
def knowledge_archive(request, document_id):
    return _manage(
        request,
        document_id,
        lambda doc: services.archive(request.user, doc, request=request),
        "Archived. Relay no longer answers from it.",
    )


@relay_view(manage=True)
@require_POST
def knowledge_reindex(request, document_id):
    return _manage(
        request, document_id, lambda doc: services.reindex(request.user, doc, request=request), "Re-indexed."
    )


@relay_view(manage=True)
@require_POST
def reindex_all(request):
    try:
        data = services.reindex_all(request.user, request=request)
    except RelayError as error:
        return error_response(request, error)
    message = f"Re-indexed {data.get('documents', 0)} entries ({data.get('chunks', 0)} chunks)."
    if is_htmx(request):
        return toast(HttpResponse(status=204), message)
    messages.success(request, message)
    return HttpResponseRedirect(reverse("relay:knowledge"))


@relay_view()
@require_POST
def suggest_answer(request, gap_id):
    """"Suggested answer" on a gap: a draft team answer from the best-matching page, opened in
    the editor for a person to check, edit and publish (ADR-048)."""
    try:
        data = services.suggest_answer(request.user, str(gap_id), request=request)
    except RelayError as error:
        if is_htmx(request):
            return error_response(request, error)
        messages.error(request, error.user_message)
        return HttpResponseRedirect(reverse("relay:knowledge"))
    source = (data.get("source") or {}).get("title") or "the best-matching page"
    messages.success(request, f"Draft answer suggested from {source}. Check and edit it before publishing.")
    target = reverse("relay:knowledge_edit", args=[str(data["documentId"])])
    if is_htmx(request):
        response = HttpResponse(status=204)
        response["HX-Redirect"] = target
        return response
    return HttpResponseRedirect(target)


@relay_view(manage=True)
@require_POST
def faq_sync(request):
    try:
        run = services.faq_sync(request.user, full=request.POST.get("full") == "1", request=request)
    except RelayError as error:
        return error_response(request, error)
    message = (
        f"Master FAQ synced: {run.get('added', 0)} added, {run.get('updated', 0)} updated, "
        f"{run.get('archived', 0)} archived, {run.get('held', 0)} held."
    )
    messages.success(request, message)
    target = (
        reverse("relay:knowledge")
        + "?view="
        + (request.POST.get("view") if request.POST.get("view") in VIEWS else "confirm")
    )
    if is_htmx(request):
        response = HttpResponse(status=204)
        response["HX-Redirect"] = target
        return response
    return HttpResponseRedirect(target)
