from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):
    dependencies = [
        ("equipment", "0007_remove_warehouse_code"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="toolasset", name="asset_tag_unique"),
        migrations.RemoveConstraint(model_name="toolasset", name="asset_acquisition_money_valid"),
        migrations.RemoveField(model_name="toolasset", name="asset_tag"),
        migrations.RemoveField(model_name="toolasset", name="acquisition_currency"),
        migrations.AddConstraint(
            model_name="toolasset",
            constraint=models.CheckConstraint(
                condition=Q(acquisition_cost__isnull=True) | Q(acquisition_cost__gte=0),
                name="asset_acquisition_cost_valid",
            ),
        ),
    ]
