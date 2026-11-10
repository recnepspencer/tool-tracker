from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("equipment", "0006_asset_purchase_details"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="warehouse",
            name="warehouse_code_unique",
        ),
        migrations.RemoveField(
            model_name="warehouse",
            name="code",
        ),
    ]
