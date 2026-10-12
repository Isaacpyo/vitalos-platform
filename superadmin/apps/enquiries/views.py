"""Enquiries inbox UI (three-pane). Writes go through services.py; reads through selectors.py."""

from django.core.exceptions import PermissionDenied
from django.http import Http404
from django.shortcuts import render
from django.views.decorators.http import require_GET

from apps.accounts.roles import role_required

from . import selectors


def _require_access(request):
    if not selectors.can_access(request.user):
        raise PermissionDenied


@role_required()
@require_GET
def inbox(request):
    _require_access(request)
    return render(request, "enquiries/inbox.html", {"enquiries": selectors.inbox(request.user)[:50]})


@role_required()
@require_GET
def detail(request, ref):
    _require_access(request)
    enquiry = selectors.get_by_ref(ref)
    if enquiry is None:
        raise Http404
    return render(
        request, "enquiries/inbox.html", {"enquiries": selectors.inbox(request.user)[:50], "enquiry": enquiry}
    )


@role_required()
@require_GET
def badge(request):
    count = selectors.unread_badge_count() if selectors.can_access(request.user) else 0
    return render(request, "enquiries/_badge.html", {"count": count})
