from django.urls import path, re_path

from . import views
from . import workspace_views as w

app_name = "aidata"

REF = r"(?P<ref>OPP-\d{4,})"
ENQUIRY_REF = r"(?P<ref>VIT-\d{4,})"

urlpatterns = [
    path("", views.overview, name="overview"),
    path("pipeline/", views.pipeline, name="pipeline"),
    path("pipeline/new/", views.opportunity_new, name="opportunity_new"),
    path("pipeline/new/paste/", w.brief_paste, name="brief_paste"),
    path("pipeline/new/preview/<int:pk>/", w.brief_preview, name="brief_preview"),
    path("pipeline/new/preview/<int:pk>/apply/", w.brief_apply, name="brief_apply"),
    path("pipeline/new/preview/<int:pk>/discard/", w.brief_discard, name="brief_discard"),
    path("drafts/<int:pk>/status/", w.draft_status, name="draft_status"),
    path("drafts/<int:pk>/retry/", w.draft_retry, name="draft_retry"),
    path("drafts/<int:pk>/cancel/", w.draft_cancel, name="draft_cancel"),
    path("drafts/<int:pk>/save/", w.draft_save, name="draft_save"),
    path("drafts/<int:pk>/review/", w.draft_review, name="draft_review"),
    path("drafts/<int:pk>/approve/", w.draft_approve, name="draft_approve"),
    path("drafts/<int:pk>/reject/", w.draft_reject, name="draft_reject"),
    path("drafts/<int:pk>/revise/", w.draft_revise, name="draft_revise"),
    path("drafts/<int:pk>/export.<slug:fmt>", w.proposal_export, name="proposal_export"),
    re_path(rf"^pipeline/{REF}/brief/enquiry/$", w.brief_from_enquiry, name="brief_from_enquiry"),
    re_path(rf"^pipeline/{REF}/brief/paste/$", w.brief_from_text, name="brief_from_text"),
    re_path(rf"^pipeline/{REF}/field/(?P<name>[a-z_]+)/$", w.inline_field, name="inline_field"),
    re_path(rf"^pipeline/{REF}/questions/start/$", w.questions_start, name="questions_start"),
    re_path(rf"^pipeline/{REF}/discovery/start/$", w.discovery_start, name="discovery_start"),
    re_path(rf"^pipeline/{REF}/proposal/start/$", w.proposal_start, name="proposal_start"),
    re_path(rf"^pipeline/{REF}/assistant/$", w.assistant, name="assistant"),
    re_path(rf"^pipeline/{REF}/$", views.opportunity, name="opportunity"),
    re_path(rf"^pipeline/{REF}/edit/$", views.opportunity_edit, name="opportunity_edit"),
    re_path(rf"^pipeline/{REF}/score/$", views.opportunity_score, name="opportunity_score"),
    re_path(rf"^pipeline/{REF}/score/preview/$", views.score_preview, name="score_preview"),
    re_path(rf"^pipeline/{REF}/stage/$", views.opportunity_stage, name="opportunity_stage"),
    re_path(rf"^pipeline/{REF}/note/$", views.opportunity_note, name="opportunity_note"),
    re_path(rf"^from-enquiry/{ENQUIRY_REF}/$", views.from_enquiry, name="from_enquiry"),
    path("lifecycle/<slug:stage>/", views.lifecycle, name="lifecycle"),
    path("offers/", views.offers, name="offers"),
    path("offers/<slug:key>/edit/", views.offer_edit, name="offer_edit"),
    path("budget/", views.budget, name="budget"),
    path("budget/ceilings/", views.budget_settings, name="budget_settings"),
    path("budget/costs/new/", views.cost_edit, name="cost_new"),
    path("budget/costs/<int:pk>/edit/", views.cost_edit, name="cost_edit"),
    path("budget/costs/<int:pk>/delete/", views.cost_delete, name="cost_delete"),
]
