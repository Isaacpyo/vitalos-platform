from django.urls import path, re_path

from . import views

app_name = "aidata"

REF = r"(?P<ref>OPP-\d{4,})"
ENQUIRY_REF = r"(?P<ref>VIT-\d{4,})"

urlpatterns = [
    path("", views.overview, name="overview"),
    path("pipeline/", views.pipeline, name="pipeline"),
    path("pipeline/new/", views.opportunity_new, name="opportunity_new"),
    re_path(rf"^pipeline/{REF}/$", views.opportunity, name="opportunity"),
    re_path(rf"^pipeline/{REF}/edit/$", views.opportunity_edit, name="opportunity_edit"),
    re_path(rf"^pipeline/{REF}/score/$", views.opportunity_score, name="opportunity_score"),
    re_path(rf"^pipeline/{REF}/score/preview/$", views.score_preview, name="score_preview"),
    re_path(rf"^pipeline/{REF}/stage/$", views.opportunity_stage, name="opportunity_stage"),
    re_path(rf"^pipeline/{REF}/note/$", views.opportunity_note, name="opportunity_note"),
    re_path(rf"^from-enquiry/{ENQUIRY_REF}/$", views.from_enquiry, name="from_enquiry"),
    path("offers/", views.offers, name="offers"),
    path("offers/<slug:key>/edit/", views.offer_edit, name="offer_edit"),
    path("budget/", views.budget, name="budget"),
    path("budget/ceilings/", views.budget_settings, name="budget_settings"),
    path("budget/costs/new/", views.cost_edit, name="cost_new"),
    path("budget/costs/<int:pk>/edit/", views.cost_edit, name="cost_edit"),
    path("budget/costs/<int:pk>/delete/", views.cost_delete, name="cost_delete"),
]
