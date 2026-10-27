from django.core.management.base import BaseCommand

from apps.email_templates.review import label_consistency, review_problems
from apps.email_templates.services import load_seed, seed_problems


class Command(BaseCommand):
    help = (
        "Check the seed templates: seed_problems (errors that stop loading) and the review rules "
        "(docs/email/REVIEW.md). Exits non-zero only on seed problems, or on review findings with --strict."
    )

    def add_arguments(self, parser):
        parser.add_argument("--category", action="append", help="Only these categories (repeatable).")
        parser.add_argument("--strict", action="store_true", help="Fail on review findings too.")

    def handle(self, *args, **options):
        items = load_seed()
        errors = seed_problems(items)
        if options["category"]:
            items = [item for item in items if item.get("category") in options["category"]]
        findings = {item["key"]: review_problems(item) for item in items}
        flagged = {key: found for key, found in findings.items() if found}
        for error in errors:
            self.stdout.write(f"ERROR {error}")
        for key, found in flagged.items():
            for problem in found:
                self.stdout.write(f"{key}: {problem}")
        for line in label_consistency(items):
            self.stdout.write(f"labels differ in {line}")
        self.stdout.write(
            f"{len(items)} templates, {len(errors)} seed problems, "
            f"{sum(len(f) for f in flagged.values())} review findings in {len(flagged)} templates."
        )
        if errors or (options["strict"] and flagged):
            raise SystemExit(1)
