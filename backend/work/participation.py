from backend_platform.api import conflict, forbidden, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write, require_member
from companies.audit import record_company_event
from companies.models import Company, CompanyMembership
from companies.revisions import expect_revision

from .models import Job, JobAssignment, JobAssignmentPolicy, JobParticipationRequest


def lock_job(company_id, job_id):
    job = Job.objects.select_for_update().filter(company_id=company_id, pk=job_id).first()
    if job is None:
        raise not_found("Job not found.")
    return job


def join_issue(job):
    if job.archived_at or job.status not in {"planned", "active"}:
        return "This job is not accepting assignments.", "job_not_joinable"
    return None


def require_joinable(job):
    if issue := join_issue(job):
        raise conflict(issue[0], code=issue[1])


def intent_issue(job, member, intent, assignment_id):
    """The same current-state rule is read by the review UI and checked under the job lock."""
    if member.access_state != "active" or member.ended_at:
        return "Subject is no longer active.", "member_inactive"
    if job.archived_at:
        return "Job is archived.", "job_archived"
    if intent == "join":
        if issue := join_issue(job):
            return issue
        if JobAssignment.objects.filter(job=job, membership=member, ends_at__isnull=True).exists():
            return "Member is already assigned to this job.", "already_assigned"
    elif not JobAssignment.objects.filter(
        pk=assignment_id, job=job, membership=member, ends_at__isnull=True
    ).exists():
        return "The referenced assignment is no longer current.", "stale_assignment"
    return None


def end_assignment(assignment, actor, reason):
    assignment.ends_at = timezone.now()
    assignment.ended_by = actor
    assignment.end_reason = reason
    assignment.save(update_fields=["ends_at", "ended_by", "end_reason"])


def apply_intent(request, job, actor):
    if issue := intent_issue(job, request.membership, request.intent, request.target_assignment_id):
        raise conflict(issue[0], code=issue[1])
    if request.intent == "join":
        request.resulting_assignment = JobAssignment.objects.create(
            company_id=job.company_id,
            job=job,
            membership=request.membership,
            assigned_by=actor,
            starts_at=timezone.now(),
        )
    else:
        target = JobAssignment.objects.filter(
            pk=request.target_assignment_id,
            job=job,
            membership=request.membership,
            ends_at__isnull=True,
        ).first()
        end_assignment(target, actor, request.reason)
        request.resulting_assignment = target
    request.status = "approved"
    request.decided_at = timezone.now()
    request.decided_by = actor
    job.revision += 1
    job.save(update_fields=["revision"])


def read_policy(identity, company_id):
    require_member(identity, company_id, "jobs.read")
    return JobAssignmentPolicy.objects.filter(company_id=company_id).first() or JobAssignmentPolicy(
        company_id=company_id
    )


@transaction.atomic
def set_policy(identity, company_id, data):
    authorize_write(identity, company_id, "jobs.manage_policy")
    Company.objects.select_for_update().get(pk=company_id)
    policy, _ = JobAssignmentPolicy.objects.get_or_create(company_id=company_id)
    policy = JobAssignmentPolicy.objects.select_for_update().get(pk=company_id)
    expect_revision(policy, data.expected_revision)
    policy.self_join_mode = data.self_join_mode
    policy.self_leave_mode = data.self_leave_mode
    policy.revision += 1
    policy.save()
    record_company_event(
        identity,
        company_id,
        "work.participation_policy.updated",
        policy,
        metadata={"join_mode": data.self_join_mode, "leave_mode": data.self_leave_mode},
    )
    return policy


