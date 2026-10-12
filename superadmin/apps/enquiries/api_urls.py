from django.urls import path

from . import api

app_name = "enquiries_api"

urlpatterns = [
    path("inbound/email", api.inbound_email, name="inbound_email"),
    path("inbound/web-form", api.inbound_web_form, name="inbound_web_form"),
    path("webhooks/resend", api.resend_webhook, name="resend_webhook"),
]
