"""Read rules: which records a user may see. Classification gates visibility.

* Public and Internal: every user with a role.
* Confidential: SuperAdmin, and ServiceLeads for the service lines they can access.
* Restricted: SuperAdmin only.
"""

from django.db.models import Count, Q

from apps.accounts.roles import accessible_service_line_ids, has_any_role, is_superadmin
from apps.core.models import Classification

from .models import KPI, Company, Decision, KPIValue, Project, ServiceLine

OPEN_CLASSIFICATIONS = (Classification.PUBLIC, Classification.INTERNAL)


def _service_line_lookup(path: str) -> str:
    # "pk"/"id" mean the row is itself a service line (history rows must use "id", not "pk").
    return f"{path}__in"


def visibility_q(user, service_line_path: str | None, prefix: str = "") -> Q:
    """Q object restricting a queryset (or a related lookup via ``prefix``) to visible rows."""
    if is_superadmin(user):
        return Q()
    if not has_any_role(user):
        return Q(pk__in=[])
    q = Q(**{f"{prefix}classification__in": OPEN_CLASSIFICATIONS})
    ids = accessible_service_line_ids(user)
    if ids and service_line_path:
        q |= Q(
            **{
                f"{prefix}classification": Classification.CONFIDENTIAL,
                f"{prefix}{_service_line_lookup(service_line_path)}": ids,
            }
        )
    return q


def visible(queryset, user):
    model = queryset.model
    path = getattr(model, "service_line_path", None)
    queryset = queryset.filter(visibility_q(user, path))
    if path == "service_lines":
        queryset = queryset.distinct()
    return queryset


def can_view(user, obj) -> bool:
    if is_superadmin(user):
        return True
    if not has_any_role(user):
        return False
    if obj.classification in OPEN_CLASSIFICATIONS:
        return True
    if obj.classification != Classification.CONFIDENTIAL:
        return False
    ids = accessible_service_line_ids(user) or set()
    if isinstance(obj, ServiceLine):
        return obj.pk in ids
    if hasattr(obj, "service_lines"):
        return bool(ids & set(obj.service_lines.values_list("pk", flat=True)))
    service_line = getattr(obj, "service_line", None)
    return service_line is not None and service_line.pk in ids


def company(user) -> Company | None:
    profile = Company.load()
    return profile if profile is not None and can_view(user, profile) else None


def service_lines_for_home(user):
    """Active service lines with the aggregates shown on homepage cards."""
    lines = list(
        visible(ServiceLine.objects.active().filter(is_active=True), user)
        .select_related("owner")
        .annotate(
            active_projects=Count(
                "projects",
                filter=Q(projects__status=Project.Status.ACTIVE, projects__is_archived=False),
                distinct=True,
            )
        )
    )
    headline = {}
    kpis = visible(KPI.objects.active().filter(service_line__in=lines), user).order_by(
        "-is_headline", "order", "name"
    )
    for kpi in kpis:
        headline.setdefault(kpi.service_line_id, kpi)
    latest = latest_values([kpi.pk for kpi in headline.values()], user)
    for line in lines:
        kpi = headline.get(line.pk)
        line.headline_kpi = kpi
        line.headline_value = latest.get(kpi.pk) if kpi else None
    return lines


def latest_values(kpi_ids, user) -> dict[int, KPIValue]:
    result: dict[int, KPIValue] = {}
    rows = visible(KPIValue.objects.active().filter(kpi_id__in=kpi_ids), user).order_by("kpi_id", "-date")
    for row in rows:
        result.setdefault(row.kpi_id, row)
    return result


def kpi_tiles(service_line, user, points: int = 12):
    """KPIs with their recent values (oldest first) for tiles and sparklines."""
    kpis = list(visible(service_line.kpis.active(), user).order_by("-is_headline", "order", "name"))
    for kpi in kpis:
        recent = list(visible(kpi.values.active(), user).order_by("-date")[:points])
        recent.reverse()
        kpi.recent_values = recent
        kpi.latest = recent[-1] if recent else None
        kpi.previous = recent[-2] if len(recent) > 1 else None
        kpi.breached = kpi.is_breach(kpi.latest.value) if kpi.latest else False
    return kpis


def decisions_for(service_line, user, limit=None):
    qs = visible(Decision.objects.active().filter(service_line=service_line), user)
    return qs[:limit] if limit else qs
