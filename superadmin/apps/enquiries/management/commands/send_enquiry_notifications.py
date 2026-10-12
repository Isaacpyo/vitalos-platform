from django.core.management.base import BaseCommand

from apps.enquiries import notifications


class Command(BaseCommand):
    help = (
        "Send due enquiry notification emails (coalesced instants) and, from 08:00 Europe/London, "
        "the daily digests. Safe to run every 5 minutes as a scheduled job."
    )

    def handle(self, *args, **options):
        instant = notifications.flush()
        digests = notifications.send_digests()
        self.stdout.write(f"Sent {instant} notification email(s) and {digests} digest(s).")
