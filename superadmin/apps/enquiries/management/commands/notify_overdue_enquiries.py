from django.core.management.base import BaseCommand

from apps.enquiries import overdue


class Command(BaseCommand):
    help = (
        "Tell the assignee (or every super admin, when unassigned) about enquiries that have just "
        "passed their first-response target, once per enquiry. --digest also queues every "
        "still-overdue enquiry into the 08:00 digest (once a day). The content tick runs both."
    )

    def add_arguments(self, parser):
        parser.add_argument("--digest", action="store_true", help="Also queue today's overdue digest.")

    def handle(self, *args, digest, **options):
        notified = overdue.notify_overdue()
        message = f"Notified {notified} newly overdue enquir{'y' if notified == 1 else 'ies'}."
        if digest:
            queued = overdue.queue_overdue_digest()
            message += f" Queued {queued} overdue digest item(s)."
        self.stdout.write(message)
