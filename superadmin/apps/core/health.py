"""System health: the checks behind the page footer and the System health page.

Each check is cheap (a handful of indexed queries) and never raises: a failing dependency becomes a
"fail" result rather than a broken page. Status levels, worst first: fail, warn, ok, info. "info" is
neutral (a fact, not a problem) and never lowers the overall status.
"""

import logging
import time
from dataclasses import dataclass, field
from datetime import timedelta

from django.conf import settings
from django.db import connection
from django.utils import dateformat, timezone

logger = logging.getLogger(__name__)

RANK = {"fail": 0, "warn": 1, "ok": 2, "info": 3}
STALE_QUEUE = timedelta(minutes=10)


@dataclass
class Check:
    key: str
    label: str
    status: str
    summary: str
    details: list[tuple[str, str]] = field(default_factory=list)
    # A setup task: numbered steps shown under the check (exact variable names, no secret values).
    steps: list[str] = field(default_factory=list)


def _database() -> Check:
    started = time.monotonic()
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except Exception:  # noqa: BLE001 - any database error means unhealthy
        logger.exception("Health check: database unavailable")
        return Check("database", "Database", "fail", "Not reachable")
    elapsed = round((time.monotonic() - started) * 1000)
    return Check(
        "database",
        "Database",
        "warn" if elapsed > 500 else "ok",
        f"Responding ({elapsed} ms)",
        [("Engine", connection.vendor.capitalize()), ("Query time", f"{elapsed} ms")],
    )


def _inbound(inbox) -> Check:
    provider = {"resend": "Resend Inbound", "graph": "Microsoft Graph"}.get(
        settings.INBOUND_PROVIDER, "Cloudflare Email Worker"
    )
    details = [
        ("Mailbox", settings.SUPPORT_MAILBOX),
        ("Provider", provider),
        ("Last received", _when(inbox.last_inbound_at) or "No mail received yet"),
    ]
    if not settings.INBOUND_WEBHOOK_SECRET:
        return Check("inbound", "Inbound mail", "fail", "Webhook secret not set: mail is refused", details)
    error_is_current = inbox.last_inbound_error and (
        inbox.last_inbound_at is None
        or (inbox.last_inbound_error_at and inbox.last_inbound_error_at > inbox.last_inbound_at)
    )
    if inbox.last_inbound_error:
        details.append(("Last error", f"{inbox.last_inbound_error} ({_when(inbox.last_inbound_error_at)})"))
    if error_is_current:
        return Check("inbound", "Inbound mail", "warn", "The latest message was rejected", details)
    if inbox.last_inbound_at is None:
        return Check("inbound", "Inbound mail", "info", "Ready; no mail received yet", details)
    return Check("inbound", "Inbound mail", "ok", f"Last received {_when(inbox.last_inbound_at)}", details)


def _outbound(now) -> Check:
    from apps.enquiries.notifications import emails_sent_today

    limit = getattr(settings, "RESEND_DAILY_LIMIT", 100)
    try:
        sent = emails_sent_today(now)
    except Exception:  # noqa: BLE001
        logger.exception("Health check: could not count emails sent today")
        sent = None
    details = [
        ("Transport", "Resend" if settings.EMAIL_TRANSPORT == "resend" else "Log only (not sending)"),
        ("Replies from", settings.SUPPORT_FROM_HEADER),
        ("Notifications from", settings.NOTIFY_FROM_HEADER),
        ("Sent today", f"{sent} of {limit} (Resend daily allowance)" if sent is not None else "Unknown"),
    ]
    if settings.EMAIL_TRANSPORT != "resend":
        level = "warn" if settings.APP_ENVIRONMENT == "production" else "info"
        return Check("outbound", "Outbound email", level, "Log only: nothing is sent", details)
    if not settings.RESEND_API_KEY:
        return Check("outbound", "Outbound email", "fail", "Resend selected but no API key", details)
    if sent is not None and sent >= limit:
        return Check("outbound", "Outbound email", "fail", "Daily sending allowance used up", details)
    if sent is not None and sent >= limit * 0.8:
        return Check("outbound", "Outbound email", "warn", f"{sent} of {limit} daily emails used", details)
    return Check("outbound", "Outbound email", "ok", "Sending through Resend", details)


