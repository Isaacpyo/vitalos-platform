from django.core.management.base import BaseCommand

from apps.enquiries import notifications, overdue


class Command(BaseCommand):
    help = (
        "Send due enquiry notification emails (coalesced instants) and, from 08:00 Europe/London, "
        "the daily digests, after flagging newly overdue enquiries. Safe to run every 5 minutes."
    )

    def handle(self, *args, **options):
        overdue.notify_overdue()
        instant = notifications.flush()
        digests = notifications.send_digests()
        self.stdout.write(f"Sent {instant} notification email(s) and {digests} digest(s).")
