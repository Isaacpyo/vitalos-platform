"""Reads for the Careers admin: role and application lists, counts and the nav badge."""

import uuid

from django.db.models import Count, Q

from .models import Application, ApplicationStage, Role, RoleStatus

MAX_QUERY = 100
ROLE_TABS = {
    "open": ("Open", RoleStatus.OPEN),
    "drafts": ("Drafts", RoleStatus.DRAFT),
    "paused": ("Paused", RoleStatus.PAUSED),
    "closed": ("Closed", RoleStatus.CLOSED),
    "archived": ("Archived", RoleStatus.ARCHIVED),
}
APPLICATION_TABS = {
    "new": ("New", (ApplicationStage.NEW,)),
    "reviewing": ("Reviewing", (ApplicationStage.REVIEWING,)),
    "interview": ("Interview", (ApplicationStage.INTERVIEW,)),
    "offer": ("Offer", (ApplicationStage.OFFER,)),
    "hired": ("Hired", (ApplicationStage.HIRED,)),
    "rejected": ("Rejected", (ApplicationStage.REJECTED,)),
    "withdrawn": ("Withdrawn", (ApplicationStage.WITHDRAWN,)),
    "all": ("All", None),
}


def _uuid(value):
    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None


def role_counts() -> dict[str, int]:
    by_status = dict(
        Role.objects.order_by().values_list("status").annotate(n=Count("id")).values_list("status", "n")
    )
    return {key: by_status.get(status, 0) for key, (_, status) in ROLE_TABS.items()}


def roles(tab: str = "open"):
    status = ROLE_TABS.get(tab, ROLE_TABS["open"])[1]
    return (
        Role.objects.filter(status=status)
        .defer("published_snapshot")
        .annotate(
            applications_total=Count("applications", distinct=True),
            applications_new=Count(
                "applications", filter=Q(applications__stage=ApplicationStage.NEW), distinct=True
            ),
        )
        .order_by("sort", "-updated_at")
    )


def application_counts() -> dict[str, int]:
    by_stage = dict(
        Application.objects.order_by().values_list("stage").annotate(n=Count("id")).values_list("stage", "n")
    )
    counts = {"all": sum(by_stage.values())}
    for key, (_, stages) in APPLICATION_TABS.items():
        if stages:
            counts[key] = sum(by_stage.get(stage, 0) for stage in stages)
    return counts


def applications(*, tab: str = "new", role_id: str = "", query: str = ""):
    rows = Application.objects.select_related("role")
    stages = APPLICATION_TABS.get(tab, APPLICATION_TABS["new"])[1]
    if stages:
        rows = rows.filter(stage__in=stages)
    role_pk = _uuid(role_id) if role_id else None
    if role_pk is not None:
        rows = rows.filter(role_id=role_pk)
    query = (query or "").strip()[:MAX_QUERY]
    if query:
        rows = rows.filter(Q(name__icontains=query) | Q(email__icontains=query))
    return rows.order_by("-created_at", "-id")


def badge_count() -> int:
    """New applications nobody has opened yet."""
    return Application.objects.filter(stage=ApplicationStage.NEW, seen_at__isnull=True).count()
