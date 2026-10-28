"""Retry queued and failed portal emails that are due and under the attempt cap. Safe to run often: a sent
delivery is never sent again, and failures never touch the actions that caused them."""

from django.core.management.base import BaseCommand

from apps.portal import notifications


class Command(BaseCommand):
    help = "Send or retry due portal emails (bounded attempts, no duplicates)."

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=100)

    def handle(self, *args, **options):
        result = notifications.send_pending(limit=options["limit"])
        self.stdout.write(f"attempted={result['attempted']} sent={result['sent']} failed={result['failed']}")
