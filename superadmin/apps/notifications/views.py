from django.contrib.auth.decorators import login_required
from django.http import HttpResponseRedirect
from django.shortcuts import render
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.http import require_GET, require_POST

from apps.core.htmx import changed_response

from . import services
from .models import Notification


@login_required
@require_GET
def notification_list(request):
    notifications = Notification.objects.filter(recipient=request.user)[:100]
    return render(request, "notifications/list.html", {"notifications": notifications})


@login_required
@require_GET
def badge(request):
    """Polled by the bell every 60 seconds."""
    return render(request, "notifications/_bell.html", {"unread_count": services.unread_count(request.user)})


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
