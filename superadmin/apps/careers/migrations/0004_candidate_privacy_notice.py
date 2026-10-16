"""Point the careers settings at the published candidate privacy notice (owner approval, 16 Oct 2026).

The notice is the website's /legal/candidate-privacy page, version 2026-10-careers. Only empty values
are filled, so a URL or version an admin has already set is never overwritten.
"""

from django.db import migrations

NOTICE_URL = "/legal/candidate-privacy"
NOTICE_VERSION = "2026-10-careers"


def set_notice(apps, schema_editor):
    CareersSettings = apps.get_model("careers", "CareersSettings")
    row, _ = CareersSettings.objects.get_or_create(pk=1)
    config = dict(row.config or {})
    changed = False
    if not config.get("privacy_notice_url"):
        config["privacy_notice_url"] = NOTICE_URL
        changed = True
    if not config.get("privacy_notice_version"):
        config["privacy_notice_version"] = NOTICE_VERSION
        changed = True
    if changed:
        row.config = config
        row.save(update_fields=["config"])


class Migration(migrations.Migration):
    dependencies = [("careers", "0003_intake_ip_caps")]

    operations = [migrations.RunPython(set_notice, migrations.RunPython.noop)]
