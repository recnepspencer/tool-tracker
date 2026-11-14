from datetime import datetime
from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema, Status
from pydantic import Field

from companies.access import capabilities, require_member
from config.contracts import CommandInput, PageInput, RevisionInput, paginate

from . import jobs, participation
from .models import Job, JobAssignment, JobParticipationRequest

router = Router(tags=["work"])
ParticipationMode = Literal["direct", "approval_required", "disabled"]


class JobInput(CommandInput):
    name: str = Field(min_length=1, max_length=200)


class JobUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=200)
    archived: bool = False


class JobView(Schema):
    id: UUID
    name: str
    archived_at: datetime | None
    revision: int


class JobPage(Schema):
    items: list[JobView]
    next_offset: int | None


class ParticipationPolicyView(Schema):
    self_join_mode: ParticipationMode
    self_leave_mode: ParticipationMode
    revision: int


class ParticipationPolicyInput(RevisionInput):
    self_join_mode: ParticipationMode
    self_leave_mode: ParticipationMode


class ParticipationInput(CommandInput):
    request_key: UUID
    intent: Literal["join", "leave"]
    assignment_id: UUID | None = None
    reason: str = Field(default="", max_length=2000)


class ParticipationView(Schema):
    id: UUID
    job_id: UUID
    membership_id: UUID
    intent: Literal["join", "leave"]
    status: Literal["pending", "approved", "rejected", "withdrawn"]
    target_assignment_id: UUID | None
    resulting_assignment_id: UUID | None
    policy_revision: int
    requested_at: datetime
    decided_at: datetime | None
    reason: str
    decision_note: str
    revision: int
    member_name: str
    job_name: str
    decided_by_id: UUID | None
    decided_by_name: str | None
    approval_blocked_reason: str | None

    @staticmethod
    def resolve_member_name(obj):
        return obj.membership.person.preferred_name

    @staticmethod
    def resolve_job_name(obj):
        return obj.job.name

    @staticmethod
    def resolve_decided_by_name(obj):
        return obj.decided_by.person.preferred_name if obj.decided_by_id else None

    @staticmethod
    def resolve_approval_blocked_reason(obj):
        if obj.status != "pending":
            return None
        issue = participation.intent_issue(
            obj.job, obj.membership, obj.intent, obj.target_assignment_id
        )
        return issue[0] if issue else None


class ParticipationPage(Schema):
    items: list[ParticipationView]
    next_offset: int | None


class DecisionInput(RevisionInput):
    note: str = Field(default="", max_length=2000)


class AssignmentInput(RevisionInput):
    membership_id: UUID
    reason: str = Field(min_length=1, max_length=2000)


class AssignmentView(Schema):
    id: UUID
    job_id: UUID
    membership_id: UUID
    starts_at: datetime
    ends_at: datetime | None
    assigned_by_id: UUID
    ended_by_id: UUID | None
    end_reason: str
    member_name: str
    assigned_by_name: str
    ended_by_name: str | None

    @staticmethod
    def resolve_member_name(obj):
        return obj.membership.person.preferred_name

    @staticmethod
    def resolve_assigned_by_name(obj):
        return obj.assigned_by.person.preferred_name

    @staticmethod
    def resolve_ended_by_name(obj):
        return obj.ended_by.person.preferred_name if obj.ended_by_id else None


class AssignmentPage(Schema):
    items: list[AssignmentView]
    next_offset: int | None


class JobMembersInput(RevisionInput):
    """Everyone who should be on the job after the save; anyone left out comes off it."""

    membership_ids: list[UUID] = Field(max_length=1000)
    note: str = Field(default="", max_length=2000)


class JobMembersView(Schema):
    job: JobView
    assignments: list[AssignmentView]


def jobs_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], archived: bool = False
):
    require_member(current_identity(request), company_id, "jobs.read")
    return paginate(
        Job.objects.filter(company_id=company_id, archived_at__isnull=not archived).order_by(
            "name", "id"
        ),
        page.limit,
        page.offset,
    )


