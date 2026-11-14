from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0005_remove_job_number"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="jobassignment", name="assignment_responsibility_valid"
        ),
        migrations.RemoveField(model_name="jobassignment", name="responsibility"),
    ]
