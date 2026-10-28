"""Super Admin routes for the client portal (staff only), mounted at /client-portal/."""

from django.urls import path

from .views import staff

app_name = "portaladmin"

urlpatterns = [
    path("", staff.home, name="home"),
    path("orgs/new/", staff.org_new, name="org_new"),
    path("orgs/<int:pk>/", staff.org, name="org"),
    path("orgs/<int:pk>/invite/", staff.member_invite, name="member_invite"),
    path("orgs/<int:org_pk>/services/new/", staff.service_edit, name="service_new"),
    path("members/<int:pk>/<str:action>/", staff.member_action, name="member_action"),
    path("link/<str:ref>/", staff.link_challenge, name="link_challenge"),
    path("challenges/<int:pk>/", staff.challenge, name="challenge"),
    path("challenges/<int:pk>/edit/", staff.challenge_edit, name="challenge_edit"),
    path("challenges/<int:pk>/share/", staff.challenge_share, name="challenge_share"),
    path("challenges/<int:pk>/briefs/new/", staff.brief_edit, name="brief_new"),
    path("challenges/<int:pk>/briefs/<int:brief_pk>/edit/", staff.brief_edit, name="brief_edit"),
    path("briefs/<int:pk>/propose/", staff.brief_propose, name="brief_propose"),
    path("challenges/<int:challenge_pk>/projects/new/", staff.project_edit, name="project_new"),
    path("projects/<int:pk>/", staff.project, name="project"),
    path("projects/<int:pk>/edit/", staff.project_edit, name="project_edit"),
    path("projects/<int:project_pk>/milestones/new/", staff.milestone_edit, name="milestone_new"),
    path("milestones/<int:pk>/edit/", staff.milestone_edit, name="milestone_edit"),
    path("projects/<int:project_pk>/items/new/", staff.item_edit, name="item_new"),
    path("items/<int:pk>/edit/", staff.item_edit, name="item_edit"),
    path("projects/<int:project_pk>/deliverables/new/", staff.deliverable_edit, name="deliverable_new"),
    path("deliverables/<int:pk>/", staff.deliverable, name="deliverable"),
    path("deliverables/<int:pk>/edit/", staff.deliverable_edit, name="deliverable_edit"),
    path("deliverables/<int:pk>/versions/new/", staff.version_new, name="version_new"),
    path("versions/<int:pk>/<str:action>/", staff.version_action, name="version_action"),
    path("publish/<str:kind>/<int:pk>/<str:state>/", staff.publish_toggle, name="publish"),
    path("challenges/<int:challenge_pk>/updates/new/", staff.update_edit, name="update_new"),
    path("updates/<int:pk>/edit/", staff.update_edit, name="update_edit"),
    path("updates/<int:pk>/publish/", staff.update_publish, name="update_publish"),
    path("challenges/<int:pk>/questions/new/", staff.question_new, name="question_new"),
    path("questions/<int:pk>/close/", staff.question_close, name="question_close"),
    path("challenges/<int:pk>/messages/", staff.staff_message, name="staff_message"),
    path("challenges/<int:pk>/files/new/", staff.file_new, name="file_new"),
    path("files/<int:pk>/visibility/", staff.file_visibility, name="file_visibility"),
    path("files/versions/<int:pk>/download/", staff.file_download, name="file_download"),
    path("changes/<int:pk>/", staff.change_review, name="change_review"),
    path("services/<int:pk>/edit/", staff.service_edit, name="service_edit"),
    path("services/<int:pk>/report/", staff.service_report, name="service_report"),
    path("deliveries/", staff.deliveries, name="deliveries"),
    path("deliveries/<int:pk>/retry/", staff.delivery_retry, name="delivery_retry"),
    path("preview-draft/<str:kind>/<int:pk>/", staff.preview_item, name="preview_item"),
    path("preview/<int:pk>/", staff.preview_start, name="preview_start"),
]