@transaction.atomic
def request_participation(identity, company_id, job_id, data):
    member = authorize_write(identity, company_id, "jobs.participate")
    prior = JobParticipationRequest.objects.filter(
        membership=member, request_key=data.request_key
    ).first()
    if prior:
        if (prior.job_id, prior.intent, prior.target_assignment_id, prior.reason) != (
            job_id,
            data.intent,
            data.assignment_id,
            data.reason,
        ):
            raise conflict(
                "Participation key was used for different input.", code="request_key_reused"
            )
        return prior, False
    policy = JobAssignmentPolicy.objects.select_for_update().filter(company_id=company_id).first()
    mode = getattr(policy, f"self_{data.intent}_mode", "disabled")
    if mode == "disabled":
        raise forbidden(
            "Self-service is disabled for this operation.", code="participation_disabled"
        )
    job = lock_job(company_id, job_id)
    if data.intent == "join":
        if data.assignment_id is not None:
            raise conflict(
                "A join request cannot name an existing assignment.", code="invalid_assignment"
            )
    if issue := intent_issue(job, member, data.intent, data.assignment_id):
        raise conflict(issue[0], code=issue[1])
    if JobParticipationRequest.objects.filter(
        job=job, membership=member, intent=data.intent, status="pending"
    ).exists():
        raise conflict("A participation request is already pending.", code="participation_pending")
    result = JobParticipationRequest.objects.create(
        company_id=company_id,
        job=job,
        membership=member,
        intent=data.intent,
        target_assignment_id=data.assignment_id,
        request_key=data.request_key,
        policy_revision=policy.revision,
        reason=data.reason,
    )
    if mode == "direct":
        apply_intent(result, job, member)
        result.save()
    record_company_event(
        identity,
        company_id,
        "work.participation.requested",
        result,
        metadata={"job_id": str(job.pk), "intent": data.intent, "status": result.status},
    )
    return result, True


@transaction.atomic
def decide_participation(identity, company_id, request_id, action, data):
    reference = JobParticipationRequest.objects.filter(company_id=company_id, pk=request_id).first()
    if reference is None:
        raise not_found("Participation request not found.")
    member = authorize_write(
        identity,
        company_id,
        "jobs.participate" if action == "withdraw" else "jobs.assign",
        related_members=[reference.membership_id],
    )
    job = lock_job(company_id, reference.job_id)
    result = (
        JobParticipationRequest.objects.select_for_update(of=("self",))
        .select_related("membership")
        .get(pk=request_id)
    )
    if action == "withdraw" and result.membership_id != member.pk:
        raise forbidden("Only the subject may withdraw this request.")
    target = {"approve": "approved", "reject": "rejected", "withdraw": "withdrawn"}[action]
    if result.status == target:
        return result
    expect_revision(result, data.expected_revision)
    if result.status != "pending":
        raise conflict("Participation request is already resolved.", code="participation_resolved")
    if action == "approve":
        apply_intent(result, job, member)
    result.status = target
    result.decided_at = timezone.now()
    result.decided_by = member
    result.decision_note = data.note
    result.revision += 1
    result.save()
    record_company_event(
        identity,
        company_id,
        f"work.participation.{target}",
        result,
        metadata={"job_id": str(job.pk), "decision_note": data.note},
    )
    return result


@transaction.atomic
def assign_member(identity, company_id, job_id, data):
    actor = authorize_write(
        identity, company_id, "jobs.assign", related_members=[data.membership_id]
    )
    job = lock_job(company_id, job_id)
    expect_revision(job, data.expected_revision)
    require_joinable(job)
    subject = CompanyMembership.objects.filter(
        pk=data.membership_id, company_id=company_id, access_state="active", ended_at__isnull=True
    ).first()
    if subject is None:
        raise not_found("Active membership not found.")
    current = JobAssignment.objects.filter(
        job=job, membership=subject, ends_at__isnull=True
    ).first()
    if current:
        if current.responsibility == data.responsibility:
            return current
        end_assignment(current, actor, data.reason)
    result = JobAssignment.objects.create(
        company_id=company_id,
        job=job,
        membership=subject,
        responsibility=data.responsibility,
        assigned_by=actor,
        starts_at=timezone.now(),
    )
    job.revision += 1
    job.save(update_fields=["revision"])
    record_company_event(
        identity, company_id, "work.assignment.created", result, metadata={"job_id": str(job.pk)}
    )
    return result


@transaction.atomic
def end_member_assignment(identity, company_id, assignment_id, data):
    reference = JobAssignment.objects.filter(company_id=company_id, pk=assignment_id).first()
    if reference is None:
        raise not_found("Assignment not found.")
    actor = authorize_write(
        identity, company_id, "jobs.assign", related_members=[reference.membership_id]
    )
    job = lock_job(company_id, reference.job_id)
    assignment = JobAssignment.objects.get(pk=assignment_id)
    if assignment.ends_at:
        return assignment
    expect_revision(job, data.expected_revision)
    end_assignment(assignment, actor, data.note)
    job.revision += 1
    job.save(update_fields=["revision"])
    record_company_event(
        identity, company_id, "work.assignment.ended", assignment, metadata={"job_id": str(job.pk)}
    )
    return assignment
