"""Run the content tick once, or every 60 seconds with --loop (local development and E2E)."""

import time

from django.core.management.base import BaseCommand

from apps.content_sync import tick


class Command(BaseCommand):
    help = "Promote due scheduled posts, close expired roles and deliver pending sync events."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="Run every --interval seconds until stopped.")
        parser.add_argument("--interval", type=int, default=60)

    def handle(self, *args, loop=False, interval=60, **options):
        while True:
            result = tick.run()
            self.stdout.write(
                f"promoted={result['promoted']} closed={result['closed']} "
                f"delivered={result['delivered']} next_due_at={result['nextDueAt'] or '-'}"
            )
            if not loop:
                return
            time.sleep(max(5, interval))
