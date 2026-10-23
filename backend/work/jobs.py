from backend_platform.api import conflict, not_found
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import Company
from companies.revisions import expect_revision

from .models import Job, JobAssignment, JobParticipationRequest, Project
from .participation import lock_job


@transaction.atomic
def create_project(identity, company_id, data):
    authorize_write(identity, company_id, "jobs.manage")
    Company.objects.select_for_update().get(pk=company_id)
    if Project.objects.filter(company_id=company_id, number=data.number).exists():
        raise conflict("Project number already exists.", code="project_number_exists")
    result = Project.objects.create(
        company_id=company_id, number=data.number, name=data.name, lifecycle=data.lifecycle
    )
    record_company_event(identity, company_id, "work.project.created", result)
    return result


@transaction.atomic
def update_project(identity, company_id, project_id, data):
    authorize_write(identity, company_id, "jobs.manage")
    result = (
        Project.objects.select_for_update().filter(pk=project_id, company_id=company_id).first()
    )
    if result is None:
        raise not_found("Project not found.")
    expect_revision(result, data.expected_revision)
    if (
        data.lifecycle in {"closed", "cancelled"}
        and Job.objects.filter(
            project=result, archived_at__isnull=True, status__in=["planned", "active", "on_hold"]
        ).exists()
    ):
        raise conflict("Close the project's active jobs first.", code="project_has_active_jobs")
    result.name = data.name
    result.lifecycle = data.lifecycle
    result.revision += 1
    result.save()
    record_company_event(identity, company_id, "work.project.updated", result)
    return result


@transaction.atomic
def create_job(identity, company_id, data):
    authorize_write(identity, company_id, "jobs.manage")
    Company.objects.select_for_update().get(pk=company_id)
    project = (
        Project.objects.select_for_update()
        .filter(pk=data.project_id, company_id=company_id, lifecycle__in=["prospective", "active"])
        .first()
    )
    if project is None:
        raise not_found("Open project not found.")
    if Job.objects.filter(company_id=company_id, number=data.number).exists():
        raise conflict("Job number already exists.", code="job_number_exists")
    result = Job.objects.create(
        company_id=company_id,
        project=project,
        number=data.number,
        name=data.name,
        status=data.status,
    )
    record_company_event(identity, company_id, "work.job.created", result)
    return result


@transaction.atomic
def update_job(identity, company_id, job_id, data):
    actor = authorize_write(identity, company_id, "jobs.manage")
    reference = Job.objects.filter(company_id=company_id, pk=job_id).first()
    if reference is None:
        raise not_found("Job not found.")
    project = Project.objects.select_for_update().get(pk=reference.project_id)
    if (
        not data.archived
        and data.status in {"planned", "active", "on_hold"}
        and project.lifecycle in {"closed", "cancelled"}
    ):
        raise conflict("Reopen the project before reopening its job.", code="project_closed")
    job = lock_job(company_id, job_id)
    expect_revision(job, data.expected_revision)
    job.name = data.name
    job.status = data.status
    archiving = data.archived and job.archived_at is None
    job.archived_at = (job.archived_at or timezone.now()) if data.archived else None
    if archiving or data.status in {"completed", "cancelled"}:
        now = timezone.now()
        JobAssignment.objects.filter(job=job, ends_at__isnull=True).update(
            ends_at=now, ended_by=actor, end_reason="Job archived or closed"
        )
        JobParticipationRequest.objects.filter(job=job, status="pending").update(
            status="rejected", decided_at=now, decided_by=actor, revision=F("revision") + 1
        )
    job.revision += 1
    job.save()
    record_company_event(
        identity,
        company_id,
        "work.job.updated",
        job,
        metadata={"archived": data.archived, "status": data.status},
    )
    return job
