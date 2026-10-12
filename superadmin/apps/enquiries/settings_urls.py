"""Settings → Email and Settings → Notifications live under /settings/ beside the other sections."""

from django.urls import path

from . import views

app_name = "enquiries_settings"

urlpatterns = [
    path("email/", views.settings_email, name="email"),
    path("notifications/", views.settings_notifications, name="notifications"),
]
