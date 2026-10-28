"""Error pages. Portal surfaces get the calm customer pages; everything else is delegated to the admin's."""

from django.http import HttpResponseServerError
from django.shortcuts import render
from django.template import loader

from apps.core import views as core_views


def _portal(request) -> bool:
    return bool(getattr(request, "portal_surface", False))


def permission_denied(request, exception=None):
    if _portal(request):
        return render(request, "portal/errors/403.html", status=403)
    return core_views.permission_denied(request, exception)


def page_not_found(request, exception=None):
    if _portal(request):
        return render(request, "portal/errors/404.html", status=404)
    return core_views.page_not_found(request, exception)


def server_error(request):
    if _portal(request):
        return HttpResponseServerError(loader.get_template("portal/errors/500.html").render({}))
    return core_views.server_error(request)
