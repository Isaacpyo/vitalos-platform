"""URL configuration for the client portal host (PORTAL_HOST). Only portal URLs live here: no Super Admin
pages, no APIs, no Django admin. Health checks and static files are answered by middleware before routing."""

from django.urls import include, path

urlpatterns = [
    path("", include("apps.portal.urls")),
]

handler403 = "apps.portal.errors.permission_denied"
handler404 = "apps.portal.errors.page_not_found"
handler500 = "apps.portal.errors.server_error"
