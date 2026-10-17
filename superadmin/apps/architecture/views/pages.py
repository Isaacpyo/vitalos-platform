"""Read-mostly pages: home, service dashboards, architecture tree, search and activity."""

from datetime import datetime

from django.contrib.auth import get_user_model
from django.db.models import Count, Prefetch, Q
from django.shortcuts import get_object_or_404, render
from django.utils.dateparse import parse_datetime
from django.views.decorators.http import require_GET, require_POST

from apps.accounts.roles import (
    SUPERADMIN,
    has_service_access,
    is_superadmin,
    primary_role,
    role_label,
    role_required,
)
from apps.core import overview
from apps.core.htmx import changed_response
from apps.enquiries.selectors import can_access as can_access_enquiries

from .. import activity, search, selectors, services
from ..models import Decision, Offer, Practice, Project, ServiceLine, Solution, TeamMember
from ..selectors import visible

TABS = [
    ("overview", "Overview"),
    ("structure", "Structure"),
    ("team", "Team"),
    ("projects", "Projects"),
    ("kpis", "KPIs"),
]


def _show_archived(request) -> bool:
    return request.GET.get("archived") == "1"


def _partial(request, target: str) -> bool:
    htmx = getattr(request, "htmx", None)
    return bool(htmx) and not htmx.history_restore_request and htmx.target == target


@role_required()
@require_GET
def home(request):
    user = request.user
    context = {
        "service_lines": selectors.service_lines_for_home(user),
        "recent_activity": activity.feed(user, limit=8),
        "show_enquiry_kpis": can_access_enquiries(user),
    }
    if context["show_enquiry_kpis"]:
        context["kpis"] = overview.enquiry_kpis()
        context["attention_count"] = len(overview.needs_attention())
    return render(request, "architecture/home.html", context)


@role_required()
@require_GET
def service_lines(request):
    context = {"service_lines": selectors.service_lines_for_home(request.user)}
    return render(request, "architecture/service_lines.html", context)


def _overview(request, line, archived):
    user = request.user
    return {
        "kpis": selectors.kpi_tiles(line, user),
        "recent_projects": visible(line.projects.active(), user)
        .select_related("lead")
        .order_by("-updated_at")[:5],
        "decisions": selectors.decisions_for(line, user, limit=5),
        "activity_entries": activity.feed(user, service_line=line, limit=10),
    }


def _structure(request, line, archived):
    user = request.user

    def scoped(queryset):
        queryset = visible(queryset, user)
        return queryset if archived else queryset.filter(is_archived=False)

    offers = scoped(Offer.objects.all())
    solutions = scoped(Solution.objects.all()).prefetch_related(Prefetch("offers", queryset=offers))
    practices = scoped(line.practices.all()).prefetch_related(Prefetch("solutions", queryset=solutions))
    return {"practices": practices}


def _team(request, line, archived):
    members = visible(line.team_members.all(), request.user).select_related("user")
    if not archived:
        members = members.filter(is_archived=False)
    return {"members": members}


def _projects(request, line, archived):
    status = request.GET.get("status", "")
    projects = visible(line.projects.all(), request.user).select_related("lead")
    if not archived:
        projects = projects.filter(is_archived=False)
    if status in Project.Status.values:
        projects = projects.filter(status=status)
    counts = dict(
        visible(line.projects.active(), request.user).values_list("status").annotate(total=Count("pk"))
    )
    return {
        "projects": projects,
        "status_filter": status,
        "status_choices": Project.Status.choices,
        "status_counts": counts,
    }


def _kpis(request, line, archived):
    return {"kpis": selectors.kpi_tiles(line, request.user, points=24)}


TAB_BUILDERS = {
    "overview": _overview,
    "structure": _structure,
    "team": _team,
    "projects": _projects,
    "kpis": _kpis,
}


@role_required()
@require_GET
def service_dashboard(request, slug):
    user = request.user
    line = get_object_or_404(visible(ServiceLine.objects.select_related("owner"), user), slug=slug)
    tab = request.GET.get("tab", "overview")
    if tab not in TAB_BUILDERS:
        tab = "overview"
    archived = _show_archived(request)
    context = {
        "line": line,
        "tab": tab,
        "tabs": TABS,
        "show_archived": archived,
        "can_edit": has_service_access(user, line),
        "can_edit_team": is_superadmin(user),
        "active_projects": line.projects.active().filter(status=Project.Status.ACTIVE).count(),
    }
    context.update(TAB_BUILDERS[tab](request, line, archived))
    template = (
        "architecture/dashboard/_region.html"
        if _partial(request, "tab-region")
        else "architecture/dashboard/page.html"
    )
    return render(request, template, context)


