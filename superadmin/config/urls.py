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
    path("mail/", include("apps.outreach.urls")),
    path("relay/", include("apps.relay.urls")),
    path("products/", include("apps.products.urls")),
    path("audit/", include("apps.audit.urls")),
    path("insights/", include("apps.insights.urls")),
    path("content/", include("apps.content_sync.urls")),
    path("api/ai-data/", include("apps.aidata.api_urls")),
    path("api/content/v1/", include("apps.content_sync.api_urls")),
    path("api/careers/v1/", include("apps.careers.api_urls")),
    path("careers/", include("apps.careers.urls")),
    path("ai-data/demonstrator/", include("apps.recon_demo.urls")),
    path("ai-data/", include("apps.aidata.urls")),
    path("billing/", include("apps.billing.urls")),
    # "Preview as customer": the customer workspace, read-only, bound to one member, for staff only.
    path(
        "client-portal/preview/<int:preview_member>/as/",
        include(("apps.portal.preview_urls", "portal"), namespace="portal_preview"),
    ),
    path("client-portal/", include("apps.portal.admin_urls")),
    # Customer portal, local preview only: the middleware answers 404 here unless PORTAL_HOST is empty and the
    # portal is enabled. With PORTAL_HOST set the portal is served only on that host (config.portal_urls).
    path("portal/", include("apps.portal.urls")),
    path("pay/", include("apps.billing.public_urls")),
    path("api/webhooks/stripe/", include("apps.billing.api_urls")),
    path("api/", include("apps.enquiries.api_urls")),
    path("api/", include("apps.relay.api_urls")),
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

handler403 = "apps.portal.errors.permission_denied"
handler404 = "apps.portal.errors.page_not_found"
handler500 = "apps.portal.errors.server_error"
