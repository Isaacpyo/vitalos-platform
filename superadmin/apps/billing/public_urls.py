from django.urls import path

from . import public

app_name = "billing_public"

urlpatterns = [path("checkout/", public.pay_checkout, name="checkout")]
