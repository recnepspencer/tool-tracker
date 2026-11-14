from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0003_archive_finished_jobs"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="job", name="job_status_valid"),
        migrations.RemoveConstraint(model_name="job", name="job_project_company"),
        migrations.RemoveField(model_name="job", name="status"),
        migrations.RemoveField(model_name="job", name="project"),
        migrations.DeleteModel(name="Project"),
    ]
