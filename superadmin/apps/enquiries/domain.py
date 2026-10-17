"""Daily sending-domain check (finding E9): ask the mail provider whether the domain we send from is
verified, and keep the answer on ``InboxSettings`` for the System health page.

Run once a day by the content tick's daily step and by ``manage.py check_sending_domain``. With the
log transport (local, tests) nothing is asked and the status says so.
"""

import logging

from django.conf import settings
from django.utils import timezone

from .models import InboxSettings
from .providers import DomainCheckError, ResendOutbound

logger = logging.getLogger(__name__)

LABELS = {
    "verified": "Verified",
    "pending": "Verification pending",
    "not_started": "Verification not started",
    "failed": "Verification failed",
    "temporary_failure": "Temporary verification failure",
    "missing": "Not added to Resend",
}


def sending_domain() -> str:
    return settings.NOTIFY_FROM.rsplit("@", 1)[-1].lower()


def check_sending_domain(now=None, provider=None) -> str:
    """Record and return the domain status line, e.g. "vitalos.co.uk: Verified"."""
    now = now or timezone.now()
    domain = sending_domain()
    if settings.EMAIL_TRANSPORT != "resend" and provider is None:
        line = f"{domain}: not checked (log transport)"
    else:
        try:
            status = (provider or ResendOutbound()).domain_status(domain)
            line = f"{domain}: {LABELS.get(status, status.replace('_', ' ').capitalize())}"
        except DomainCheckError as exc:
            logger.warning("Sending-domain check failed", extra={"reason": str(exc)})
            line = f"{domain}: check failed, {exc}"
    InboxSettings.load()
    InboxSettings.objects.filter(pk=1).update(domain_status=line[:60], domain_checked_at=now)
    return line


def level(status_line: str) -> str:
    """Health level for a stored status line."""
    if not status_line:
        return "info"
    if status_line.endswith(": Verified"):
        return "ok"
    if "log transport" in status_line:
        return "info"
    return "warn"
