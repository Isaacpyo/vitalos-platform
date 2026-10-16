"""Seed the owner-approved equal-opportunities statement (16 Oct 2026) into the careers settings.

Shown on every role page (brief 6.2). Only an empty value is filled, so an edited statement is kept.
"""

from django.db import migrations

STATEMENT = (
    "Vitalos welcomes applications from everyone. We assess every application on the skills, "
    "experience and potential it shows for the role. We do not discriminate on the grounds of age, "
    "disability, gender reassignment, marriage and civil partnership, pregnancy and maternity, race, "
    "religion or belief, sex or sexual orientation, the protected characteristics under the "
    "Equality Act 2010.\n\n"
    "If you need an adjustment to apply or to take part in an interview, email "
    "support@vitalos.co.uk and tell us what would help. We will make reasonable adjustments."
)


def set_statement(apps, schema_editor):
    CareersSettings = apps.get_model("careers", "CareersSettings")
    row, _ = CareersSettings.objects.get_or_create(pk=1)
    config = dict(row.config or {})
    if not (config.get("equal_opportunities") or "").strip():
        config["equal_opportunities"] = STATEMENT
        row.config = config
        row.save(update_fields=["config"])


class Migration(migrations.Migration):
    dependencies = [("careers", "0004_candidate_privacy_notice")]

    operations = [migrations.RunPython(set_statement, migrations.RunPython.noop)]
