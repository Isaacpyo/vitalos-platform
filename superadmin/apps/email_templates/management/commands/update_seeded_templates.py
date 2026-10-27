from django.core.management.base import BaseCommand

from apps.email_templates.services import update_seeded_templates


class Command(BaseCommand):
    help = (
        "Update seeded email templates nobody has edited in the admin to the repository's seed content "
        "(a new version each), and create missing ones. Edited templates are skipped and listed."
    )

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Report what would change; write nothing.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        result = update_seeded_templates(dry_run=dry_run)
        prefix = "Dry run: would " if dry_run else ""
        self.stdout.write(
            f"Email templates: {prefix}update {len(result.updated)}, {prefix}create {result.created}, "
            f"{result.unchanged} unchanged, {len(result.skipped)} skipped (edited in the admin)."
        )
        for key in result.skipped:
            self.stdout.write(f"  skipped: {key}")
