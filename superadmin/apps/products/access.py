"""Who may see the Product Pipeline and open a product's superadmin. Every view calls these; hiding a
link or button is only a convenience.

SuperAdmin holds everything (``apps.accounts.roles``). Anyone else needs a role and the Django
permission: ``products.view_product_pipeline`` to see the section (identity, environment and status),
and the product's own permission (``products.open_askbridge_superadmin`` for Askbridge) to see tenant
and subscription counts and alerts and to open the product's superadmin. Grant them with
``manage.py product_access`` (audited).
"""

from apps.accounts.roles import has_any_role, is_superadmin

from .registry import Product

VIEW_PERMISSION = "products.view_product_pipeline"


def _perm(user, name: str) -> bool:
    return bool(user and user.is_authenticated) and (is_superadmin(user) or user.has_perm(name))


def can_view(user) -> bool:
    return has_any_role(user) and _perm(user, VIEW_PERMISSION)


def can_open(user, product: Product) -> bool:
    """Product details (counts, alerts) and the Open button. Needs the section permission too."""
    return can_view(user) and _perm(user, product.open_permission)
