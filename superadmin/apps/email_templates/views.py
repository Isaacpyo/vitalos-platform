"""Mail > Email templates. Super Admin only (checked here and again in the services)."""

from __future__ import annotations

from django.contrib import messages
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Q
from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.views.decorators.cache import never_cache
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import SUPERADMIN, role_required
from apps.core.forms import INPUT

from . import services
from .forms import BLOCK_CHOICES, TemplateForm, apply_op, block_rows, blocks_from_post
from .models import CONTENT_FIELDS, Category, EmailTemplate, ManagedBy, Status
from .rendering import check_content, preview_html, read_unsubscribe_token, render_content, sample_values
from .variables import groups as variable_groups

PREVIEW_SESSION_KEY = "email_template_preview"
DEVICES = ("desktop", "mobile")
THEMES = ("light", "dark")
VIEWS = ("html", "text")

# The preview is shown in a sandboxed iframe with its own policy: no scripts, inline styles only.
FRAME_CSP = (
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
)

STATUS_FILTERS = (
    ("current", "Draft and active"),
    ("draft", "Draft"),
    ("active", "Active"),
    ("archived", "Archived"),
    ("all", "All"),
)


def _slot(pk) -> str:
    return str(pk) if pk else "new"


def _content_from_form(form: TemplateForm, blocks: list[dict]) -> dict:
    data = form.cleaned_data if form.is_bound and hasattr(form, "cleaned_data") else {}
    content = {name: data.get(name, "") for name in CONTENT_FIELDS if name != "blocks"}
    content["blocks"] = blocks
    return content


def _raw_content(post, blocks: list[dict]) -> dict:
    """Content straight from the POST, for previews of unsaved (possibly invalid) edits."""
    content = {name: post.get(name, "") for name in CONTENT_FIELDS if name != "blocks"}
    content["blocks"] = blocks
    return content


def _preview_state(request) -> dict:
    state = request.session.get(PREVIEW_SESSION_KEY, {})
    prefs = state.get("prefs", {"device": "desktop", "theme": "light", "view": "html"})
    for name, allowed in (("device", DEVICES), ("theme", THEMES), ("view", VIEWS)):
        value = request.POST.get(f"preview_{name}") or request.GET.get(f"preview_{name}")
        if value in allowed:
            prefs[name] = value
    state["prefs"] = prefs
    return state


def _preview_context(request, template: EmailTemplate | None, content: dict) -> dict:
    state = _preview_state(request)
    slot = _slot(template.pk if template else None)
    # Keep the session small: only the draft of the editor in use.
    state["drafts"] = {slot: content}
    state["counter"] = state.get("counter", 0) + 1
    request.session[PREVIEW_SESSION_KEY] = state
    enquiry = services.latest_enquiry()
    values = sample_values(request.user, enquiry)
    key = template.key if template else "new-template"
    rendered = render_content(content, values, key=key, recipient=request.user.email)
    preview_url = (
        reverse("email_templates:preview", args=[template.pk])
        if template
        else reverse("email_templates:preview_new")
    )
    return {
        "preview_url": preview_url,
        "preview_devices": (("desktop", "Desktop"), ("mobile", "Mobile")),
        "preview_themes": (("light", "Light"), ("dark", "Dark")),
        "preview_views": (("html", "Email"), ("text", "Plain text")),
        "prefs": state["prefs"],
        "frame_url": reverse("email_templates:frame", args=[slot])
        + f"?theme={state['prefs']['theme']}&v={state['counter']}",
        "rendered": rendered,
        "validation": check_content(content, values),
        "sample_enquiry": enquiry,
        "slot": slot,
        "template": template,
    }


