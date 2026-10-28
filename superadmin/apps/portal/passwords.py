"""Portal password reset. Always answers the same way; only live portal members can receive a link; the link goes
to the portal host (never the Super Admin) and reuses the 30-minute single-use token generator."""

from __future__ import annotations

from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode

from apps.accounts.roles import user_roles
from apps.accounts.tokens import set_password_token
from apps.audit.models import AuditEvent
from apps.audit.services import record

from . import selectors

RESET_LIMIT_PER_HOUR = 3


def eligible_user(user):
    return bool(user and user.is_active and not user_roles(user) and selectors.get_membership(user))


def user_from_uid(uidb64):
    try:
        pk = int(force_str(urlsafe_base64_decode(uidb64)))
    except (TypeError, ValueError, OverflowError):
        return None
    user = get_user_model().objects.filter(pk=pk, is_active=True).first()
    return user if eligible_user(user) else None


def request_reset(email: str, request) -> bool:
    """Email a reset link if ``email`` belongs to a live portal member. The caller never reveals the result."""
    from apps.mailer import system

    from .access import portal_absolute

    email = email.strip().lower()
    since = timezone.now() - timedelta(hours=1)
    recent = AuditEvent.objects.filter(
        action="portal.password_reset_requested", created_at__gte=since, metadata__email=email
    ).count()
    record("portal.password_reset_requested", request=request, summary="Reset requested", email=email)
    user = get_user_model().objects.filter(email__iexact=email).first()
    if not eligible_user(user) or recent >= RESET_LIMIT_PER_HOUR:
        return False
    link = portal_absolute(
        "reset_password",
        {"uidb64": urlsafe_base64_encode(force_bytes(user.pk)), "token": set_password_token.make_token(user)},
    )
    subject = "Reset your Vitalos portal password"
    doc = {
        "title": subject,
        "preheader": "Use the link within 30 minutes. It works once.",
        "headerLabel": "Client portal",
        "blocks": [
            {"type": "heading", "text": "Set a new password"},
            {
                "type": "text",
                "text": "Someone asked to reset the password for your Vitalos client portal account.",
            },
            {"type": "button", "label": "Set a new password", "url": link},
            system.link_fallback(link),
            {"type": "details", "rows": [{"label": "Link expires", "value": "30 minutes, works once"}]},
            {
                "type": "text",
                "tone": "muted",
                "text": "If this was not you, ignore this email. Your password has not changed.",
            },
        ],
        "footer": system.footer(),
    }
    system.send(
        doc,
        kind="portal.password-reset",
        subject=subject,
        to=[user.email],
        from_email=f"Vitalos <{settings.NOTIFY_FROM}>",
    )
    return True
