"""Resend usage across every sender (enquiries, careers, Relay) and the 80 % warning (finding E9).

RESEND_DAILY_LIMIT is the free-tier allowance (100 emails a day). Each feature already counts its own
emails before sending; this module adds them up for System health and raises one in-app warning to
the super admins the first time a day's total reaches 80 % of the allowance.
"""

import logging

from django.conf import settings
from django.urls import reverse
from django.utils import timezone

logger = logging.getLogger(__name__)

WARNING_SHARE = 0.8
WARNING_KIND = "system_warning"
WARNING_TITLE = "Email allowance: "


def sent_today(now=None) -> int:
    from apps.careers.alerts import emails_sent_today as enquiry_and_careers
    from apps.enquiries.notifications import _start_of_day
    from apps.relay.models import RelayAlertLog

    now = now or timezone.now()
    relay = RelayAlertLog.objects.filter(channel="email", sent_at__gte=_start_of_day(now)).count()
    return enquiry_and_careers(now) + relay


def threshold() -> int:
    return int(settings.RESEND_DAILY_LIMIT * WARNING_SHARE)


def warn_if_near_limit(now=None) -> bool:
    """Notify every super admin once per day when today's emails reach 80 %. True when it notified."""
    from apps.architecture.services import superadmins
    from apps.enquiries.notifications import _start_of_day
    from apps.notifications.models import Notification
    from apps.notifications.services import notify

    now = now or timezone.now()
    limit = settings.RESEND_DAILY_LIMIT
    count = sent_today(now)
    if count < threshold():
        return False
    already = Notification.objects.filter(
        kind=WARNING_KIND, title__startswith=WARNING_TITLE, created_at__gte=_start_of_day(now)
    ).exists()
    if already:
        return False
    notify(
        superadmins(),
        WARNING_KIND,
        title=f"{WARNING_TITLE}{count} of {limit} emails used today",
        body="Above the limit, new notification emails wait for the next daily digest, and candidate "
        "emails are refused until tomorrow. Replies to customers still count towards it.",
        url=reverse("core:health"),
    )
    logger.warning("Email allowance warning raised", extra={"count": count, "limit": limit})
    return True
