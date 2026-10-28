"""Seed the billing settings with Vitalos's public company details (packages/cms/src/repo/legal.ts).

Not VAT registered and no bank details: both are set by a person in Billing › Settings, never invented.
Idempotent; an existing row is never overwritten.
"""

from django.db import migrations

DEFAULTS = {
    "legal_name": "Vitalos Technologies Limited",
    "company_number": "16696895",
    "registered_address": "114 High Street\nBentley\nDoncaster\nEngland\nDN5 0AT",
    "contact_email": "support@vitalos.co.uk",
    "website": "vitalos.co.uk",
    "vat_registered": False,
    "vat_number": "",
    "payment_terms_days": 14,
    "invoice_prefix": "INV",
    "bank_details": "",
    "footer_note": "Questions about this invoice? Email support@vitalos.co.uk and quote the invoice number.",
}


def seed(apps, schema_editor):
    BillingSettings = apps.get_model("billing", "BillingSettings")
    BillingSettings.objects.get_or_create(pk=1, defaults=DEFAULTS)


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]

    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
