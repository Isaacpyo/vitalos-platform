from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError

from apps.billing import services, stripe_client


class Command(BaseCommand):
    help = "Record completed Stripe Checkout Sessions that name a Vitalos invoice (idempotent)."

    def add_arguments(self, parser):
        parser.add_argument("--days", type=int, default=14, help="How far back to look (1 to 90 days).")

    def handle(self, *args, days, **options):
        if not 1 <= days <= 90:
            raise CommandError("--days must be between 1 and 90.")
        try:
            result = services.sync_from_stripe(lookback=timedelta(days=days))
        except stripe_client.StripeNotConfigured as exc:
            raise CommandError("Stripe is not configured (BILLING_STRIPE_SECRET_KEY is empty).") from exc
        except stripe_client.StripeError as exc:
            raise CommandError(f"Sync failed: {exc}") from exc
        self.stdout.write(
            f"Checked {result.seen} Vitalos checkout sessions in {result.pages} page(s); "
            f"recorded {result.recorded} new payment(s)."
        )
