"""Careers admin (brief 7.4 to 7.6): roles, applications and settings. Thin views: rules live in
services.py, applications.py, alerts.py and intake.py; permissions in access.py."""

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied, ValidationError
from django.core.paginator import Paginator
from django.http import FileResponse, Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import role_required
from apps.content_sync import formatting, sections, signing
from apps.content_sync import render as renderer
from apps.content_sync import services as content_services
from apps.content_sync import status as sync_status
from apps.content_sync.models import SiteSettings

from . import access, alerts, applications, public, selectors, services
from . import config as careers_config
from .forms import (
    CandidateEmailsForm,
    CareersSettingsForm,
    HomeCareersForm,
    NewRoleForm,
    NoteForm,
    RoleForm,
    StageForm,
)
from .models import Application, ApplicationStage, Role, RoleStatus

PAGE_SIZE = 50
SECTIONS = (
    ("roles", "Roles", "careers:roles"),
    ("applications", "Applications", "careers:applications"),
    ("settings", "Settings", "careers:settings"),
)
MUTED = "text-slate-500 dark:text-slate-400"
STATUS_TONES = {RoleStatus.OPEN: "text-mineral-700 dark:text-mineral-300"}
PUBLISH_ACTIONS = {"open", "publish", "pause", "close", "reopen", "archive"}
EDIT_ACTIONS = {"duplicate"}
FRAME_CSP = (
    "default-src 'none'; img-src {img}; style-src 'unsafe-inline'; font-src {font}; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
)
EMAIL_FRAME_CSP = (
    "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; "
    "base-uri 'none'; form-action 'none'; frame-ancestors 'self'; sandbox"
)


def _require(allowed: bool) -> None:
    if not allowed:
        raise PermissionDenied


def _web_base() -> str:
    return settings.CONTENT_WEB_TARGETS[0] if settings.CONTENT_WEB_TARGETS else ""


def _common(request, section: str) -> dict:
    return {
        "careers_sections": [(key, label, reverse(name)) for key, label, name in SECTIONS],
        "section": section,
        "overall": sync_status.overall(),
        "careers_open": SiteSettings.load().careers_open,
        "can_edit": access.can_edit_roles(request.user),
        "can_publish": access.can_publish_roles(request.user),
        "can_view_applications": access.can_view_applications(request.user),
    }


def _status_label(role: Role) -> str:
    label = role.get_status_display().upper()
    if role.status == RoleStatus.OPEN and role.published_closes_at:
        label += f" · CLOSES {formatting.date_short(role.published_closes_at).upper()[:-5]}"
    return label


# --- Roles ---------------------------------------------------------------------------------------


@role_required()
@require_GET
def root(request):
    return redirect("careers:roles")


@role_required()
@require_GET
def role_list(request):
    _require(access.can_view_roles(request.user))
    tab = request.GET.get("tab", "open")
    tab = tab if tab in selectors.ROLE_TABS else "open"
    rows = list(selectors.roles(tab))
    statuses = sync_status.statuses_for("role", [(role.pk, services.is_live(role)) for role in rows])
    counts = selectors.role_counts()
    context = {
        **_common(request, "roles"),
        "tab": tab,
        "tabs": [(key, label, counts[key]) for key, (label, _) in selectors.ROLE_TABS.items()],
        "rows": [
            {
                "role": role,
                "status": _status_label(role),
                "tone": STATUS_TONES.get(role.status, MUTED),
                "sync": statuses[str(role.pk)],
                "live_url": f"{_web_base()}/careers/{role.published_slug}"
                if _web_base() and services.is_live(role)
                else "",
            }
            for role in rows
        ],
    }
    return render(request, "careers/role_list.html", context)


@role_required()
@require_http_methods(["GET", "POST"])
def role_new(request):
    _require(access.can_edit_roles(request.user))
    form = NewRoleForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        role = services.create_role(title=form.cleaned_data["title"], actor=request.user, request=request)
        return redirect("careers:role", pk=role.pk)
    return render(request, "careers/role_new.html", {**_common(request, "roles"), "form": form})


