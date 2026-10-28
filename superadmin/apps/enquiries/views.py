"""Enquiries inbox UI (three panes: filters, list, thread). Writes go through services.py.

HTMX targets: ``enquiry-list`` (filters/search refresh the middle pane) and ``enquiry-thread`` (opening
an enquiry or acting on it). Every full page also works without HTMX.
"""

import io
import json
from itertools import chain

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied, ValidationError
from django.http import FileResponse, Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, redirect, render
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_sameorigin
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import SUPERADMIN, is_superadmin, role_required
from apps.aidata import selectors as aidata_selectors

from . import attachments, notifications, selectors, services, sla
from .forms import (
    CannedResponseForm,
    InboxSettingsForm,
    NoteForm,
    NotificationPreferencesForm,
    PriorityForm,
    ReplyForm,
    StatusForm,
    TagsForm,
)
from .models import Attachment, CannedResponse, Enquiry, InboxSettings, Message, Tag

PAGE_SIZE = 50
CHANGED = "vsa-enquiries-changed"
DETAILS_COOKIE = "enquiry_details"


def _require_access(request):
    if not selectors.can_access(request.user):
        raise PermissionDenied


def _target(request) -> str:
    htmx = getattr(request, "htmx", None)
    if not htmx or htmx.history_restore_request:
        return ""
    return htmx.target or ""


def _list_state(request) -> dict:
    filter_key = request.GET.get("f", "all")
    if filter_key not in selectors.FILTERS:
        filter_key = "all"
    return {
        "filter_key": filter_key,
        "query": request.GET.get("q", "").strip()[: selectors.MAX_QUERY],
        "tag": request.GET.get("tag", "").strip()[:40],
    }


def _list_context(request, selected=None) -> dict:
    state = _list_state(request)
    rows = list(selectors.inbox(request.user, state["filter_key"], state["query"], state["tag"])[:PAGE_SIZE])
    now = timezone.now()
    counts = selectors.filter_counts(request.user)
    return {
        **state,
        "rows": [{"enquiry": row, "sla": sla.state(row, now)} for row in rows],
        "filters": [(key, label, counts.get(key, 0)) for key, (label, _) in selectors.FILTERS.items()],
        "tags": Tag.objects.filter(enquiries__isnull=False).distinct()[:30],
        "selected": selected,
        "querystring": request.GET.urlencode(),
    }


def _thread_context(request, enquiry, reply_form=None, note_form=None, mode="reply") -> dict:
    messages_qs = enquiry.messages.prefetch_related("attachments").select_related("sent_by")
    timeline = sorted(
        chain(
            ({"kind": "message", "item": message, "at": message.created_at} for message in messages_qs),
            (
                {"kind": "note", "item": note, "at": note.created_at}
                for note in enquiry.notes.select_related("author")
            ),
        ),
        key=lambda entry: entry["at"],
    )
    sla_state, sla_label = sla.state(enquiry)
    first_response = enquiry.first_response_at - enquiry.created_at if enquiry.first_response_at else None
    return {
        "enquiry": enquiry,
        "timeline": timeline,
        "sla_state": sla_state,
        "sla_label": sla_label,
        "first_response": first_response,
        "previous": selectors.previous_enquiries(enquiry),
        "assignees": selectors.assignable_users(),
        "statuses": Enquiry.Status.choices,
        "priorities": Enquiry.Priority.choices,
        "reply_form": reply_form or ReplyForm(),
        "note_form": note_form or NoteForm(),
        "mode": mode,
        "details_collapsed": request.COOKIES.get(DETAILS_COOKIE) == "collapsed",
        "canned": CannedResponse.objects.all(),
        "support_mailbox": settings.SUPPORT_MAILBOX,
        "email_transport": settings.EMAIL_TRANSPORT,
        "tag_text": ", ".join(enquiry.tags.values_list("name", flat=True)),
        "opportunity": aidata_selectors.for_enquiry(enquiry),
        "is_automated": enquiry.status in (Enquiry.Status.SPAM, Enquiry.Status.AUTOMATED)
        or not enquiry.messages.filter(direction=Message.Direction.INBOUND, is_auto=False).exists(),
    }


def _get(ref):
    enquiry = selectors.get_by_ref(ref)
    if enquiry is None:
        raise Http404
    return enquiry


def _thread_response(request, enquiry, message=None, **extra):
    response = render(request, "enquiries/_thread.html", _thread_context(request, enquiry, **extra))
    triggers = {CHANGED: True}
    if message:
        triggers["vsa-toast"] = {"message": message}
    response["HX-Trigger"] = json.dumps(triggers)
    return response


# --- Pages ---------------------------------------------------------------------------------------


@role_required()
@require_GET
def inbox(request):
    _require_access(request)
    context = _list_context(request)
    if _target(request) == "enquiry-list":
        return render(request, "enquiries/_list.html", context)
    return render(request, "enquiries/inbox.html", context)


