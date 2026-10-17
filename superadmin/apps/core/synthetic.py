"""Synthetic records created by the post-deploy smoke test (``e2e/smoke.py``) and how to hide them.

The smoke test runs against production as the owner's own account, so its records and audit rows
carry no distinct actor. It names everything it creates ``Smoke test <kind> <YYYYmmdd-HHMMSS>`` and
files its project under the client ``Synthetic smoke test``. Those two conventions are the marker.

Synthetic data is hidden from every user-facing listing (display only; nothing is deleted and the
audit trail is untouched, Django admin still shows everything). The smoke test itself opts back in
with the ``vitalos_show_synthetic=1`` cookie so it can verify its own records.
"""

import re
from contextvars import ContextVar

from django.db.models import Q

SYNTHETIC_CLIENT = "Synthetic smoke test"
SHOW_COOKIE = "vitalos_show_synthetic"
_STAMP = r"[0-9]{8}-[0-9]{6}"
#: Exact name of a record created by the smoke test.
NAME_PATTERN = rf"^Smoke test .+ {_STAMP}$"
#: The same names inside free text (notification titles, audit summaries).
FRAGMENT_PATTERN = rf"Smoke test (practice|solution|offer|project|KPI) {_STAMP}"

_NAME_RE = re.compile(NAME_PATTERN.replace("[0-9]", r"\d"))
_FRAGMENT_RE = re.compile(FRAGMENT_PATTERN.replace("[0-9]", r"\d"))

show_synthetic: ContextVar[bool] = ContextVar("show_synthetic", default=False)

NAMED_MODELS = {"practice", "solution", "offer", "project", "kpi"}


def is_synthetic_name(name: str | None) -> bool:
    return bool(name) and bool(_NAME_RE.match(name))


def is_synthetic_client(client: str | None) -> bool:
    return client == SYNTHETIC_CLIENT


def has_synthetic_text(text: str | None) -> bool:
    return bool(text) and bool(_FRAGMENT_RE.search(text))


def _kind(model) -> str:
    return model._meta.model_name.removeprefix("historical")


def synthetic_q(model) -> Q | None:
    """Q matching synthetic rows of an architecture model (or its history model), or None."""
    kind = _kind(model)
    if kind in NAMED_MODELS:
        q = Q(name__regex=NAME_PATTERN)
        if kind == "project":
            q |= Q(client=SYNTHETIC_CLIENT)
        return q
    if kind == "kpivalue":
        from apps.architecture.models import KPI

        return Q(kpi_id__in=KPI.objects.filter(name__regex=NAME_PATTERN).values("pk"))
    return None


def not_synthetic_project_q(prefix: str = "") -> Q:
    """Filter for annotations over a ``projects`` relation (``prefix="projects__"``)."""
    if show_synthetic.get():
        return Q()
    return ~(Q(**{f"{prefix}name__regex": NAME_PATTERN}) | Q(**{f"{prefix}client": SYNTHETIC_CLIENT}))


def exclude_synthetic(queryset):
    """Drop synthetic rows unless this request opted in (the smoke test's own session)."""
    if show_synthetic.get():
        return queryset
    q = synthetic_q(queryset.model)
    return queryset.exclude(q) if q is not None else queryset


def exclude_synthetic_text(queryset, *fields: str):
    """Drop rows whose free-text fields mention a synthetic record (notifications, audit events)."""
    if show_synthetic.get():
        return queryset
    for name in fields:
        queryset = queryset.exclude(**{f"{name}__regex": FRAGMENT_PATTERN})
    return queryset


class SyntheticVisibilityMiddleware:
    """Let the smoke test's browser session see its own records (cookie opt-in)."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        token = show_synthetic.set(request.COOKIES.get(SHOW_COOKIE) == "1")
        try:
            return self.get_response(request)
        finally:
            show_synthetic.reset(token)
