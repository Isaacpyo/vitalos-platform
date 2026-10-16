"""Settings → Website content lives under /settings/ beside the other sections."""

from django.urls import path

from . import views

app_name = "content_settings"

urlpatterns = [path("content/", views.site_settings, name="site")]
