"""Website analytics for the Overview (finding F2): a provider adapter interface and a link-out card.

The website uses Vercel Web Analytics (``NEXT_PUBLIC_ANALYTICS_PROVIDER=vercel``, ADR-046), which has
no stable public read API. So the Overview always shows a card that links to the provider's dashboard
(``ANALYTICS_DASHBOARD_URL``), and shows numbers only when ``ANALYTICS_PROVIDER`` names an adapter in
``ADAPTERS`` that can read them and ``ANALYTICS_API_KEY`` is set. Adding a provider with a read API
means one class with a ``summary()`` method here; nothing else changes. Adapters never raise into the
page: a failed read shows the link-out card with a short note.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Protocol

from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_SECONDS = 15 * 60
LABELS = {"vercel": "Vercel Web Analytics", "none": "No analytics provider"}


@dataclass(frozen=True)
class Metric:
    label: str
    value: str


@dataclass
class AnalyticsCard:
    provider_label: str
    dashboard_url: str
    metrics: list[Metric] = field(default_factory=list)
    period: str = ""
    note: str = ""


class AnalyticsAdapter(Protocol):
    """Reads headline numbers from an analytics provider's API."""

    name: str

    def summary(self, days: int) -> list[Metric]: ...


ADAPTERS: dict[str, type] = {}  # provider name -> adapter class with a read API (none yet)


def register(name: str):
    def decorator(cls):
        ADAPTERS[name] = cls
        return cls

    return decorator


def card(days: int = 7) -> AnalyticsCard:
    provider = settings.ANALYTICS_PROVIDER or "none"
    result = AnalyticsCard(
        provider_label=LABELS.get(provider, provider.replace("_", " ").title()),
        dashboard_url=settings.ANALYTICS_DASHBOARD_URL,
    )
    adapter_class = ADAPTERS.get(provider)
    if adapter_class is None:
        result.note = (
            "Numbers stay in the provider's dashboard: it has no read API the admin can use."
            if provider == "vercel"
            else ""
        )
        return result
    if not settings.ANALYTICS_API_KEY:
        result.note = "Set ANALYTICS_API_KEY to show the numbers here."
        return result
    key = f"overview:analytics:{provider}:{days}"
    metrics = cache.get(key)
    if metrics is None:
        try:
            metrics = list(adapter_class().summary(days))
        except Exception:  # noqa: BLE001 - analytics must never break the Overview
            logger.warning("Analytics summary failed", extra={"provider": provider})
            result.note = "The analytics provider could not be reached."
            return result
        cache.set(key, metrics, CACHE_SECONDS)
    result.metrics = metrics
    result.period = f"Last {days} days"
    return result
