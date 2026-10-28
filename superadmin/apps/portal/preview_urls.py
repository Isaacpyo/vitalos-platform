"""The customer workspace routes only (no sign-in or password routes), for staff preview."""

from .urls import workspace_patterns

app_name = "portal"
urlpatterns = workspace_patterns