def _role_context(request, role: Role, form: RoleForm | None = None) -> dict:
    live = services.is_live(role)
    return {
        **_common(request, "roles"),
        "role": role,
        "form": form or RoleForm(role=role),
        "status_label": _status_label(role),
        "status_tone": STATUS_TONES.get(role.status, MUTED),
        "sync": sync_status.item_status("role", role.pk, live=live),
        "problems": services.open_problems(role),
        "live_url": f"{_web_base()}/careers/{role.published_slug}" if live and _web_base() else "",
        "preview_ready": bool(_web_base() and signing.keys_for("preview")),
        "revisions": role.revisions.select_related("published_by")[:10],
        "applications_count": role.applications.count(),
    }


@role_required()
@require_http_methods(["GET", "POST"])
def role_edit(request, pk):
    _require(access.can_view_roles(request.user))
    role = get_object_or_404(Role, pk=pk)
    if request.method == "POST":
        _require(access.can_edit_roles(request.user))
        form = RoleForm(request.POST, role=role)
        if form.is_valid():
            try:
                services.save_working_copy(
                    role,
                    form.working_data(),
                    actor=request.user,
                    expected_updated_at=form.expected_updated_at(),
                    request=request,
                )
            except services.Conflict:
                messages.error(
                    request, "This role changed since you opened it. Reload it to see the latest version."
                )
            except ValidationError as exc:
                for field, errors in exc.message_dict.items():
                    form.add_error(field if field in form.fields else None, errors)
            else:
                messages.success(
                    request, "Saved. The website changes when you open the role or publish changes."
                )
                return redirect("careers:role", pk=role.pk)
        return render(request, "careers/role_edit.html", _role_context(request, role, form), status=400)
    return render(request, "careers/role_edit.html", _role_context(request, role))


@role_required()
@require_POST
def role_action(request, pk, action):
    role = get_object_or_404(Role, pk=pk)
    if action in PUBLISH_ACTIONS:
        _require(access.can_publish_roles(request.user))
    elif action in EDIT_ACTIONS:
        _require(access.can_edit_roles(request.user))
    else:
        raise Http404
    user = request.user
    try:
        if action in ("open", "reopen"):
            services.open_role(role, user, request=request)
            message = "The role is open." if action == "open" else "The role is open again."
        elif action == "publish":
            services.publish_changes(role, user, request=request)
            message = "Changes published."
        elif action == "pause":
            services.pause_role(role, user, request=request)
            message = "Paused. The role is hidden and takes no applications."
        elif action == "close":
            if not services.close_role(role, user, request=request):
                raise ValidationError("Only an open role can be closed.")
            message = "Closed. The role page shows that it has closed."
        elif action == "archive":
            services.archive_role(role, user, request=request)
            message = "Archived."
        else:
            clone = services.duplicate_role(role, user, request=request)
            messages.success(request, "Duplicated. You are editing the copy.")
            return redirect("careers:role", pk=clone.pk)
    except ValidationError as exc:
        for text in exc.messages:
            messages.error(request, text)
        return redirect("careers:role", pk=role.pk)
    messages.success(request, message)
    return redirect("careers:role", pk=role.pk)


@role_required()
@require_GET
def role_sync(request, pk):
    _require(access.can_view_roles(request.user))
    role = get_object_or_404(Role, pk=pk)
    return render(
        request,
        "content_sync/_item_status.html",
        {
            "sync": sync_status.item_status("role", role.pk, live=services.is_live(role)),
            "poll_url": request.path,
            "next_url": reverse("careers:role", args=[role.pk]),
            "can_edit": access.can_edit_roles(request.user),
        },
    )


def _rendered_sections(role: Role) -> list[dict]:
    sections_out = []
    for field, label in services.MARKDOWN_SECTIONS:
        text = getattr(role, field)
        if text.strip():
            sections_out.append({"label": label, "result": renderer.render(text, "role")})
    return sections_out


