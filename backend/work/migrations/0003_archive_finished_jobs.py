from django.db import migrations
from django.utils import timezone


def archive_finished_jobs(apps, schema_editor):
    """Archiving becomes a job's only lifecycle, so a completed or cancelled job is archived."""
    Job = apps.get_model("work", "Job")
    JobAssignment = apps.get_model("work", "JobAssignment")
    JobParticipationRequest = apps.get_model("work", "JobParticipationRequest")
    now = timezone.now()
    finished = Job.objects.filter(archived_at__isnull=True, status__in=["completed", "cancelled"])
    JobAssignment.objects.filter(job__in=finished, ends_at__isnull=True).update(
        ends_at=now, end_reason="Job archived"
    )
    JobParticipationRequest.objects.filter(job__in=finished, status="pending").update(
        status="rejected", decided_at=now, decision_note="Job archived"
    )
    finished.update(archived_at=now)


class Migration(migrations.Migration):
    dependencies = [
        ("work", "0002_jobparticipationrequest_decision_note"),
    ]

    operations = [migrations.RunPython(archive_finished_jobs, migrations.RunPython.noop)]
