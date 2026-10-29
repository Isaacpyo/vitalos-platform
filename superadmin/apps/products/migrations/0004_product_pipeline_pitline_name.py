from django.db import migrations

# Autofix is now Pitline. The codename stays; only the name shown in the admin changes. Django creates
# missing permissions after migrate but never renames existing ones, so the row is updated here.
CODENAME = "open_autofix_superadmin"
OLD_NAME = "Can see Autofix details and open the Autofix Superadmin"
NEW_NAME = "Can see Pitline details and open the Pitline Superadmin"


def rename(name):
    def run(apps, schema_editor):
        Permission = apps.get_model("auth", "Permission")
        Permission.objects.filter(content_type__app_label="products", codename=CODENAME).update(name=name)

    return run


class Migration(migrations.Migration):

    dependencies = [
        ("products", "0003_product_pipeline_autofix"),
        ("auth", "0012_alter_user_first_name_max_length"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="productaccess",
            options={
                "default_permissions": (),
                "managed": False,
                "permissions": [
                    ("view_product_pipeline", "Can view the Product Pipeline"),
                    (
                        "open_askbridge_superadmin",
                        "Can see Askbridge details and open the Askbridge Superadmin",
                    ),
                    (
                        "open_answerd_superadmin",
                        "Can see Answerd details and open the Answerd Superadmin",
                    ),
                    (
                        "open_workforce_superadmin",
                        "Can see Vitalos Workforce details and open the Vitalos Workforce Superadmin",
                    ),
                    (
                        "open_tipsignal_superadmin",
                        "Can see TipSignal details and open the TipSignal Superadmin",
                    ),
                    (
                        "open_autofix_superadmin",
                        "Can see Pitline details and open the Pitline Superadmin",
                    ),
                ],
            },
        ),
        migrations.RunPython(rename(NEW_NAME), rename(OLD_NAME)),
    ]
