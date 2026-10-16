"""Admin pages for website sync (brief 3.7): the sync log, retry, resync, and the open/closed switches."""

from django.conf import settings
from django.contrib import messages
from django.core.exceptions import PermissionDenied
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_GET, require_http_methods, require_POST

from apps.accounts.roles import has_any_role, is_superadmin, role_required
from apps.insights import access as insights_access

from . import services, signing
from . import status as sync_status
from .models import SiteSettings, SyncEvent, TickState

EVENT_LIMIT = 200


def _can_retry(user) -> bool:
    return insights_access.can_edit(user) or user.has_perm("careers.change_role") or is_superadmin(user)


@role_required()
@require_GET
def sync_log(request):
    if not has_any_role(request.user):
        raise PermissionDenied
    events = list(SyncEvent.objects.order_by("-created_at")[:EVENT_LIMIT])
    context = {
        "events": events,
        "overall": sync_status.overall(),
        "targets": settings.CONTENT_WEB_TARGETS,
        "revalidate_configured": bool(signing.keys_for("revalidate")),
        "tick": TickState.objects.filter(pk=1).first(),
        "can_retry": _can_retry(request.user),
        "can_resync": is_superadmin(request.user),
        "polling": any(event.delivered_at is None for event in events),
    }
    return render(request, "content_sync/sync.html", context)


@role_required()
@require_GET
def overall_status(request):
    return render(request, "content_sync/_overall.html", {"overall": sync_status.overall()})


@role_required()
@require_POST
def retry(request, pk):
    if not _can_retry(request.user):
        raise PermissionDenied
    event = get_object_or_404(SyncEvent, pk=pk)
    delivered = services.retry_event(event, request.user, request=request)
    if delivered:
        messages.success(request, "Delivered to the website.")
    else:
        messages.error(
            request, "The website did not acknowledge the event. It will be retried automatically."
        )
    return redirect(request.POST.get("next") if _safe_next(request.POST.get("next")) else "content_sync:sync")


def _safe_next(value) -> bool:
    return bool(value) and value.startswith("/") and not value.startswith("//")


@role_required()
@require_POST
def resync(request):
    if not is_superadmin(request.user):
        raise PermissionDenied
    services.resync_everything(request.user, request=request)
    messages.success(request, "Resync sent. Every Insights and Careers page on the website refreshes.")
    return redirect("content_sync:sync")


@role_required()
@require_http_methods(["GET", "POST"])
def site_settings(request):
    """Settings → Website content: open or close Insights and Careers (SuperAdmin, audited)."""
    if not is_superadmin(request.user):
        raise PermissionDenied
    from apps.insights.forms import SiteStateForm

    site = SiteSettings.load()
    form = SiteStateForm(
        request.POST if request.method == "POST" else None,
        initial={"insights_open": site.insights_open, "careers_open": site.careers_open},
    )
    if request.method == "POST" and form.is_valid():
        services.set_site_state(**form.cleaned_data, actor=request.user, request=request)
        messages.success(request, "Website sections saved.")
        return redirect("content_settings:site")
    return render(
        request,
        "settings/content.html",
        {
            "tab": "content",
            "form": form,
            "site": site,
            "targets": settings.CONTENT_WEB_TARGETS,
            "app_environment": settings.APP_ENVIRONMENT,
        },
    )
