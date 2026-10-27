from django.db.models import F
from django.utils import timezone

from .models import Job, JobAssignment, JobParticipationRequest


def close_membership_participation(subject, actor, reason):
    """Company offboarding calls this inside its membership transaction; custody is independent."""
    ids = JobAssignment.objects.filter(membership=subject, ends_at__isnull=True).values_list(
        "job_id", flat=True
    )
    jobs = list(Job.objects.select_for_update().filter(pk__in=ids).order_by("id"))
    now = timezone.now()
    JobAssignment.objects.filter(membership=subject, ends_at__isnull=True).update(
        ends_at=now, ended_by=actor, end_reason=reason
    )
    JobParticipationRequest.objects.filter(membership=subject, status="pending").update(
        status="rejected",
        decided_at=now,
        decided_by=actor,
        decision_note=reason,
        revision=F("revision") + 1,
    )
    Job.objects.filter(pk__in=[job.pk for job in jobs]).update(revision=F("revision") + 1)
