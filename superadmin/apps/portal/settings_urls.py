"""Settings > Users & roles > Client portal users (SuperAdmin only), mounted at /settings/."""

from django.urls import path

from .views import accounts

app_name = "portal_settings"

urlpatterns = [
    path("users/portal/", accounts.portal_users, name="users"),
    path("users/portal/<int:pk>/<str:action>/", accounts.portal_user_action, name="user_action"),
]
