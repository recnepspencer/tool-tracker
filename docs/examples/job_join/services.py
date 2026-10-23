"""Self-service joining: real assignment or approval request, never UI state."""

from uuid import UUID

from backend_platform.api import conflict, forbidden, not_found
from backend_platform.audit import (
    AuditActor,
    AuditSubject,
    build_audit_event,
    record_audit_event,
)
from cleanforce_identity.users.contracts import ActiveIdentityRecord
from django.db import transaction
from django.utils import timezone

from .models import (
    CompanyMembership,
    CompanyRoleGrant,
    Job,
    JobAssignment,
    JobAssignmentPolicy,
    JobParticipationRequest,
)


# Consumer-owned capability policy, not roles inferred from a screen or title.
ROLE_CAPABILITIES = {
    "field_member": frozenset({"jobs.participate"}),
    "company_admin": frozenset({"jobs.participate", "jobs.assign"}),
    "dispatcher": frozenset({"jobs.assign"}),
    "estimator": frozenset({"bids.edit"}),
}


def require_participation(member: CompanyMembership) -> None:
    if member.access_state != "active" or member.ended_at is not None:
        raise forbidden("Company access is inactive.", code="membership_inactive")
    roles = CompanyRoleGrant.objects.filter(
        membership=member, revoked_at__isnull=True
    ).values_list("role_code", flat=True)
    if not any("jobs.participate" in ROLE_CAPABILITIES.get(role, ()) for role in roles):
        raise forbidden("Job participation is not permitted.", code="participation_denied")


@transaction.atomic
def join_job(
    *,
    identity: ActiveIdentityRecord,
    company_id: UUID,
    job_id: UUID,
    request_key: UUID,
) -> JobParticipationRequest:
    # Lock protocol: affected memberships in ID order, then affected jobs in ID
    # order. Membership/access/grant writers must honor the membership lock too.
    # Archive locks its job before closing assignments. No asset rows are touched.
    # Do not select_related nullable identity joins in this locking query.
    member = CompanyMembership.objects.select_for_update(of=("self",)).filter(
        company_id=company_id, person__identity_user_id=identity.user_id
    ).first()
    if member is None:
        raise forbidden("Company membership is required.", code="membership_required")
    require_participation(member)

    previous = JobParticipationRequest.objects.filter(
        membership=member, request_key=request_key
    ).first()
    if previous is not None:
        if previous.job_id != job_id:
            raise conflict("Request key belongs to another job.", code="retry_key_reused")
        # Replay returns this resource's current state, not a new assignment.
        # Authorization is rechecked even on a retry.
        return previous

    job = Job.objects.select_for_update().filter(
        pk=job_id, company_id=company_id
    ).first()
    if job is None:
        raise not_found("Job not found.")
    if job.archived_at is not None or job.status != "active":
        raise conflict("Job is not open for joining.", code="job_not_active")
    if JobAssignment.objects.filter(
        job=job, membership=member, ends_at__isnull=True
    ).exists():
        raise conflict("Already assigned to this job.", code="already_assigned")
    if JobParticipationRequest.objects.filter(
        job=job, membership=member, status="pending"
    ).exists():
        raise conflict("A join request is already pending.", code="join_already_pending")

    policy = JobAssignmentPolicy.objects.filter(company_id=company_id).first()
    if policy is None:
        raise forbidden("Job participation policy is not configured.", code="policy_missing")
    if policy.self_join_mode == JobAssignmentPolicy.Mode.DISABLED:
        raise forbidden("Self-service joining is disabled.", code="self_join_disabled")
    if policy.self_join_mode not in {
        JobAssignmentPolicy.Mode.DIRECT, JobAssignmentPolicy.Mode.APPROVAL
    }:
        raise forbidden("Invalid participation policy.", code="policy_invalid")

    now = timezone.now()
    assignment = None
    if policy.self_join_mode == JobAssignmentPolicy.Mode.DIRECT:
        assignment = JobAssignment.objects.create(
            job=job,
            membership=member,
            responsibility_code="crew",  # Workers cannot self-promote.
            starts_at=now,
            assigned_by=member,
        )

    participation = JobParticipationRequest.objects.create(
        job=job,
        membership=member,
        request_key=request_key,
        status="approved" if assignment is not None else "pending",
        policy_revision=policy.revision,
        requested_at=now,
        decided_at=now if assignment is not None else None,
        decided_by=member if assignment is not None else None,
        assignment=assignment,
    )
    record_join_audit(identity, participation, company_id)
    return participation


def record_join_audit(
    identity: ActiveIdentityRecord,
    participation: JobParticipationRequest,
    company_id: UUID,
) -> None:
    actor_id = identity.actor_user_id or identity.user_id
    event = build_audit_event(
        event_key=(
            "work.job.joined"
            if participation.status == "approved"
            else "work.job.join_requested"
        ),
        subject=AuditSubject(
            domain="work",
            entity_type="job_participation_request",
            entity_id=str(participation.id),
        ),
        actor=AuditActor(
            user_id=actor_id,
            email=identity.actor_email or identity.email,
            principal_id=identity.principal_id or actor_id,
            effective_user_id=identity.user_id,
            effective_email=identity.email,
            is_impersonating=identity.is_impersonating,
        ),
        metadata={
            "company_id": str(company_id),
            "job_id": str(participation.job_id),
            "membership_id": str(participation.membership_id),
            "assignment_id": (
                str(participation.assignment_id)
                if participation.assignment_id is not None else None
            ),
            "policy_revision": participation.policy_revision,
        },
    )
    # Default CleanForce dispatcher inserts its durable job on this same DB
    # transaction. Do not move this into on_commit: enqueue failure must roll
    # back the business rows. The worker materializes the audit event later.
    record_audit_event(event)