@role_required()
@require_GET
def detail(request, ref):
    _require_access(request)
    enquiry = _get(ref)
    services.record_view(enquiry, request.user, request)
    enquiry.refresh_from_db()
    if _target(request) == "enquiry-thread":
        response = render(request, "enquiries/_thread.html", _thread_context(request, enquiry))
        response["HX-Trigger"] = json.dumps({CHANGED: True})
        return response
    context = {**_list_context(request, selected=enquiry), **_thread_context(request, enquiry)}
    return render(request, "enquiries/inbox.html", context)


@role_required()
@require_GET
def badge(request):
    if not selectors.can_access(request.user):
        return HttpResponse("")
    notifications.flush_if_due()  # Cheap: the 30-second poll keeps batched notifications moving.
    return render(request, "enquiries/_badge.html", {"count": selectors.unread_badge_count()})


# --- Actions -------------------------------------------------------------------------------------


def _post_action(request, ref, apply):
    _require_access(request)
    enquiry = _get(ref)
    try:
        message = apply(enquiry)
    except ValidationError as exc:
        response = _thread_response(request, enquiry)
        response["HX-Trigger"] = json.dumps({"vsa-toast": {"message": " ".join(exc.messages)}})
        return response
    enquiry.refresh_from_db()
    if not getattr(request, "htmx", False):
        return redirect(enquiry.get_absolute_url())
    return _thread_response(request, enquiry, message)


@role_required()
@require_POST
def set_status(request, ref):
    form = StatusForm(request.POST)

    def apply(enquiry):
        if not form.is_valid():
            raise ValidationError("Choose a valid status.")
        services.set_status(enquiry, form.cleaned_data["status"], request.user, request=request)
        return f"Marked as {enquiry.get_status_display().lower()}."

    return _post_action(request, ref, apply)


@role_required()
@require_POST
def set_priority(request, ref):
    form = PriorityForm(request.POST)

    def apply(enquiry):
        if not form.is_valid():
            raise ValidationError("Choose a valid priority.")
        services.set_priority(enquiry, form.cleaned_data["priority"], request.user, request=request)
        return "Priority updated."

    return _post_action(request, ref, apply)


@role_required()
@require_POST
def assign(request, ref):
    def apply(enquiry):
        value = request.POST.get("assignee", "")
        if value == "me":
            assignee = request.user
        elif value:
            assignee = selectors.assignable_users().filter(pk=value).first() if value.isdigit() else None
            if assignee is None:
                raise ValidationError("That person cannot be assigned enquiries.")
        else:
            assignee = None
        services.assign(enquiry, assignee, request.user, request=request)
        return f"Assigned to {assignee.email}." if assignee else "Unassigned."

    return _post_action(request, ref, apply)


@role_required()
@require_POST
def set_tags(request, ref):
    form = TagsForm(request.POST)

    def apply(enquiry):
        if not form.is_valid():
            raise ValidationError("Tags could not be saved.")
        services.set_tags(enquiry, form.cleaned_data["tags"], request.user, request=request)
        return "Tags saved."

    return _post_action(request, ref, apply)


@role_required()
@require_POST
def mark_unread(request, ref):
    def apply(enquiry):
        services.mark_unread(enquiry, request.user, request=request)
        return "Marked as unread."

    return _post_action(request, ref, apply)


@role_required()
@require_POST
def reply(request, ref):
    _require_access(request)
    enquiry = _get(ref)
    form = ReplyForm(request.POST, request.FILES)
    if form.is_valid():
        try:
            services.send_reply(
                enquiry,
                body_text=form.cleaned_data["body_text"],
                actor=request.user,
                files=form.cleaned_data["files"],
                resolve=bool(request.POST.get("resolve")),
                request=request,
            )
        except ValidationError as exc:
            form.add_error(None, exc)
        except services.SendError:
            form.add_error(None, "The reply could not be sent. It is saved as failed; try again shortly.")
        else:
            enquiry.refresh_from_db()
            sent = (
                "Reply recorded (log transport, not sent)."
                if settings.EMAIL_TRANSPORT == "log"
                else "Reply sent."
            )
            if not getattr(request, "htmx", False):
                messages.success(request, sent)
                return redirect(enquiry.get_absolute_url())
            return _thread_response(request, enquiry, sent)
    return _thread_response(request, enquiry, reply_form=form, mode="reply")


@role_required()
@require_POST
def add_note(request, ref):
    _require_access(request)
    enquiry = _get(ref)
    form = NoteForm(request.POST)
    if form.is_valid():
        services.add_note(enquiry, form.cleaned_data["body"], request.user, request=request)
        if not getattr(request, "htmx", False):
            return redirect(enquiry.get_absolute_url())
        return _thread_response(request, enquiry, "Note added.", mode="note")
    return _thread_response(request, enquiry, note_form=form, mode="note")


