from django.core.management.base import BaseCommand

from apps.architecture import web_sync


class Command(BaseCommand):
    help = (
        "Create or update Practices, Solutions and Offers from the website's content "
        "(apps/architecture/data/web-architecture.json, exported by tooling/content/export-architecture.ts). "
        "A dry run unless --apply. Never archives or deletes."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the changes (default: dry run).")

    def handle(self, *args, apply, **options):
        report = web_sync.sync(apply=apply)
        for line in report.lines():
            self.stdout.write(line)
        verb = "Made" if apply else "Would make"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {len(report.created)} new and {len(report.updated)} updated record(s); "
                f"{len(report.unchanged)} unchanged, {len(report.skipped)} skipped, "
                f"{len(report.not_on_website)} in the admin only."
                + ("" if apply else " Dry run: nothing was written. Re-run with --apply.")
            )
        )