@role_required()
@require_GET
def role_preview_panel(request, pk):
    _require(access.can_view_roles(request.user))
    role = get_object_or_404(Role, pk=pk)
    rendered = _rendered_sections(role)
    return render(
        request,
        "careers/_preview_panel.html",
        {
            "role": role,
            "sections": rendered,
            "available": all(item["result"].available for item in rendered),
            "frame_url": reverse("careers:role_preview_frame", args=[role.pk])
            + f"?v={services.revision_hash(role)[:16]}",
        },
    )


@role_required()
@require_GET
@xframe_options_sameorigin
def role_preview_frame(request, pk):
    _require(access.can_view_roles(request.user))
    role = get_object_or_404(Role, pk=pk)
    html = render(
        request, "careers/preview_frame.html", {"role": role, "sections": _rendered_sections(role)}
    ).content.decode()
    own = f"{request.scheme}://{request.get_host()}"
    images = " ".join(["data:", own, settings.CONTENT_MEDIA_PUBLIC_BASE_URL]).strip()
    response = HttpResponse(html)
    response["Content-Security-Policy"] = FRAME_CSP.format(img=images, font=own)
    response._csp_exempt = True  # django-csp must not replace this document's policy.
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@role_required()
@require_GET
def role_site_preview(request, pk):
    _require(access.can_view_roles(request.user))
    role = get_object_or_404(Role, pk=pk)
    base = _web_base()
    if not base:
        messages.error(
            request,
            "No website target is configured (CONTENT_WEB_TARGETS), so there is nothing to preview on.",
        )
        return redirect("careers:role", pk=role.pk)
    if not public.shapeable(role):
        messages.error(request, "Choose a practice, a work model and an employment type before previewing.")
        return redirect("careers:role", pk=role.pk)
    try:
        token = signing.preview_token("role", role.pk, services.revision_hash(role))
    except signing.NotConfigured:
        messages.error(request, "Preview is not configured (CONTENT_PREVIEW_SECRET is not set).")
        return redirect("careers:role", pk=role.pk)
    return HttpResponseRedirect(f"{base}/api/content/preview?token={token}")


# --- Applications --------------------------------------------------------------------------------


def _filters(request) -> dict:
    tab = request.GET.get("tab", "new")
    return {
        "tab": tab if tab in selectors.APPLICATION_TABS else "new",
        "role_id": request.GET.get("role", "")[:40],
        "query": request.GET.get("q", "").strip()[: selectors.MAX_QUERY],
    }


def _received(moment) -> str:
    days = (timezone.now() - moment).days
    if days <= 0:
        return "TODAY"
    return "1 DAY AGO" if days == 1 else f"{days} DAYS AGO"


@role_required()
@require_GET
def application_list(request):
    _require(access.can_view_applications(request.user))
    filters = _filters(request)
    rows = selectors.applications(**filters)
    page = Paginator(rows, PAGE_SIZE).get_page(request.GET.get("page"))
    counts = selectors.application_counts()
    params = request.GET.copy()
    params.pop("page", None)
    tabs = []
    for key, (label, _) in selectors.APPLICATION_TABS.items():
        query = params.copy()
        query["tab"] = key
        tabs.append({"key": key, "label": label, "count": counts.get(key, 0), "query": query.urlencode()})
    return render(
        request,
        "careers/application_list.html",
        {
            **_common(request, "applications"),
            **filters,
            "tabs": tabs,
            "page": page,
            "rows": [{"application": item, "received": _received(item.created_at)} for item in page],
            "roles": Role.objects.exclude(status=RoleStatus.DRAFT).order_by("title"),
            "querystring": params.urlencode(),
        },
    )


def _application(pk) -> Application:
    return get_object_or_404(
        Application.objects.select_related("role", "assigned_admin", "duplicate_of"), pk=pk
    )


def _neighbours(request, application: Application) -> tuple:
    filters = _filters(request)
    ids = list(selectors.applications(**filters).values_list("pk", flat=True)[:1000])
    if application.pk not in ids:
        return None, None
    index = ids.index(application.pk)
    previous = ids[index - 1] if index > 0 else None
    following = ids[index + 1] if index + 1 < len(ids) else None
    return previous, following


