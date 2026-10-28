from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.aidata import services
from apps.aidata.models import BriefAssistEvent, Draft, Opportunity, Stage
from apps.enquiries.management.commands.enforce_enquiry_retention import months_before

RETENTION_MONTHS = 24
#: A pasted-enquiry preview that was never turned into an opportunity holds the pasted text: keep it 30 days.
ABANDONED_PREVIEW_DAYS = 30
#: Website brief-assist events hold hashes and counts only; 90 days is enough to see usage and abuse.
BRIEF_ASSIST_EVENT_DAYS = 90


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
        from datetime import timedelta

        preview_cutoff = timezone.now() - timedelta(days=ABANDONED_PREVIEW_DAYS)
        previews = Draft.objects.filter(opportunity__isnull=True, created_at__lt=preview_cutoff)
        events = BriefAssistEvent.objects.filter(
            created_at__lt=timezone.now() - timedelta(days=BRIEF_ASSIST_EVENT_DAYS)
        )
        prefix = "" if apply else "Dry run: would "
        self.stdout.write(
            f"{prefix}delete {previews.count()} abandoned enquiry preview(s) older than {ABANDONED_PREVIEW_DAYS} days "
            f"and {events.count()} brief-assist event(s) older than {BRIEF_ASSIST_EVENT_DAYS} days."
        )
        self.stdout.write(
            f"{prefix}anonymise {len(due)} opportunity(ies) closed before {cutoff:%Y-%m-%d} "
            f"({RETENTION_MONTHS} months)."
        )
        for opportunity in due:
            self.stdout.write(f"  {opportunity.ref}")
        if not apply:
            self.stdout.write("Nothing changed. Run with --apply to anonymise.")
            return
        previews.delete()
        events.delete()
        for opportunity in due:
            services.anonymise_opportunity(opportunity)
        self.stdout.write(self.style.SUCCESS(f"Anonymised {len(due)} opportunity(ies)."))
