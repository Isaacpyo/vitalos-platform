from django.urls import path

from . import views

app_name = "products"

urlpatterns = [
    path("", views.index, name="index"),
    path("<slug:key>/", views.detail, name="detail"),
    path("<slug:key>/open/", views.open_superadmin, name="open"),
]
