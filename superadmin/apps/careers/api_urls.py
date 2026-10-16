from django.urls import path

from . import api

app_name = "careers_api"

urlpatterns = [
    path("upload-tickets", api.upload_tickets, name="upload_tickets"),
    path("uploads/<uuid:upload_id>", api.upload, name="upload"),
    path("applications", api.applications, name="applications"),
]
