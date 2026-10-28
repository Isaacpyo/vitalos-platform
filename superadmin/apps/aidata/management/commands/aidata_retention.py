from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.aidata import services
from apps.aidata.models import Opportunity, Stage
from apps.enquiries.management.commands.enforce_enquiry_retention import months_before

RETENTION_MONTHS = 24


class Command(BaseCommand):
    help = (
        "AI & Data retention: anonymise the contact details and internal notes of opportunities closed "
        f"(won, lost or on hold) more than {RETENTION_MONTHS} months ago. A dry run unless --apply is given."
    )

    def add_arguments(self, parser):
        parser.add_argument("--apply", action="store_true", help="Anonymise (otherwise only list).")

    def handle(self, *args, apply=False, **options):
        cutoff = months_before(timezone.now(), RETENTION_MONTHS)
        due = list(
            Opportunity.objects.filter(
                stage__in=(Stage.WON, Stage.LOST, Stage.ON_HOLD),
                closed_at__lt=cutoff,
                anonymised_at__isnull=True,
            ).order_by("number")
        )
        prefix = "" if apply else "Dry run: would "
        self.stdout.write(
            f"{prefix}anonymise {len(due)} opportunity(ies) closed before {cutoff:%Y-%m-%d} "
            f"({RETENTION_MONTHS} months)."
        )
        for opportunity in due:
            self.stdout.write(f"  {opportunity.ref}")
        if not apply:
            self.stdout.write("Nothing changed. Run with --apply to anonymise.")
            return
        for opportunity in due:
            services.anonymise_opportunity(opportunity)
        self.stdout.write(self.style.SUCCESS(f"Anonymised {len(due)} opportunity(ies)."))