def _editor_context(request, template, form, blocks, *, unsaved=False) -> dict:
    content = (
        _raw_content(request.POST, blocks)
        if request.method == "POST"
        else (template.content() if template else _content_from_form(form, blocks))
    )
    return {
        **_preview_context(request, template, content),
        "template": template,
        "form": form,
        "blocks": block_rows(blocks),
        "block_count": len(blocks),
        "block_choices": BLOCK_CHOICES,
        "input_class": INPUT,
        "variable_groups": variable_groups(),
        "unsaved": unsaved,
        "read_only_note": template is not None and template.managed_by == ManagedBy.WEBSITE,
    }


# --- List ------------------------------------------------------------------------------------------


@role_required(SUPERADMIN)
@require_GET
@never_cache
def template_list(request):
    q = request.GET.get("q", "").strip()[:100]
    category = request.GET.get("category", "")
    status = request.GET.get("status", "current")
    templates = EmailTemplate.objects.select_related("updated_by")
    if q:
        templates = templates.filter(
            Q(name__icontains=q) | Q(subject__icontains=q) | Q(key__icontains=q) | Q(description__icontains=q)
        )
    if category in Category.values:
        templates = templates.filter(category=category)
    if status == "current":
        templates = templates.exclude(status=Status.ARCHIVED)
    elif status in Status.values:
        templates = templates.filter(status=status)
    else:
        status = "all"
    page = Paginator(templates.order_by("category", "name"), 50).get_page(request.GET.get("page"))
    context = {
        "page": page,
        "q": q,
        "category": category,
        "status": status,
        "categories": Category.choices,
        "status_filters": STATUS_FILTERS,
        "total": EmailTemplate.objects.count(),
    }
    template_name = "email_templates/_list.html" if request.htmx else "email_templates/list.html"
    return render(request, template_name, context)


# --- Editor ----------------------------------------------------------------------------------------


@role_required(SUPERADMIN)
@require_http_methods(["GET", "POST"])
@never_cache
def template_edit(request, pk=None):
    services.require_superadmin(request.user)
    template = get_object_or_404(EmailTemplate, pk=pk) if pk else None
    if request.method == "GET":
        if template:
            initial = {name: getattr(template, name) for name in CONTENT_FIELDS if name != "blocks"}
            initial["status"] = template.status if template.status != Status.ARCHIVED else Status.DRAFT
            blocks = template.blocks
        else:
            initial = {"category": Category.SALES, "kind": "transactional", "status": Status.DRAFT}
            blocks = [
                {"type": "heading", "text": "Hi {{first_name}},"},
                {"type": "text", "text": ""},
                {"type": "signature"},
            ]
        form = TemplateForm(initial=initial)
        return render(request, "email_templates/edit.html", _editor_context(request, template, form, blocks))

    blocks = blocks_from_post(request.POST)
    op = request.POST.get("op", "save")
    if op != "save":
        # Editing blocks is not a save: show the fields as typed, without validation errors.
        form = TemplateForm(initial=request.POST.dict())
        blocks = apply_op(blocks, op)
        context = _editor_context(request, template, form, blocks, unsaved=True)
        response = render(request, "email_templates/edit.html", context)
        response["HX-Trigger"] = "vsa-preview"
        return response

    form = TemplateForm(request.POST)
    if form.is_valid():
        content = _content_from_form(form, blocks)
        status = form.cleaned_data["status"]
        try:
            if template is None:
                template = services.create_template(
                    content=content, status=status, user=request.user, request=request
                )
                messages.success(request, f"Created “{template.name}”.")
            elif services.update_template(
                template, content=content, status=status, user=request.user, request=request
            ):
                messages.success(request, f"Saved “{template.name}” as version {template.version}.")
            else:
                messages.info(request, "No changes to save.")
            return redirect("email_templates:edit", pk=template.pk)
        except ValidationError as exc:
            for error in exc.messages:
                form.add_error(None, error)
    return render(
        request, "email_templates/edit.html", _editor_context(request, template, form, blocks, unsaved=True)
    )


