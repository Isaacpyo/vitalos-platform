from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("", include("apps.accounts.urls")),
    path("", include("apps.core.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("enquiries/", include("apps.enquiries.urls")),
    path("mail/", include("apps.email_templates.urls")),
    path("relay/", include("apps.relay.urls")),
    path("audit/", include("apps.audit.urls")),
    path("api/", include("apps.enquiries.api_urls")),
    path("api/", include("apps.relay.api_urls")),
    path("settings/", include("apps.enquiries.settings_urls")),
    path("api/", include("apps.api.urls")),
    path("", include("apps.architecture.urls")),
]

handler403 = "apps.core.views.permission_denied"
handler404 = "apps.core.views.page_not_found"
handler500 = "apps.core.views.server_error"
