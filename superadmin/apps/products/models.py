"""Product Pipeline permissions (ADR-044).

The product list itself is configuration (``registry.py``), so there is no table. Django permissions
need a model to hang from, so ``ProductAccess`` is unmanaged: it declares the permissions and nothing
else. Its migration only records the model state; no table is created.
"""

from django.db import models


class ProductAccess(models.Model):
    class Meta:
        managed = False
        default_permissions = ()
        permissions = [
            ("view_product_pipeline", "Can view the Product Pipeline"),
            ("open_askbridge_superadmin", "Can see Askbridge details and open the Askbridge Superadmin"),
        ]

    def __str__(self):
        return "Product Pipeline access"
