"""Seed the blueprint's proposed offer prices (AID-006) and the budget ceilings (AID-013).

Every price is "proposed": a commercial assumption, not a validated market rate, and not published.
No cost entries are seeded: known spend is £0. Idempotent; existing rows are never overwritten.
"""

from decimal import Decimal

from django.db import migrations

PRICES = (
    ("ai-opportunity-assessment", "AI Opportunity Assessment", Decimal("350"), "fixed"),
    ("ai-proof-of-value", "AI Proof of Value", Decimal("1500"), "from"),
    ("production-ai-engineering", "Production AI Engineering", Decimal("3000"), "from"),
    ("managed-ai-operations", "Managed AI Operations", Decimal("250"), "per_month"),
)
NOTE = "Blueprint v1.0 proposed price. Not validated with customers; not published on the website."


def seed(apps, schema_editor):
    OfferPrice = apps.get_model("aidata", "OfferPrice")
    BudgetSettings = apps.get_model("aidata", "BudgetSettings")
    for key, name, price, basis in PRICES:
        OfferPrice.objects.get_or_create(
            key=key, defaults={"name": name, "price": price, "basis": basis, "status": "proposed", "notes": NOTE}
        )
    BudgetSettings.objects.get_or_create(pk=1)


class Migration(migrations.Migration):
    dependencies = [("aidata", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
