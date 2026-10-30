from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.portal import retention


class Command(BaseCommand):
    help = (
        "Apply the client portal delivery retention policy (ADR-056): delete sent delivery records after "
        "PORTAL_DELIVERY_SENT_RETENTION_DAYS, failed or cancelled ones after PORTAL_DELIVERY_FAILED_RETENTION_DAYS "
        "and turned-off push devices after PORTAL_PUSH_DISABLED_RETENTION_DAYS. A dry run unless "
        "RETENTION_ENFORCE=true. The content tick runs the same job once a day."
    )

    def handle(self, *args, **options):
        now = timezone.now()
        pol = retention.policy()
        cut = pol.cutoffs(now)
        found = retention.counts(now, pol)
        prefix = "" if pol.enforce else "Dry run: would "
        windows = {
            "email_sent": f"sent before {cut['sent']:%Y-%m-%d} ({pol.sent_days} days)",
            "push_sent": f"sent before {cut['sent']:%Y-%m-%d} ({pol.sent_days} days)",
            "email_failed": f"queued before {cut['failed']:%Y-%m-%d} ({pol.failed_days} days)",
            "push_failed": f"queued before {cut['failed']:%Y-%m-%d} ({pol.failed_days} days)",
            "devices": f"turned off before {cut['devices']:%Y-%m-%d} ({pol.device_days} days) with no records left",
        }
        for name, label in retention.CATEGORIES.items():
            self.stdout.write(f"{prefix}delete {found[name]} {label} {windows[name]}.")
        self.stdout.write(
            "Kept whatever their age: queued or retrying deliveries, active devices, notifications, audit."
        )
        if not pol.enforce:
            self.stdout.write("Nothing changed. Set RETENTION_ENFORCE=true to apply the policy.")
            return
        deleted = retention.run(now, enforce=True)
        self.stdout.write(self.style.SUCCESS(f"Deleted {deleted} record(s)."))