def _queue(now) -> Check:
    from apps.enquiries.models import NotificationPreference, OutboundNotification

    pending = OutboundNotification.objects.filter(sent_at__isnull=True)
    instant = pending.filter(mode=NotificationPreference.Mode.INSTANT)
    oldest = instant.order_by("created_at").values_list("created_at", flat=True).first()
    details = [
        ("Waiting (instant)", str(instant.count())),
        ("Waiting (daily digest)", str(pending.filter(mode=NotificationPreference.Mode.DIGEST).count())),
        ("Oldest waiting", _when(oldest) or "None"),
    ]
    if oldest and now - oldest > STALE_QUEUE:
        return Check("queue", "Notification emails", "warn", "Instant notifications are waiting", details)
    return Check("queue", "Notification emails", "ok", "Up to date", details)


STORAGE_STEPS = [
    "Create a private Cloudflare R2 bucket named vitalos-enquiry-attachments (npx wrangler r2 bucket create; "
    "check the R2 free tier first: a payment method needs the owner's approval).",
    "Create an R2 API token with Object Read & Write on that bucket only.",
    "Set the variables OBJECT_STORAGE_ENDPOINT (https://<account-id>.r2.cloudflarestorage.com), "
    "OBJECT_STORAGE_BUCKET=vitalos-enquiry-attachments and OBJECT_STORAGE_REGION=auto in the "
    "GitHub Production environment.",
    "Store the token as the secrets OBJECT_STORAGE_ACCESS_KEY_ID and OBJECT_STORAGE_SECRET_ACCESS_KEY "
    "(never in the repo), then run the Super Admin deploy.",
    "Full steps: superadmin/docs/email-setup.md, section 6 (private R2 bucket for attachments).",
]


def _storage() -> Check:
    if settings.ATTACHMENTS_STORAGE_ENABLED:
        return Check("storage", "Attachment storage", "ok", "Attachments are stored")
    return Check(
        "storage",
        "Attachment storage",
        "info",
        "Set-up task: attachments are listed, originals stay in the mailbox",
        steps=STORAGE_STEPS,
    )


DOMAIN_STALE = timedelta(days=2)


def _domain(inbox) -> Check:
    from apps.enquiries.domain import level, sending_domain

    status = inbox.domain_status or f"{sending_domain()}: not checked yet"
    details = [
        ("Sending domain", sending_domain()),
        ("Last checked", _when(inbox.domain_checked_at) or "Never"),
        ("Checked", "Daily, by the content tick (manage.py check_sending_domain)"),
    ]
    result = level(inbox.domain_status)
    stale = inbox.domain_checked_at is None or timezone.now() - inbox.domain_checked_at > DOMAIN_STALE
    if settings.EMAIL_TRANSPORT == "resend" and stale and inbox.domain_status:
        return Check("domain", "Sending domain", "warn", f"{status} (check is out of date)", details)
    return Check("domain", "Sending domain", result, status, details)


def _when(moment) -> str:
    if moment is None:
        return ""
    return dateformat.format(timezone.localtime(moment), "j M Y, H:i")


def checks() -> list[Check]:
    from apps.enquiries.models import InboxSettings

    now = timezone.now()
    database = _database()
    if database.status == "fail":
        return [database]
    inbox = InboxSettings.load()
    return [database, _inbound(inbox), _outbound(now), _queue(now), _storage(), _domain(inbox)]


def overall(results: list[Check]) -> dict:
    """The worst status and a one-line summary for the footer."""
    problems = [check for check in results if check.status in ("fail", "warn")]
    worst = min((check.status for check in results), key=RANK.__getitem__, default="ok")
    worst = "ok" if worst == "info" else worst
    if not problems:
        summary = "All systems normal"
    elif len(problems) == 1:
        summary = f"{problems[0].label}: {problems[0].summary}"
    else:
        summary = f"{len(problems)} issues need a look"
    return {"status": worst, "summary": summary, "problems": problems}
