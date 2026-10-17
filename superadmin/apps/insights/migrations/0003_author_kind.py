from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("insights", "0002_post_source_path"),
    ]

    operations = [
        migrations.AddField(
            model_name="author",
            name="kind",
            field=models.CharField(
                choices=[("person", "Person"), ("organisation", "Organisation")],
                default="person",
                max_length=12,
            ),
        ),
    ]