@role_required(SUPERADMIN)
@require_POST
def template_preview(request, pk=None):
    """HTMX: re-renders the preview panel from the editor's current (unsaved) fields."""
    services.require_superadmin(request.user)
    template = get_object_or_404(EmailTemplate, pk=pk) if pk else None
    content = _raw_content(request.POST, blocks_from_post(request.POST))
    return render(request, "email_templates/_preview.html", _preview_context(request, template, content))


@role_required(SUPERADMIN)
@require_GET
@xframe_options_sameorigin
def preview_frame(request, slot):
    """The email itself, for the preview iframe, with its own restrictive policy."""
    services.require_superadmin(request.user)
    content = request.session.get(PREVIEW_SESSION_KEY, {}).get("drafts", {}).get(slot)
    template = None
    if slot.isdigit():
        template = get_object_or_404(EmailTemplate, pk=int(slot))
        content = content or template.content()
    if content is None:
        raise Http404
    theme = request.GET.get("theme", "light")
    values = sample_values(request.user, services.latest_enquiry())
    rendered = render_content(
        content, values, key=template.key if template else "new-template", recipient=request.user.email
    )
    response = HttpResponse(preview_html(rendered, theme if theme in THEMES else "light"))
    response["Content-Security-Policy"] = FRAME_CSP
    response._csp_exempt = True  # django-csp must not replace this document's policy.
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


# --- History, duplicate, archive, send test ---------------------------------------------------------


@role_required(SUPERADMIN)
@require_GET
@never_cache
def template_versions(request, pk):
    template = get_object_or_404(EmailTemplate, pk=pk)
    versions = template.versions.select_related("created_by")
    return render(request, "email_templates/versions.html", {"template": template, "versions": versions})


@role_required(SUPERADMIN)
@require_POST
def version_restore(request, pk, number):
    template = get_object_or_404(EmailTemplate, pk=pk)
    if not template.versions.filter(number=number).exists():
        raise Http404
    services.restore_version(template, number, user=request.user, request=request)
    messages.success(request, f"Restored version {number} as version {template.version}.")
    return redirect("email_templates:edit", pk=template.pk)


@role_required(SUPERADMIN)
@require_POST
def template_duplicate(request, pk):
    template = get_object_or_404(EmailTemplate, pk=pk)
    copy = services.duplicate_template(template, user=request.user, request=request)
    messages.success(request, f"Created “{copy.name}” as a draft.")
    return redirect("email_templates:edit", pk=copy.pk)


@role_required(SUPERADMIN)
@require_POST
def template_archive(request, pk):
    template = get_object_or_404(EmailTemplate, pk=pk)
    archived = request.POST.get("archived", "1") == "1"
    services.set_archived(template, archived, user=request.user, request=request)
    messages.success(request, f"{'Archived' if archived else 'Restored'} “{template.name}”.")
    return redirect("email_templates:edit", pk=template.pk)


@role_required(SUPERADMIN)
@require_POST
def template_send_test(request, pk):
    template = get_object_or_404(EmailTemplate, pk=pk)
    try:
        recipient = services.send_test(template, user=request.user, request=request)
    except ValidationError as exc:
        messages.error(request, " ".join(exc.messages))
    else:
        messages.success(request, f"Test email sent to {recipient} (saved version {template.version}).")
    return redirect("email_templates:edit", pk=template.pk)


# --- Public: unsubscribe ---------------------------------------------------------------------------


@csrf_exempt  # One-click unsubscribe (RFC 8058) posts without a session; the signed token is the check.
@require_http_methods(["GET", "POST"])
@never_cache
def unsubscribe(request, token):
    data = read_unsubscribe_token(token)
    if data is None:
        return render(request, "email_templates/unsubscribe.html", {"invalid": True}, status=400)
    if request.method == "POST":
        services.unsubscribe(data["e"], data.get("k", ""), request=request)
        return render(request, "email_templates/unsubscribe.html", {"done": True})
    return render(request, "email_templates/unsubscribe.html", {"token": token})
