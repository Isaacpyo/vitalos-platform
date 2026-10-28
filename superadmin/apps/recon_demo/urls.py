from django.urls import path

from . import views

app_name = "recon_demo"

urlpatterns = [
    path("", views.index, name="index"),
    path("new/", views.new_run, name="new"),
    path("runs/<str:ref>/", views.detail, name="detail"),
    path("runs/<str:ref>/retry/", views.retry, name="retry"),
    path("runs/<str:ref>/continue/", views.continue_without_model, name="continue"),
    path("runs/<str:ref>/run-again/", views.run_again, name="run_again"),
    path("runs/<str:ref>/review/<int:item_id>/", views.decide, name="decide"),
    path("evaluation/", views.evaluation, name="evaluation"),
    path("settings/", views.ai_settings, name="settings"),
]
