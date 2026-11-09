from backend_platform.api import conflict
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import Company
from companies.revisions import expect_revision

from .models import Job, JobAssignment, JobParticipationRequest
from .participation import lock_job


@transaction.atomic
def create_job(identity, company_id, data):
    authorize_write(identity, company_id, "jobs.manage")
    Company.objects.select_for_update().get(pk=company_id)
    if Job.objects.filter(company_id=company_id, number=data.number).exists():
        raise conflict("Job number already exists.", code="job_number_exists")
    result = Job.objects.create(company_id=company_id, number=data.number, name=data.name)
    record_company_event(identity, company_id, "work.job.created", result)
    return result


@transaction.atomic
def update_job(identity, company_id, job_id, data):
    actor = authorize_write(identity, company_id, "jobs.manage")
    job = lock_job(company_id, job_id)
    expect_revision(job, data.expected_revision)
    if (
        data.number != job.number
        and Job.objects.filter(company_id=company_id, number=data.number).exists()
    ):
        raise conflict("Job number already exists.", code="job_number_exists")
    job.number = data.number
    job.name = data.name
    archiving = data.archived and job.archived_at is None
    job.archived_at = (job.archived_at or timezone.now()) if data.archived else None
    # Archiving a job takes everyone off it and turns down what is still waiting.
    if archiving:
        now = timezone.now()
        JobAssignment.objects.filter(job=job, ends_at__isnull=True).update(
            ends_at=now, ended_by=actor, end_reason="Job archived"
        )
        JobParticipationRequest.objects.filter(job=job, status="pending").update(
            status="rejected",
            decided_at=now,
            decided_by=actor,
            decision_note="Job archived",
            revision=F("revision") + 1,
        )
    job.revision += 1
    job.save()
    record_company_event(
        identity,
        company_id,
        "work.job.updated",
        job,
        metadata={"archived": data.archived},
    )
    return job
