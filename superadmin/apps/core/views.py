from django.http import HttpResponseServerError
from django.shortcuts import render
from django.template import loader
from django.views.decorators.http import require_GET

from apps.accounts.roles import role_required

from . import health, palette


def permission_denied(request, exception=None):
    return render(request, "errors/403.html", status=403)


def page_not_found(request, exception=None):
    return render(request, "errors/404.html", status=404)


def server_error(request):
    # Rendered without the request so a database outage cannot break the error page itself.
    return HttpResponseServerError(loader.get_template("errors/500.html").render({}))


@role_required()
@require_GET
def palette_results(request):
    query = request.GET.get("q", "")
    return render(
        request,
        "partials/palette_results.html",
        {"groups": palette.results(request.user, query), "query": query},
    )


@role_required()
@require_GET
def help_page(request):
    from .guides import GUIDES

    return render(request, "core/help.html", {"guides": GUIDES})


@role_required()
@require_GET
def health_page(request):
    results = health.checks()
    return render(request, "core/health.html", {"checks": results, "overall": health.overall(results)})


@role_required()
@require_GET
def health_footer(request):
    """Loaded after each page renders, so health checks never slow a page down."""
    return render(request, "partials/health_footer.html", {"overall": health.overall(health.checks())})
