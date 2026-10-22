"""The products shown in the Product Pipeline (ADR-044). Configuration, not data: no table, no migration.

Adding a product:

1. Add a ``Product`` below.
2. Add its settings (status URL, status token, superadmin URL) to ``config/settings/base.py``,
   ``config/settings/prod.py`` (https check) and ``.env.example``.
3. Add its open permission to ``models.ProductAccess.Meta.permissions`` and run
   ``python manage.py makemigrations products``.

The status endpoint must follow the contract in ADR-044 (``status.py`` validates it).
"""

from dataclasses import dataclass
from urllib.parse import urlsplit

from django.conf import settings


@dataclass(frozen=True)
class Product:
    key: str
    name: str
    endorsement: str
    summary: str
    # Static paths (``static/products/...``).
    mark: str
    app_icon: str
    # Names of the settings that hold the server-side status endpoint, its Bearer token and the
    # product's own superadmin. Read on every access so tests and deploys can change them.
    status_url_setting: str
    status_token_setting: str
    superadmin_url_setting: str
    # Full Django permission name ("app_label.codename") that gates details and the Open button.
    open_permission: str

    @property
    def status_url(self) -> str:
        return (getattr(settings, self.status_url_setting, "") or "").strip()

    @property
    def status_token(self) -> str:
        return getattr(settings, self.status_token_setting, "") or ""

    @property
    def superadmin_url(self) -> str:
        return (getattr(settings, self.superadmin_url_setting, "") or "").strip()

    @property
    def superadmin_origin(self) -> str:
        """``scheme://host[:port]`` of the superadmin, for the page's CSP ``form-action``."""
        parts = urlsplit(self.superadmin_url)
        return (
            f"{parts.scheme}://{parts.netloc}" if parts.scheme in ("https", "http") and parts.netloc else ""
        )

    @property
    def status_configured(self) -> bool:
        return bool(self.status_token and self.status_url)

    @property
    def trusted_hosts(self) -> frozenset[str]:
        """Hosts the product's alert links may point to: its status endpoint and its superadmin."""
        hosts = {urlsplit(url).hostname for url in (self.status_url, self.superadmin_url)}
        return frozenset(host for host in hosts if host)


PRODUCTS: tuple[Product, ...] = (
    Product(
        key="askbridge",
        name="Askbridge",
        endorsement="by Vitalos",
        summary="AI customer assistant and live chat that businesses add to their website.",
        mark="products/askbridge-mark.svg",
        app_icon="products/askbridge-app-icon.svg",
        status_url_setting="ASKBRIDGE_STATUS_URL",
        # The name of the setting, not a secret.
        status_token_setting="ASKBRIDGE_STATUS_TOKEN",  # noqa: S106  # nosec B106
        superadmin_url_setting="ASKBRIDGE_SUPERADMIN_URL",
        open_permission="products.open_askbridge_superadmin",
    ),
)


def all_products() -> tuple[Product, ...]:
    return PRODUCTS


def get_product(key: str) -> Product | None:
    return next((product for product in PRODUCTS if product.key == key), None)
