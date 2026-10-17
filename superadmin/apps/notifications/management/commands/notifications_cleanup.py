from django.core.management.base import BaseCommand, CommandError

from apps.audit.services import record
from apps.notifications import cleanup


class Command(BaseCommand):
    help = (
        "Housekeeping for notifications. --purge-smoke-test counts (and with --apply deletes) the "
        "notifications and archived records named 'Smoke test …' that e2e/smoke.py created."
    )

    def add_arguments(self, parser):
        parser.add_argument("--purge-smoke-test", action="store_true", help="Find smoke-test leftovers.")
        parser.add_argument("--apply", action="store_true", help="Delete them (default: dry run).")

    def handle(self, *args, purge_smoke_test: bool, apply: bool, **options):
        if not purge_smoke_test:
            raise CommandError("Nothing to do: pass --purge-smoke-test.")
        report = cleanup.purge_smoke_test(apply=apply)
        for label, count in report.counts.items():
            self.stdout.write(f"{label}: {count}")
        if apply:
            record("notifications.smoke_purged", summary=f"Removed {report.total} smoke-test row(s)", **report.counts)
            self.stdout.write(self.style.SUCCESS(f"Deleted {report.total} smoke-test row(s)."))
        else:
            self.stdout.write(f"Dry run: would delete {report.total} row(s). Re-run with --apply to delete.")

