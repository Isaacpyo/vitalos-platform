from django.urls import path

from . import views

app_name = "core"

urlpatterns = [
    path("palette/", views.palette_results, name="palette"),
    path("help/", views.help_page, name="help"),
]
