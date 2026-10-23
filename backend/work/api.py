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
from .models import Job, JobAssignment, JobParticipationRequest, Project

router = Router(tags=["work"])
JobStatus = Literal["planned", "active", "on_hold", "completed", "cancelled"]
ProjectStatus = Literal["prospective", "active", "closed", "cancelled"]
ParticipationMode = Literal["direct", "approval_required", "disabled"]


class ProjectInput(CommandInput):
    number: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    lifecycle: ProjectStatus = "active"


class ProjectUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=200)
    lifecycle: ProjectStatus


class ProjectView(Schema):
    id: UUID
    number: str
    name: str
    lifecycle: ProjectStatus
    revision: int


class ProjectPage(Schema):
    items: list[ProjectView]
    next_offset: int | None


class JobInput(CommandInput):
    project_id: UUID
    number: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    status: JobStatus = "active"


class JobUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=200)
    status: JobStatus
    archived: bool = False


class JobView(Schema):
    id: UUID
    project_id: UUID
    number: str
    name: str
    status: JobStatus
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
    revision: int


class ParticipationPage(Schema):
    items: list[ParticipationView]
    next_offset: int | None


class DecisionInput(RevisionInput):
    note: str = Field(default="", max_length=2000)


class AssignmentInput(RevisionInput):
    membership_id: UUID
    responsibility: Literal["crew", "foreman", "supervisor"] = "crew"
    reason: str = Field(min_length=1, max_length=2000)


class AssignmentView(Schema):
    id: UUID
    job_id: UUID
    membership_id: UUID
    responsibility: Literal["crew", "foreman", "supervisor"]
    starts_at: datetime
    ends_at: datetime | None
    assigned_by_id: UUID
    ended_by_id: UUID | None
    end_reason: str


class AssignmentPage(Schema):
    items: list[AssignmentView]
    next_offset: int | None


def projects_list(request: HttpRequest, company_id: UUID, page: Query[PageInput]):
    require_member(current_identity(request), company_id, "jobs.read")
    return paginate(
        Project.objects.filter(company_id=company_id).order_by("number", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def project_create(request: HttpRequest, company_id: UUID, data: ProjectInput):
    return jobs.create_project(current_identity(request), company_id, data)


@csrf_protect
def project_update(request: HttpRequest, company_id: UUID, project_id: UUID, data: ProjectUpdate):
    return jobs.update_project(current_identity(request), company_id, project_id, data)


def jobs_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], archived: bool = False
):
    require_member(current_identity(request), company_id, "jobs.read")
    return paginate(
        Job.objects.filter(company_id=company_id, archived_at__isnull=not archived).order_by(
            "number", "id"
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
    query = JobParticipationRequest.objects.filter(company_id=company_id)
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
    query = JobAssignment.objects.filter(company_id=company_id)
    if current:
        query = query.filter(ends_at__isnull=True)
    if job_id:
        query = query.filter(job_id=job_id)
    if membership_id:
        query = query.filter(membership_id=membership_id)
    return paginate(query.order_by("-starts_at", "id"), page.limit, page.offset)


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/projects",
    endpoint=projects_list,
    response=ProjectPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/projects",
    endpoint=project_create,
    response=ProjectView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/projects/{project_id}/update",
    endpoint=project_update,
    response=ProjectView,
)
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
