"""Erasing an account that must stay as a tombstone.

Some rows keep their author with ``on_delete=PROTECT`` (a customer's messages, approvals, answers and change
requests in the client portal). When such an account is removed, the row cannot be deleted, so the account is
erased instead: its personal data is replaced, it can never sign in again, and everything it wrote shows the
author as "Former member" (ADR-056, "Member management"). The audit trail keeps its own ``actor_email``
snapshot, as for a deleted account.

The marker is the reserved ``.invalid`` domain (RFC 2606): no real address can ever match it.
"""

from __future__ import annotations

from django.db import models, transaction
from django_otp.plugins.otp_totp.models import TOTPDevice

from .models import ApiToken

ERASED_DOMAIN = "erased.invalid"
FORMER_MEMBER = "Former member"


def erased_email(pk: int) -> str:
    return f"former-member-{pk}@{ERASED_DOMAIN}"


def is_erased(user) -> bool:
    return bool(user is not None and (getattr(user, "email", "") or "").endswith("@" + ERASED_DOMAIN))


def erased_q() -> models.Q:
    return models.Q(email__endswith="@" + ERASED_DOMAIN)


@transaction.atomic
def erase_account(user) -> None:
    """Replace the account's personal data and close it for good. The row (and its primary key) stays."""
    from .lifecycle import end_sessions

    end_sessions(user)
    TOTPDevice.objects.filter(user=user).delete()
    ApiToken.objects.filter(user=user).delete()
    user.groups.clear()
    user.user_permissions.clear()
    user.email = erased_email(user.pk)
    user.full_name = FORMER_MEMBER
    user.set_unusable_password()
    user.is_active = False
    user.is_staff = False
    user.is_superuser = False
    user.last_login = None
    user.save()
