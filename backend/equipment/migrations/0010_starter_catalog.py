from django.db import migrations

from equipment.starter_catalog import add_starter_catalog


def seed_existing_companies(apps, schema_editor):
    """Give companies created before the starter catalog the same starting categories and models.

    Matched by name, so anything a company already has is left alone.
    """
    company_model = apps.get_model("companies", "Company")
    category_model = apps.get_model("equipment", "ToolCategory")
    tool_model = apps.get_model("equipment", "ToolModel")
    for company_id in company_model.objects.values_list("pk", flat=True):
        add_starter_catalog(company_id, category_model, tool_model)


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0005_three_roles"),
        ("equipment", "0009_reconciliation_outcomes"),
    ]

    operations = [
        migrations.RunPython(seed_existing_companies, migrations.RunPython.noop),
    ]
