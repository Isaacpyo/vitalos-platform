"""Product Pipeline pages (ADR-044): the product list, a product's detail and the audited Open redirect."""

from django.core.exceptions import PermissionDenied
from django.http import Http404, HttpResponseRedirect
from django.shortcuts import render
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.roles import role_required
from apps.audit.services import record

from . import access, registry, status


def _require_view(user) -> None:
    if not access.can_view(user):
        raise PermissionDenied


def _product_or_404(key: str) -> registry.Product:
    product = registry.get_product(key)
    if product is None:
        raise Http404("No such product.")
    return product


def _entry(user, product: registry.Product) -> dict:
    return {
        "product": product,
        "status": status.get_status(product),
        "can_open": access.can_open(user, product),
    }


def _allow_open(response, entries: list[dict]):
    """The Open form posts here and is redirected to the product's superadmin. CSP ``form-action``
    also governs where a submission may be redirected, so allow that origin on pages that show the
    button (and nowhere else)."""
    origins = sorted(
        {e["product"].superadmin_origin for e in entries if e["can_open"] and e["product"].superadmin_origin}
    )
    if origins:
        response._csp_update = {"form-action": origins}
    return response


@role_required()
@require_GET
@never_cache
def index(request):
    _require_view(request.user)
    entries = [_entry(request.user, product) for product in registry.all_products()]
    return _allow_open(render(request, "products/index.html", {"entries": entries}), entries)


@role_required()
@require_GET
@never_cache
def detail(request, key):
    _require_view(request.user)
    entry = _entry(request.user, _product_or_404(key))
    return _allow_open(render(request, "products/detail.html", {"entry": entry, **entry}), [entry])


@role_required()
@require_POST
def open_superadmin(request, key):
    """Check the product permission, audit, then send the browser to the product's superadmin.

    POST (with CSRF) so another site cannot make a signed-in admin's browser write audit events.
    Nothing is added to the URL: the product's superadmin runs its own sign-in.
    """
    _require_view(request.user)
    product = _product_or_404(key)
    if not access.can_open(request.user, product):
        raise PermissionDenied
    destination = product.superadmin_url
    if not destination:
        raise Http404("This product has no superadmin address.")
    record(
        "products.superadmin_opened",
        request=request,
        entity_type="product",
        entity_id=product.key,
        summary=f"Opened the {product.name} Superadmin",
        product=product.key,
        destination=destination,
    )
    return HttpResponseRedirect(destination)
