"""Fill the owner-published company facts and social profiles on the existing Company row.

Only blank fields are written, so values edited in Settings are never overwritten. New installs get
the same values from ``seed_architecture``.
"""

from django.db import migrations

FACTS = {
    "legal_name": "Vitalos Technologies Limited",
    "company_number": "16696895",
    "registered_office": "114 High Street, Bentley, Doncaster, England, DN5 0AT",
    "website": "https://vitalos.co.uk",
    "support_email": "support@vitalos.co.uk",
    "linkedin_url": "https://www.linkedin.com/company/vitalos",
    "x_url": "https://x.com/vitalos",
    "instagram_url": "https://www.instagram.com/vitalos",
    "facebook_url": "https://www.facebook.com/vitalos",
}


def fill_blank_facts(apps, schema_editor):
    Company = apps.get_model("architecture", "Company")
    company = Company.objects.filter(pk=1).first()
    if company is None:
        return
    changed = [name for name, value in FACTS.items() if not getattr(company, name)]
    for name in changed:
        setattr(company, name, FACTS[name])
    if changed:
        company.save(update_fields=changed)


class Migration(migrations.Migration):
    dependencies = [("architecture", "0002_company_email_facts")]

    operations = [migrations.RunPython(fill_blank_facts, migrations.RunPython.noop)]
