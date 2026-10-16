from django.urls import path

from . import views

app_name = "content_sync"

urlpatterns = [
    path("sync/", views.sync_log, name="sync"),
    path("sync/status/", views.overall_status, name="overall"),
    path("sync/resync/", views.resync, name="resync"),
    path("sync/<uuid:pk>/retry/", views.retry, name="retry"),
]
