from django.urls import path

from . import views

app_name = "careers"

urlpatterns = [
    path("", views.root, name="root"),
    path("roles/", views.role_list, name="roles"),
    path("roles/new/", views.role_new, name="role_new"),
    path("roles/<uuid:pk>/", views.role_edit, name="role"),
    path("roles/<uuid:pk>/sync/", views.role_sync, name="role_sync"),
    path("roles/<uuid:pk>/actions/<slug:action>/", views.role_action, name="role_action"),
    path("roles/<uuid:pk>/preview/", views.role_preview_panel, name="role_preview_panel"),
    path("roles/<uuid:pk>/preview/frame/", views.role_preview_frame, name="role_preview_frame"),
    path("roles/<uuid:pk>/preview/site/", views.role_site_preview, name="role_site_preview"),
    path("applications/", views.application_list, name="applications"),
    path("applications/badge/", views.badge, name="badge"),
    path("applications/<uuid:pk>/", views.application_detail, name="application"),
    path("applications/<uuid:pk>/cv/", views.application_cv, name="application_cv"),
    path("applications/<uuid:pk>/<slug:action>/", views.application_action, name="application_action"),
    path("settings/", views.settings_page, name="settings"),
    path("settings/preview/", views.settings_preview, name="settings_preview"),
    path("settings/emails/<slug:kind>/", views.email_preview, name="email_preview"),
]
