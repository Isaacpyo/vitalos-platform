from django.urls import path

from . import brief_assist

app_name = "aidata_api"

urlpatterns = [
    path("brief-assist/", brief_assist.endpoint, name="brief_assist"),
]