@role_required()
@require_GET
def export(request, ref):
    _require_access(request)
    enquiry = _get(ref)
    payload = services.export_enquiry(enquiry, request.user, request)
    response = HttpResponse(
        json.dumps(payload, indent=2, default=str), content_type="application/json; charset=utf-8"
    )
    response["Content-Disposition"] = f'attachment; filename="{enquiry.ref}.json"'
    response["Cache-Control"] = "no-store"
    return response


# --- Message bodies and attachments --------------------------------------------------------------

# The sanitised HTML is shown in a sandboxed iframe (no scripts, no same-origin) with its own CSP.
# Remote images stay blocked unless the reader asks for them with ?images=1.
BODY_CSP = {
    "default-src": ["'none'"],
    "img-src": ["data:"],
    "style-src": ["'unsafe-inline'"],
    "font-src": ["data:"],
    "base-uri": ["'none'"],
    "form-action": ["'none'"],
    "frame-ancestors": ["'self'"],
    "sandbox": [],
}


@role_required()
@require_GET
@xframe_options_sameorigin
def message_body(request, pk):
    _require_access(request)
    message = get_object_or_404(Message, pk=pk)
    images = request.GET.get("images") == "1"
    html = render(
        request, "enquiries/message_body.html", {"body": message.html_body_sanitised}
    ).content.decode()
    response = HttpResponse(html)
    policy = dict(BODY_CSP)
    if images:
        policy["img-src"] = ["data:", "https:"]
    response["Content-Security-Policy"] = "; ".join(
        f"{name} {' '.join(values)}".strip() for name, values in policy.items()
    )
    response._csp_exempt = True  # django-csp must not replace this document's policy.
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@role_required()
@require_GET
def attachment_download(request, pk):
    _require_access(request)
    attachment = get_object_or_404(Attachment.objects.select_related("message__enquiry"), pk=pk)
    if not attachment.storage_key:
        raise Http404
    url = attachments.signed_url(attachment.storage_key)
    if url:
        return HttpResponseRedirect(url)
    response = FileResponse(
        io.BytesIO(attachments.open_bytes(attachment.storage_key)),
        as_attachment=True,
        filename=attachment.filename,
        content_type="application/octet-stream",
    )
    response["Content-Security-Policy"] = "sandbox; default-src 'none'"
    response["Cache-Control"] = "private, no-store"
    return response


# --- Settings: email and notifications -----------------------------------------------------------


@role_required(SUPERADMIN)
@require_http_methods(["GET", "POST"])
def settings_email(request):
    inbox_settings = InboxSettings.load()
    action = request.POST.get("action") if request.method == "POST" else None
    form = InboxSettingsForm(request.POST if action == "settings" else None, instance=inbox_settings)
    canned_form = CannedResponseForm(request.POST if action == "canned" else None)
    if action == "settings" and form.is_valid():
        services.update_inbox_settings(**form.cleaned_data, actor=request.user, request=request)
        messages.success(request, "Email settings saved.")
        return redirect("enquiries_settings:email")
    if action == "canned" and canned_form.is_valid():
        services.save_canned_response(**canned_form.cleaned_data, actor=request.user)
        messages.success(request, "Canned response saved.")
        return redirect("enquiries_settings:email")
    if action == "delete_canned" and request.POST.get("pk", "").isdigit():
        services.delete_canned_response(int(request.POST["pk"]), request.user)
        messages.success(request, "Canned response deleted.")
        return redirect("enquiries_settings:email")
    context = {
        "tab": "email",
        "form": form,
        "canned_form": canned_form,
        "canned": CannedResponse.objects.all(),
        "inbox": inbox_settings,
        "inbound_provider": settings.INBOUND_PROVIDER,
        "email_transport": settings.EMAIL_TRANSPORT,
        "support_mailbox": settings.SUPPORT_MAILBOX,
        "notify_from": settings.NOTIFY_FROM,
        "webhook_configured": bool(settings.INBOUND_WEBHOOK_SECRET),
        "storage_enabled": attachments.storage_enabled(),
        "inbound_url": settings.APP_BASE_URL + "/api/inbound/email",
    }
    return render(request, "settings/email.html", context)


@role_required()
@require_http_methods(["GET", "POST"])
def settings_notifications(request):
    _require_access(request)
    current = notifications.get_preferences(request.user)
    form = NotificationPreferencesForm(request.POST or None, initial_modes=current)
    if request.method == "POST" and form.is_valid():
        notifications.set_preferences(request.user, form.cleaned_data, request=request)
        messages.success(request, "Notification preferences saved.")
        return redirect("enquiries_settings:notifications")
    return render(
        request,
        "settings/notifications.html",
        {
            "tab": "notifications",
            "form": form,
            "slack": bool(settings.SLACK_WEBHOOK_URL),
            "is_superadmin": is_superadmin(request.user),
        },
    )
