from django.core.management.base import BaseCommand
from django.db import transaction

from apps.accounts.services import ensure_roles
from apps.architecture.models import Company, ServiceLine
from apps.architecture.seed import COMPANY, SERVICE_LINES


class Command(BaseCommand):
    help = "Idempotently load the Vitalos company profile, roles and six service lines."

    @transaction.atomic
    def handle(self, *args, **options):
        ensure_roles()
        company = Company.load()
        if company is None:
            company = Company(**COMPANY)
            company.full_clean()
            company._change_reason = "Seeded"
            company.save()
            self.stdout.write("Created company profile.")
        created = 0
        for order, data in enumerate(SERVICE_LINES, start=1):
            if ServiceLine.objects.filter(slug=data["slug"]).exists():
                continue
            line = ServiceLine(order=order, **data)
            line.full_clean()
            line._change_reason = "Seeded"
            line.save()
            created += 1
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed complete: {created} service line(s) created, {ServiceLine.objects.count()} in total."
            )
        )