@role_required()
@require_GET
def application_detail(request, pk):
    _require(access.can_view_applications(request.user))
    application = _application(pk)
    applications.mark_seen(application)
    previous, following = _neighbours(request, application)
    query = request.GET.urlencode()
    timeline = list(application.events.select_related("actor_admin").order_by("-at"))
    users = [
        user
        for user in get_user_model().objects.filter(is_active=True).order_by("email")
        if access.can_view_applications(user)
    ]
    return render(
        request,
        "careers/application_detail.html",
        {
            **_common(request, "applications"),
            "application": application,
            "stages": ApplicationStage.choices,
            "notes": application.notes.select_related("admin"),
            "timeline": timeline,
            "note_form": NoteForm(),
            "reviewers": users,
            "previous_url": f"{reverse('careers:application', args=[previous])}?{query}" if previous else "",
            "next_url": f"{reverse('careers:application', args=[following])}?{query}" if following else "",
            "back_url": f"{reverse('careers:applications')}?{query}",
            "query": query,
            "can_view_cv": access.can_view_cv(request.user),
            "can_delete": access.can_delete_applications(request.user),
            "emails_on": settings.CAREERS_CANDIDATE_EMAILS_ENABLED,
            "received": _received(application.created_at),
        },
    )


def _back(request, application) -> HttpResponseRedirect:
    query = request.POST.get("q", "")
    url = reverse("careers:application", args=[application.pk])
    return redirect(f"{url}?{query}" if query and "\n" not in query else url)


@role_required()
@require_POST
def application_action(request, pk, action):
    _require(access.can_view_applications(request.user))
    application = _application(pk)
    user = request.user
    try:
        if action == "stage":
            form = StageForm(request.POST)
            if not form.is_valid():
                raise ValidationError("Choose a stage.")
            applications.set_stage(application, form.cleaned_data["stage"], actor=user, request=request)
            messages.success(request, "Stage updated.")
        elif action == "assign":
            value = request.POST.get("assignee", "")
            assignee = (
                get_user_model().objects.filter(pk=value, is_active=True).first() if value.isdigit() else None
            )
            if value and assignee is None:
                raise ValidationError("Choose a reviewer.")
            applications.assign(application, assignee, actor=user, request=request)
            messages.success(request, "Reviewer updated.")
        elif action == "note":
            form = NoteForm(request.POST)
            if not form.is_valid():
                raise ValidationError("Write a note of up to 5,000 characters.")
            applications.add_note(application, form.cleaned_data["body"], actor=user, request=request)
            messages.success(request, "Note added.")
        elif action in ("email-rejection", "email-invitation", "email-receipt"):
            alerts.send_candidate_email(application, action.split("-", 1)[1], actor=user, request=request)
            messages.success(request, "Email sent.")
        elif action == "delete":
            _require(access.can_delete_applications(user))
            applications.delete(application, actor=user, request=request)
            messages.success(request, "Application and CV deleted.")
            return redirect("careers:applications")
        else:
            raise Http404
    except alerts.EmailsOff:
        messages.error(request, "Candidate emails are off. Reply from your own mailbox.")
    except (ValidationError, RuntimeError) as exc:
        for text in getattr(exc, "messages", [str(exc)]):
            messages.error(request, text)
    return _back(request, application)


@role_required()
@require_GET
def application_cv(request, pk):
    _require(access.can_view_cv(request.user))
    application = _application(pk)
    try:
        kind, value = applications.cv_access(application, actor=request.user, request=request)
    except ValidationError:
        raise Http404 from None
    if kind == "url":
        return HttpResponseRedirect(value)
    response = FileResponse(
        value,
        as_attachment=True,
        filename=application.cv_filename or "cv",
        content_type="application/octet-stream",
    )
    response["Content-Security-Policy"] = "sandbox; default-src 'none'"
    response["Cache-Control"] = "private, no-store"
    return response


