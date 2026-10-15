from django.conf import settings
from django.contrib import admin
from django.urls import include, path, re_path
from django.views.static import serve

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("", include("apps.accounts.urls")),
    path("", include("apps.core.urls")),
    path("notifications/", include("apps.notifications.urls")),
    path("enquiries/", include("apps.enquiries.urls")),
    path("mail/", include("apps.email_templates.urls")),
    path("audit/", include("apps.audit.urls")),
    path("insights/", include("apps.insights.urls")),
    path("content/", include("apps.content_sync.urls")),
    path("api/content/v1/", include("apps.content_sync.api_urls")),
    path("api/careers/v1/", include("apps.careers.api_urls")),
    path("careers/", include("apps.careers.urls")),
    path("api/", include("apps.enquiries.api_urls")),
    path("settings/", include("apps.enquiries.settings_urls")),
    path("settings/", include("apps.content_sync.settings_urls")),
    path("api/", include("apps.api.urls")),
    path("", include("apps.architecture.urls")),
]

if settings.APP_ENVIRONMENT == "development" and not settings.CONTENT_MEDIA_BUCKET:
    # Development only: post and author images from local disk (production uses the public bucket).
    urlpatterns.insert(
        0,
        re_path(
            r"^media/(?P<path>content/[0-9a-f-]{36}\.(?:jpg|png|webp|avif))$",
            serve,
            {"document_root": settings.BASE_DIR / "media" / "public"},
        ),
    )

handler403 = "apps.core.views.permission_denied"
handler404 = "apps.core.views.page_not_found"
handler500 = "apps.core.views.server_error"
