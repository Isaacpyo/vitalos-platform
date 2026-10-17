from django.db import migrations, models

# copy.ORGANISATION_EDITORIAL_NOTE as of this migration (kept inline so later copy edits don't change it).
NOTE = (
    "Vitalos Insights are written and reviewed by the Vitalos team, who are accountable for their accuracy "
    "and judgement. Claims, citations and figures are checked before anything is published."
)


def seed_note(apps, schema_editor):
    """Fill the new note on the existing settings row, only where it is empty."""
    SiteSettings = apps.get_model("content_sync", "SiteSettings")
    SiteSettings.objects.filter(insights_organisation_editorial_note="").update(
        insights_organisation_editorial_note=NOTE
    )


class Migration(migrations.Migration):

    dependencies = [
        ("content_sync", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="sitesettings",
            name="insights_organisation_editorial_note",
            field=models.CharField(blank=True, max_length=1000),
        ),
        migrations.RunPython(seed_note, migrations.RunPython.noop),
    ]