@role_required()
@require_GET
def architecture(request):
    user = request.user
    archived = _show_archived(request)
    lines = visible(ServiceLine.objects.select_related("owner"), user)
    if not archived:
        lines = lines.filter(is_archived=False)
    offers = visible(Offer.objects.active(), user)
    solutions = visible(Solution.objects.active(), user).prefetch_related(Prefetch("offers", queryset=offers))
    practices = visible(Practice.objects.active(), user).prefetch_related(
        Prefetch("solutions", queryset=solutions)
    )
    lines = lines.prefetch_related(Prefetch("practices", queryset=practices)).annotate(
        project_total=Count("projects", filter=Q(projects__is_archived=False), distinct=True),
        member_total=Count("team_members", filter=Q(team_members__is_archived=False), distinct=True),
    )
    context = {
        "company": selectors.company(user),
        "lines": lines,
        "show_archived": archived,
        "can_manage": is_superadmin(user),
        "company_decisions": visible(Decision.objects.active().filter(service_line__isnull=True), user)[:5],
    }
    template = (
        "architecture/_tree.html"
        if _partial(request, "architecture-region")
        else "architecture/architecture.html"
    )
    return render(request, template, context)


@role_required(SUPERADMIN)
@require_POST
def service_line_move(request, pk, direction):
    line = get_object_or_404(ServiceLine, pk=pk)
    services.move_service_line(line, "up" if direction == "up" else "down", request.user)
    return changed_response(request, "/architecture/")


@role_required(SUPERADMIN)
@require_POST
def service_line_active(request, pk):
    line = get_object_or_404(ServiceLine, pk=pk)
    active = request.POST.get("active") == "1"
    services.set_service_line_active(line, active, request.user)
    message = f"{line.name} {'reactivated' if active else 'retired'}."
    return changed_response(request, "/architecture/", message)


@role_required()
@require_GET
def search_view(request):
    query = request.GET.get("q", "").strip()[:100]
    groups = search.search(request.user, query) if query else []
    context = {"query": query, "groups": groups, "total": sum(len(group.results) for group in groups)}
    if _partial(request, "search-results"):
        return render(request, "search/_dropdown.html", context)
    return render(request, "search/results.html", context)


@role_required()
@require_GET
def activity_view(request):
    user = request.user
    lines = visible(ServiceLine.objects.all(), user)
    line = lines.filter(slug=request.GET.get("service_line", "")).first()
    model_key = request.GET.get("model", "")
    if model_key not in activity.FEED_MODELS:
        model_key = ""
    before = parse_datetime(request.GET.get("before", "")) if request.GET.get("before") else None
    if isinstance(before, datetime) and before.tzinfo is None:
        before = None
    entries = activity.feed(user, service_line=line, model_key=model_key or None, limit=30, before=before)
    context = {
        "entries": entries,
        "lines": lines,
        "selected_line": line,
        "model_key": model_key,
        "model_choices": activity.MODEL_CHOICES,
        "next_before": entries[-1].when.isoformat() if len(entries) == 30 else "",
    }
    if _partial(request, "activity-more"):
        return render(request, "activity/_page.html", context)
    if _partial(request, "activity-list"):
        return render(request, "activity/_list.html", context)
    return render(request, "activity/feed.html", context)


@role_required()
@require_GET
def team_overview(request):
    """Company-wide team: every person with an admin account, then team members without one.

    One person is one user who may also be a team member (ADR-049), so the user list is the source
    and the linked team member adds the role title and service lines.
    """
    user = request.user
    archived = _show_archived(request)
    members = (
        visible(TeamMember.objects.all(), user).prefetch_related("service_lines").select_related("user")
    )
    if not archived:
        members = members.filter(is_archived=False)
    members = list(members)
    member_by_user = {member.user_id: member for member in members if member.user_id}
    owned: dict[int, list] = {}
    for line in ServiceLine.objects.filter(is_archived=False, owner__isnull=False).order_by("order"):
        owned.setdefault(line.owner_id, []).append(line)
    people = []
    for account in get_user_model().objects.filter(is_active=True).order_by("full_name", "email"):
        role = primary_role(account)
        if role is None and not account.is_superuser:
            continue
        member = member_by_user.get(account.pk)
        lines = list(member.service_lines.all()) if member else []
        lines += [line for line in owned.get(account.pk, []) if line not in lines]
        people.append({"user": account, "member": member, "role": role_label(account), "lines": lines})
    unlinked = [member for member in members if not member.user_id]
    return render(
        request,
        "architecture/team.html",
        {
            "people": people,
            "unlinked_members": unlinked,
            "show_archived": archived,
            "can_edit_team": is_superadmin(user),
        },
    )
