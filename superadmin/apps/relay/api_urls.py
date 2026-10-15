from django.urls import path

from . import api

app_name = "relay_api"

urlpatterns = [
    path("inbound/relay", api.inbound, name="inbound"),
]
