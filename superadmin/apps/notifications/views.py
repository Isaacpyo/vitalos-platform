from django.contrib.auth.decorators import login_required
from django.core.exceptions import PermissionDenied
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_POST

from apps.core.htmx import changed_response

from . import services
from .models import Notification


def _attention_items(user):
    """Enquiries needing attention, for users who may see enquiries; otherwise None (no tab)."""
    from apps.core.overview import needs_attention
    from apps.enquiries.selectors import can_access

    return needs_attention() if can_access(user) else None


@login_required
@require_GET
def notification_list(request):
    notifications = Notification.objects.filter(recipient=request.user)[:100]
    attention = _attention_items(request.user)
    context = {
        "notifications": notifications,
        "tab": "all",
        "attention_count": len(attention) if attention is not None else None,
    }
    return render(request, "notifications/list.html", context)


@login_required
@require_GET
def attention(request):
    items = _attention_items(request.user)
    if items is None:
        raise PermissionDenied
    context = {"attention": items, "tab": "attention", "attention_count": len(items)}
    return render(request, "notifications/attention.html", context)


@login_required
@require_GET
def badge(request):
    """Polled by the bell every 60 seconds; ``?nav=1`` returns the sidebar's count pill instead."""
    template = "notifications/_nav_badge.html" if request.GET.get("nav") else "notifications/_bell.html"
    return render(request, template, {"unread_count": services.unread_count(request.user)})


@login_required
@require_POST
def open_notification(request, pk):
    notification = services.mark_read(request.user, pk)
    target = notification.url if notification else ""
    if not target or not url_has_allowed_host_and_scheme(target, allowed_hosts={request.get_host()}):
        target = "/notifications/"
    return HttpResponseRedirect(target)


@login_required
@require_POST
def read_all(request):
    count = services.mark_all_read(request.user)
    return changed_response(request, "/notifications/", f"{count} notification(s) marked as read.")