@csrf_protect
def job_create(request: HttpRequest, company_id: UUID, data: JobInput):
    return jobs.create_job(current_identity(request), company_id, data)


@csrf_protect
def job_update(request: HttpRequest, company_id: UUID, job_id: UUID, data: JobUpdate):
    return jobs.update_job(current_identity(request), company_id, job_id, data)


def policy_read(request: HttpRequest, company_id: UUID):
    return participation.read_policy(current_identity(request), company_id)


@csrf_protect
def policy_update(request: HttpRequest, company_id: UUID, data: ParticipationPolicyInput):
    return participation.set_policy(current_identity(request), company_id, data)


@csrf_protect
def participation_create(
    request: HttpRequest, company_id: UUID, job_id: UUID, data: ParticipationInput
):
    result, created = participation.request_participation(
        current_identity(request), company_id, job_id, data
    )
    return Status(201 if created else 200, ParticipationView.model_validate(result))


def participation_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], pending: bool = True
):
    member = require_member(current_identity(request), company_id, "jobs.read")
    query = JobParticipationRequest.objects.filter(company_id=company_id).select_related(
        "job", "membership__person", "decided_by__person"
    )
    if "jobs.assign" not in capabilities(member):
        query = query.filter(membership=member)
    if pending:
        query = query.filter(status="pending")
    return paginate(query.order_by("-requested_at", "id"), page.limit, page.offset)


@csrf_protect
def participation_decide(
    request: HttpRequest,
    company_id: UUID,
    request_id: UUID,
    action: Literal["approve", "reject", "withdraw"],
    data: DecisionInput,
):
    return participation.decide_participation(
        current_identity(request), company_id, request_id, action, data
    )


@csrf_protect
def assignment_create(request: HttpRequest, company_id: UUID, job_id: UUID, data: AssignmentInput):
    return participation.assign_member(current_identity(request), company_id, job_id, data)


@csrf_protect
def job_members_set(request: HttpRequest, company_id: UUID, job_id: UUID, data: JobMembersInput):
    return participation.set_job_members(current_identity(request), company_id, job_id, data)


@csrf_protect
def assignment_end(
    request: HttpRequest, company_id: UUID, assignment_id: UUID, data: DecisionInput
):
    return participation.end_member_assignment(
        current_identity(request), company_id, assignment_id, data
    )


def assignments_list(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    job_id: UUID | None = None,
    membership_id: UUID | None = None,
    current: bool = True,
):
    require_member(current_identity(request), company_id, "jobs.read")
    query = JobAssignment.objects.filter(company_id=company_id).select_related(
        "membership__person", "assigned_by__person", "ended_by__person"
    )
    if current:
        query = query.filter(ends_at__isnull=True)
    if job_id:
        query = query.filter(job_id=job_id)
    if membership_id:
        query = query.filter(membership_id=membership_id)
    return paginate(query.order_by("-starts_at", "id"), page.limit, page.offset)


define_http_endpoint(
    router, method="get", path="/companies/{company_id}/jobs", endpoint=jobs_list, response=JobPage
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs",
    endpoint=job_create,
    response=JobView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs/{job_id}/update",
    endpoint=job_update,
    response=JobView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/job-participation-policy",
    endpoint=policy_read,
    response=ParticipationPolicyView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/job-participation-policy",
    endpoint=policy_update,
    response=ParticipationPolicyView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs/{job_id}/participation",
    endpoint=participation_create,
    response={200: ParticipationView, 201: ParticipationView},
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/job-participation-requests",
    endpoint=participation_list,
    response=ParticipationPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/job-participation-requests/{request_id}/{action}",
    endpoint=participation_decide,
    response=ParticipationView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs/{job_id}/assignments",
    endpoint=assignment_create,
    response=AssignmentView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs/{job_id}/members",
    endpoint=job_members_set,
    response=JobMembersView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/assignments/{assignment_id}/end",
    endpoint=assignment_end,
    response=AssignmentView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/assignments",
    endpoint=assignments_list,
    response=AssignmentPage,
)
