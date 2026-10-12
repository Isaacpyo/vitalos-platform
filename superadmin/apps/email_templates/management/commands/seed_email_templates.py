from django.core.management.base import BaseCommand

from apps.email_templates.services import seed_library


class Command(BaseCommand):
    help = "Create the seed email templates that do not exist yet (as Draft). Never changes existing ones."

    def handle(self, *args, **options):
        created = seed_library()
        self.stdout.write(f"Email templates: {created} created.")
