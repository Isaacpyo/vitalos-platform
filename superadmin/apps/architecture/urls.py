from django.urls import path, re_path

from .views import entities, pages, settings

app_name = "architecture"

ENTITY = r"(?P<kind>serviceline|practice|solution|offer|teammember|project|kpi|kpivalue|decision)"

urlpatterns = [
    path("", pages.home, name="home"),
    path("s/<slug:slug>/", pages.service_dashboard, name="service_dashboard"),
    path("architecture/", pages.architecture, name="architecture"),
    path(
        "architecture/service-lines/<int:pk>/move/<str:direction>/",
        pages.service_line_move,
        name="service_line_move",
    ),
    path(
        "architecture/service-lines/<int:pk>/active/", pages.service_line_active, name="service_line_active"
    ),
    path("team/", pages.team_overview, name="team"),
    path("search/", pages.search_view, name="search"),
    path("activity/", pages.activity_view, name="activity"),
    re_path(rf"^e/{ENTITY}/new/$", entities.entity_create, name="entity_create"),
    re_path(rf"^e/{ENTITY}/(?P<pk>\d+)/edit/$", entities.entity_edit, name="entity_edit"),
    re_path(rf"^e/{ENTITY}/(?P<pk>\d+)/archive/$", entities.entity_archive, name="entity_archive"),
    re_path(rf"^e/{ENTITY}/(?P<pk>\d+)/restore/$", entities.entity_restore, name="entity_restore"),
    path("projects/<int:pk>/status/", entities.project_status, name="project_status"),
    path("settings/company/", settings.settings_company, name="settings_company"),
    path("settings/data/", settings.settings_data, name="settings_data"),
    path("settings/data/export/<str:resource>.csv", settings.csv_export, name="csv_export"),
]