@role_required()
@require_GET
def badge(request):
    if not access.can_view_applications(request.user):
        return HttpResponse("")
    return render(request, "careers/_badge.html", {"count": selectors.badge_count()})


# --- Settings ------------------------------------------------------------------------------------


def _home_preview(config: dict) -> dict:
    now = timezone.now()
    careers = careers_config.load()
    roles = [role.published_snapshot for role in public.open_roles(now)]
    roles = [r for r in roles if r.get("showOnHome")] + [r for r in roles if not r.get("showOnHome")]
    return {
        "config": config,
        "roles": roles[: config.get("count") or 3],
        "empty_state": careers["empty_state"],
    }


def _preview_config(data) -> dict:
    try:
        count = int(data.get("count") or 3)
    except (TypeError, ValueError):
        count = 3
    return {
        "enabled": data.get("enabled") in (True, "on", "true", "1"),
        "heading": str(data.get("heading") or ""),
        "intro": str(data.get("intro") or ""),
        "count": min(max(count, 1), 5),
        "when_no_roles": data.get("when_no_roles")
        if data.get("when_no_roles") in ("hide", "show_message")
        else "hide",
    }


@role_required()
@require_http_methods(["GET", "POST"])
def settings_page(request):
    _require(access.can_view_roles(request.user))
    config = careers_config.load()
    section = sections.load(sections.HOME_CAREERS)
    action = request.POST.get("action") if request.method == "POST" else None
    if action:
        _require(access.can_edit_settings(request.user))
    settings_form = CareersSettingsForm(
        request.POST if action == "settings" else None, initial=CareersSettingsForm.initial_from(config)
    )
    emails_form = CandidateEmailsForm(
        request.POST if action == "emails" else None, initial=config, auto_id="email_%s"
    )
    section_form = HomeCareersForm(
        request.POST if action == "section" else None, initial=section, auto_id="section_%s"
    )
    try:
        if action == "settings" and settings_form.is_valid():
            data = dict(settings_form.cleaned_data)
            data["values"] = data["values"].splitlines()
            data["statements"] = data["statements"].splitlines()
            services.update_settings(data, actor=request.user, request=request)
            messages.success(request, "Careers settings saved.")
            return redirect("careers:settings")
        if action == "emails" and emails_form.is_valid():
            services.update_settings(emails_form.cleaned_data, actor=request.user, request=request)
            messages.success(request, "Candidate email templates saved.")
            return redirect("careers:settings")
        if action == "section" and section_form.is_valid():
            content_services.update_section(
                sections.HOME_CAREERS, section_form.cleaned_data, actor=request.user, request=request
            )
            messages.success(request, "Homepage section saved.")
            return redirect("careers:settings")
    except ValidationError as exc:
        form = {"settings": settings_form, "emails": emails_form, "section": section_form}[action]
        for field, errors in exc.message_dict.items():
            form.add_error(field if field in form.fields else None, errors)
    return render(
        request,
        "careers/settings.html",
        {
            **_common(request, "settings"),
            "settings_form": settings_form,
            "emails_form": emails_form,
            "section_form": section_form,
            "preview": _home_preview(_preview_config(section)),
            "can_edit_settings": access.can_edit_settings(request.user),
            "emails_on": settings.CAREERS_CANDIDATE_EMAILS_ENABLED,
            "email_kinds": careers_config.EMAIL_KINDS,
        },
        status=400 if action else 200,
    )


@role_required()
@require_POST
def settings_preview(request):
    _require(access.can_view_roles(request.user))
    return render(
        request, "careers/_home_preview.html", {"preview": _home_preview(_preview_config(request.POST))}
    )


@role_required()
@require_GET
@xframe_options_sameorigin
def email_preview(request, kind):
    """A candidate email on the shared layout, with fictional sample values, in a sandboxed frame."""
    _require(access.can_view_roles(request.user))
    if kind not in careers_config.EMAIL_KINDS:
        raise Http404
    response = HttpResponse(alerts.preview_html(kind))
    response["Content-Security-Policy"] = EMAIL_FRAME_CSP
    response._csp_exempt = True
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response
