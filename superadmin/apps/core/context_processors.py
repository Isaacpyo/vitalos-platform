from django.conf import settings

from apps.accounts.otp import otp_required
from apps.accounts.roles import has_any_role, is_superadmin, primary_role


def app_context(request):
    """Values every template needs: CSP nonce for django-htmx, role flags and environment."""
    user = getattr(request, "user", None)
    htmx = getattr(request, "htmx", None)
    authenticated = bool(user and user.is_authenticated)
    # Until the second factor is done, render no app chrome (its HTMX polls would bounce).
    verified = getattr(user, "is_verified", lambda: True)()
    pending_otp = authenticated and not verified and otp_required(user)
    return {
        "show_chrome": authenticated and not pending_otp,
        "csp_nonce": getattr(request, "csp_nonce", ""),
        "app_environment": settings.APP_ENVIRONMENT,
        "is_superadmin": authenticated and is_superadmin(user),
        "has_role": authenticated and has_any_role(user),
        "user_role": primary_role(user) if authenticated else None,
        "modal_base": "partials/modal_shell.html" if htmx else "partials/page_shell.html",
    }
