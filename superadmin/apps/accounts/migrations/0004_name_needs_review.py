"""Every user gets a display name (ADR-049).

Additive only: a new boolean, then a back-fill of empty names from the email local part
(``temitope.agbola@...`` becomes "Temitope Agbola"), flagged for the person to confirm.
"""

from django.db import migrations, models


def name_from_email(email: str) -> str:
    # Frozen copy of apps.accounts.models.name_from_email: migrations never import app code.
    local = (email or "").split("@")[0]
    for separator in "._-+":
        local = local.replace(separator, " ")
    return " ".join(word.capitalize() for word in local.split())[:150]


def backfill(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.filter(full_name__exact="").only("pk", "email"):
        user.full_name = name_from_email(user.email)
        user.name_needs_review = True
        user.save(update_fields=["full_name", "name_needs_review"])


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0003_primary_owner"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="name_needs_review",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
