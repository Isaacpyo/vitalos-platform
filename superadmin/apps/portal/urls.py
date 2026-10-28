"""Customer portal URLs. Mounted at the root of PORTAL_HOST (config.portal_urls), at /portal/ for local preview,
and under /client-portal/preview/<member>/ for staff "Preview as customer" (namespace portal_preview)."""

from django.urls import path

from .views import auth, customer

app_name = "portal"

auth_patterns = [
    # Access
    path("sign-in/", auth.login_view, name="login"),
    path("sign-in/verify/", auth.otp_verify, name="otp_verify"),
    path("sign-out/", auth.logout_view, name="logout"),
    path("forgot-password/", auth.forgot_password, name="forgot"),
    path("reset/<uidb64>/<token>/", auth.reset_password, name="reset_password"),
    path("invitation/<str:token>/", auth.invitation, name="invitation"),
]

workspace_patterns = [
    path("account/", customer.account, name="account"),
    path("account/security/", auth.otp_setup, name="otp_setup"),
    path("", customer.dashboard, name="home"),
    path("challenges/", customer.challenges, name="challenges"),
    path("challenges/<int:pk>/", customer.challenge, name="challenge"),
    path("challenges/<int:pk>/discuss/", customer.challenge_discuss, name="challenge_discuss"),
    path("challenges/<int:pk>/briefs/<int:brief_pk>/review/", customer.brief_review, name="brief_review"),
    path("projects/<int:pk>/", customer.project, name="project"),
    path("projects/<int:pk>/export.csv", customer.project_export, name="project_export"),
    path("projects/<int:pk>/changes/new/", customer.change_new, name="change_new"),
    path("changes/<int:pk>/", customer.change, name="change"),
    path("milestones/<int:pk>/", customer.milestone, name="milestone"),
    path("deliverables/<int:pk>/", customer.deliverable, name="deliverable"),
    path("versions/<int:pk>/approve/", customer.version_approve, name="version_approve"),
    path("versions/<int:pk>/changes/", customer.version_changes, name="version_changes"),
    path("versions/<int:pk>/accept/", customer.version_accept, name="version_accept"),
    path("questions/", customer.questions, name="questions"),
    path("questions/<int:pk>/", customer.question, name="question"),
    path("updates/<int:pk>/", customer.update, name="update"),
    path("files/", customer.files, name="files"),
    path("files/upload/", customer.file_upload, name="file_upload"),
    path("files/<int:pk>/", customer.file, name="file"),
    path("files/versions/<int:pk>/download/", customer.file_download, name="file_download"),
    path("activity/", customer.activity, name="activity"),
    path("search/", customer.search, name="search"),
    path("assistant/<str:activity>/", customer.assistant, name="assistant"),
    # Notifications
    path("notifications/", customer.notifications_list, name="notifications"),
    path("notifications/read-all/", customer.notifications_read_all, name="notifications_read_all"),
    path("notifications/preferences/", customer.notification_preferences, name="notification_preferences"),
    path("notifications/<int:pk>/open/", customer.notification_open, name="notification_open"),
]

urlpatterns = auth_patterns + workspace_patterns
