from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0004_jobs_without_projects"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="job", name="job_number_unique"),
        migrations.RemoveField(model_name="job", name="number"),
    ]
