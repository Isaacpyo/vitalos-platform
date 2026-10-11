from csp.constants import UNSAFE_INLINE
from csp.decorators import csp_update
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerSplitView
from rest_framework.routers import DefaultRouter

from . import views

app_name = "api"

router = DefaultRouter()
router.register("service-lines", views.ServiceLineViewSet, basename="serviceline")
router.register("practices", views.PracticeViewSet, basename="practice")
router.register("solutions", views.SolutionViewSet, basename="solution")
router.register("offers", views.OfferViewSet, basename="offer")
router.register("team-members", views.TeamMemberViewSet, basename="teammember")
router.register("projects", views.ProjectViewSet, basename="project")
router.register("kpis", views.KPIViewSet, basename="kpi")
router.register("kpi-values", views.KPIValueViewSet, basename="kpivalue")
router.register("decisions", views.DecisionViewSet, basename="decision")

urlpatterns = [
    path("v1/company/", views.company, name="company"),
    path("v1/", include(router.urls)),
    path("schema/", SpectacularAPIView.as_view(), name="schema"),
    # Swagger UI sets inline styles; scripts load from 'self' only (split view, no inline JS).
    path(
        "docs/",
        csp_update({"style-src": [UNSAFE_INLINE]})(
            SpectacularSwaggerSplitView.as_view(url_name="api:schema")
        ),
        name="docs",
    ),
]
