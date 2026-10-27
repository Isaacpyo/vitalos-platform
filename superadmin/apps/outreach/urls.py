from django.urls import path

from . import views

app_name = "outreach"

urlpatterns = [
    path("outreach/", views.home, name="home"),
    path("outreach/upload/", views.upload, name="upload"),
    path("outreach/settings/", views.update_settings, name="settings"),
    path("outreach/start/", views.start, name="start"),
    path("outreach/pause/", views.pause, name="pause"),
    path("outreach/clear/", views.clear, name="clear"),
    path("outreach/export/", views.export, name="export"),
    path("outreach/contacts/<int:pk>/remove/", views.remove, name="remove"),
]
