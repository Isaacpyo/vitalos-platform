from datetime import timedelta

from django.conf import settings
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.enquiries import services
from apps.enquiries.models import Enquiry, InboxSettings


def months_before(moment, months: int):
    """The same day of the month ``months`` earlier, clamped to that month's last day."""
    year, month = divmod(moment.year * 12 + moment.month - 1 - months, 12)
    day = moment.day
    while True:
        try:
            return moment.replace(year=year, month=month + 1, day=day)
        except ValueError:
            day -= 1


class Command(BaseCommand):
    help = (
        "Apply the enquiry retention policy: anonymise enquiries resolved more than retention_months "
        "ago and delete spam older than spam_retention_days. A dry run unless RETENTION_ENFORCE=true."
    )

    def handle(self, *args, **options):
        inbox = InboxSettings.load()
        now = timezone.now()
        resolved_before = months_before(now, inbox.retention_months)
        spam_before = now - timedelta(days=inbox.spam_retention_days)
        to_anonymise = list(
            Enquiry.objects.filter(
                status=Enquiry.Status.RESOLVED, resolved_at__lt=resolved_before, anonymised_at__isnull=True
            ).order_by("number")
        )
        to_delete = list(
            Enquiry.objects.filter(status=Enquiry.Status.SPAM, created_at__lt=spam_before).order_by("number")
        )
        enforce = settings.RETENTION_ENFORCE
        prefix = "" if enforce else "Dry run: would "
        self.stdout.write(
            f"{prefix}anonymise {len(to_anonymise)} enquiry(ies) resolved before "
            f"{resolved_before:%Y-%m-%d} ({inbox.retention_months} months)."
        )
        for enquiry in to_anonymise:
            self.stdout.write(f"  {enquiry.ref}")
        self.stdout.write(
            f"{prefix}delete {len(to_delete)} spam enquiry(ies) received before "
            f"{spam_before:%Y-%m-%d} ({inbox.spam_retention_days} days)."
        )
        for enquiry in to_delete:
            self.stdout.write(f"  {enquiry.ref}")
        if not enforce:
            self.stdout.write("Nothing changed. Set RETENTION_ENFORCE=true to apply the policy.")
            return
        for enquiry in to_anonymise:
            services.anonymise_enquiry(enquiry)
        for enquiry in to_delete:
            services.delete_spam_enquiry(enquiry)
        self.stdout.write(
            self.style.SUCCESS(f"Anonymised {len(to_anonymise)} and deleted {len(to_delete)} enquiry(ies).")
        )
