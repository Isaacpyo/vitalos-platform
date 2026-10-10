from django.http import Http404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.architecture import selectors
from apps.architecture.models import (
    KPI,
    Company,
    Decision,
    KPIValue,
    Offer,
    Practice,
    Project,
    ServiceLine,
    Solution,
    TeamMember,
)

from . import serializers

ARCHIVED_PARAM = OpenApiParameter(
    "include_archived", bool, description="Include archived records (default false)."
)


class GovernedViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only, classification-aware listing. Archived rows only on request."""

    select_related: tuple[str, ...] = ()
    prefetch_related: tuple[str, ...] = ()

    def get_queryset(self):
        queryset = self.queryset.model.objects.all()
        if self.request.query_params.get("include_archived", "").lower() not in {"1", "true", "yes"}:
            queryset = queryset.filter(is_archived=False)
        if self.select_related:
            queryset = queryset.select_related(*self.select_related)
        if self.prefetch_related:
            queryset = queryset.prefetch_related(*self.prefetch_related)
        return selectors.visible(queryset, self.request.user).order_by(*self.ordering)


def _viewset(model, serializer, ordering, related=(), lookup="pk", prefetch=()):
    attrs = {
        "queryset": model.objects.all(),
        "serializer_class": serializer,
        "ordering": ordering,
        "select_related": related,
        "prefetch_related": prefetch,
        "lookup_field": lookup,
    }
    cls = type(f"{model.__name__}ViewSet", (GovernedViewSet,), attrs)
    return extend_schema_view(list=extend_schema(parameters=[ARCHIVED_PARAM]))(cls)


ServiceLineViewSet = _viewset(ServiceLine, serializers.ServiceLineSerializer, ("order",), ("owner",), "slug")
PracticeViewSet = _viewset(
    Practice, serializers.PracticeSerializer, ("service_line__order", "order"), ("service_line",)
)
SolutionViewSet = _viewset(Solution, serializers.SolutionSerializer, ("practice_id", "order"))
OfferViewSet = _viewset(Offer, serializers.OfferSerializer, ("solution_id", "order"))
TeamMemberViewSet = _viewset(
    TeamMember, serializers.TeamMemberSerializer, ("name",), prefetch=("service_lines",)
)
ProjectViewSet = _viewset(Project, serializers.ProjectSerializer, ("-start_date", "name"), ("service_line",))
KPIViewSet = _viewset(KPI, serializers.KPISerializer, ("service_line__order", "order"), ("service_line",))
KPIValueViewSet = _viewset(KPIValue, serializers.KPIValueSerializer, ("kpi_id", "-date"))
DecisionViewSet = _viewset(Decision, serializers.DecisionSerializer, ("-date",), ("service_line",))


@extend_schema(responses=serializers.CompanySerializer)
@api_view(["GET"])
def company(request):
    """The Vitalos company profile (singleton)."""
    profile = Company.load()
    if profile is None or not selectors.can_view(request.user, profile):
        raise Http404
    return Response(serializers.CompanySerializer(profile).data)
