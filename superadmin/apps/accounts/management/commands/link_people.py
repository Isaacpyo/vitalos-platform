from django.core.management.base import BaseCommand

from apps.accounts.people import link_people


class Command(BaseCommand):
    help = (
        "Link team members (by email, case-insensitive) and Insights person authors (by exact name) "
        "to their user account. A dry run unless --apply; existing links are never changed."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Write the links (default: dry run).")

    def handle(self, *args, apply, **options):
        report = link_people(apply=apply)
        for line in report.lines():
            self.stdout.write(line)
        verb = "Linked" if apply else "Would link"
        self.stdout.write(
            self.style.SUCCESS(
                f"{verb} {len(report.team_linked)} team member(s) and {len(report.authors_linked)} author(s); "
                f"{len(report.unmatched_team)} member(s) and {len(report.unmatched_authors)} author(s) "
                f"unmatched; {len(report.conflicts)} conflict(s)."
                + ("" if apply else " Dry run: nothing was written. Re-run with --apply.")
            )
        )
