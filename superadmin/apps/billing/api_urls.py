from django.urls import path

from . import public

app_name = "billing_api"

urlpatterns = [path("", public.stripe_webhook, name="stripe_webhook")]
