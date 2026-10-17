from django.core.management.base import BaseCommand

from apps.enquiries.domain import check_sending_domain


class Command(BaseCommand):
    help = "Ask Resend whether the sending domain is verified and record it for System health."

    def handle(self, *args, **options):
        self.stdout.write(check_sending_domain())
