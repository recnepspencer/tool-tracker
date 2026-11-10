import django.db.models.deletion
from django.db import migrations, models

import companies.constraints


class Migration(migrations.Migration):
    dependencies = [
        ("equipment", "0008_remove_asset_tag_and_currency"),
    ]

    operations = [
        migrations.AddField(
            model_name="reconciliationcase",
            name="duplicate_of",
            field=models.ForeignKey(
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="reconciliation_duplicates",
                to="equipment.toolasset",
            ),
        ),
        migrations.AddField(
            model_name="reconciliationcase",
            name="outcome",
            field=models.CharField(blank=True, default="", max_length=24),
        ),
        migrations.AlterField(
            model_name="reconciliationcase",
            name="narrative",
            field=models.TextField(blank=True),
        ),
        migrations.AddConstraint(
            model_name="reconciliationcase",
            constraint=companies.constraints.ScopedForeignKey(
                field="duplicate_of", name="reconciliation_duplicate_company", scope=("company",)
            ),
        ),
        migrations.AddConstraint(
            model_name="reconciliationcase",
            constraint=models.CheckConstraint(
                condition=models.Q(duplicate_of__isnull=True)
                | (models.Q(kind="duplicate_asset") & ~models.Q(duplicate_of=models.F("asset"))),
                name="reconciliation_duplicate_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="reconciliationcase",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    outcome__in=[
                        "",
                        "merge",
                        "not_duplicate",
                        "found",
                        "write_off",
                        "move_custody",
                        "records_correct",
                    ]
                ),
                name="reconciliation_outcome_valid",
            ),
        ),
    ]
