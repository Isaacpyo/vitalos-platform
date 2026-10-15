"""Read rules for Relay: who may use it, who hears about what, unread counts and the alert log."""

from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone

from apps.accounts.roles import SERVICE_LEAD, SUPERADMIN, has_role, is_superadmin

from .client import is_configured, user_id_from_admin_id
from .models import EMAIL, IN_APP, RelayAlertLog, RelayNotification

NOTIFICATION_LIMIT = 20


def can_access(user) -> bool:
    """Relay conversations hold personal data: SuperAdmin and ServiceLead only, like Enquiries."""
    return has_role(user, SUPERADMIN, SERVICE_LEAD)


def can_manage(user) -> bool:
    """Settings and knowledge publish, archive, re-index and FAQ sync: SuperAdmin only."""
    return is_superadmin(user)


def nav_visible(user) -> bool:
    """The Relay tab shows only when Relay is configured and the user may use it."""
    return is_configured() and can_access(user)


def relay_users():
    """Active users who may use Relay (SuperAdmin, ServiceLead or a Django superuser)."""
    User = get_user_model()
    return (
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name__in=(SUPERADMIN, SERVICE_LEAD)))
        .distinct()
        .order_by("full_name", "email")
    )


def superadmins():
    User = get_user_model()
    return (
        User.objects.filter(is_active=True)
        .filter(Q(is_superuser=True) | Q(groups__name=SUPERADMIN))
        .distinct()
        .order_by("email")
    )


def user_for_admin_id(admin_id: str | None):
    """The active Relay user behind ``"sa:<pk>"``, or None."""
    pk = user_id_from_admin_id(admin_id)
    if pk is None:
        return None
    return relay_users().filter(pk=pk).first()


def unread_count(user) -> int:
    return RelayNotification.objects.filter(recipient=user, read_at__isnull=True).count()


def recent_notifications(user, limit: int = NOTIFICATION_LIMIT):
    return RelayNotification.objects.filter(recipient=user)[:limit]


def latest_notification_id(user) -> int:
    latest = RelayNotification.objects.filter(recipient=user).order_by("-id").values_list("id", flat=True)
    return latest.first() or 0


def pulse_items(user, since: int, window_minutes: int = 10, limit: int = 5):
    """Unread notifications newer than ``since`` and at most ``window_minutes`` old, oldest first."""
    cutoff = timezone.now() - timedelta(minutes=window_minutes)
    queryset = RelayNotification.objects.filter(
        recipient=user, read_at__isnull=True, id__gt=since, created_at__gte=cutoff
    ).order_by("id")
    return list(queryset[:limit])


def alert_summary(conversation_id) -> dict:
    """What the ALERTS section says: in-app recipients and time, and the latest email time."""
    logs = RelayAlertLog.objects.filter(conversation_id=conversation_id)
    in_app = list(logs.filter(channel=IN_APP).order_by("sent_at").values_list("recipient_id", "sent_at"))
    first_in_app = in_app[0][1] if in_app else None
    in_app_recipients = (
        len({pk for pk, sent in in_app if first_in_app and sent - first_in_app < timedelta(minutes=1)})
        if in_app
        else 0
    )
    email = logs.filter(channel=EMAIL).order_by("-sent_at").values_list("sent_at", flat=True).first()
    reminders = logs.filter(type="reminder").values("bucket").distinct().count()
    return {
        "in_app_at": first_in_app,
        "in_app_recipients": in_app_recipients,
        "email_at": email,
        "reminders": reminders,
    }
