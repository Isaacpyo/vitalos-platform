# Adds EmailTemplate.seed_hash and back-fills it from each seeded template's "Seeded from the
# repository" version snapshot (email audit, October 2026). Self-contained: the hash is the same as
# models.content_hash, copied here so later model changes cannot alter this migration.

import hashlib
import json

from django.db import migrations, models

SEEDED_NOTE = "Seeded from the repository"
CONTENT_FIELDS = (
    "name",
    "category",
    "kind",
    "description",
    "header_label",
    "subject",
    "preheader",
    "reason",
    "footer_notice",
    "blocks",
)


def _hash(content: dict) -> str:
    canonical = {name: content.get(name) if content.get(name) is not None else "" for name in CONTENT_FIELDS}
    if canonical["blocks"] == "":
        canonical["blocks"] = []
    raw = json.dumps(canonical, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def backfill(apps, schema_editor):
    EmailTemplate = apps.get_model("email_templates", "EmailTemplate")
    EmailTemplateVersion = apps.get_model("email_templates", "EmailTemplateVersion")
    for template in EmailTemplate.objects.filter(seeded=True, seed_hash=""):
        snapshot = (
            EmailTemplateVersion.objects.filter(template=template, note=SEEDED_NOTE).order_by("number").first()
        )
        if snapshot is not None:
            template.seed_hash = _hash(snapshot.content)
            template.save(update_fields=["seed_hash"])


class Migration(migrations.Migration):
    dependencies = [
        ("email_templates", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="emailtemplate",
            name="seed_hash",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
