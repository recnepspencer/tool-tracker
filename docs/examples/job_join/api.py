from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Schema

from .services import join_job


class JoinJobInput(Schema):
    request_key: UUID


class JoinJobResult(Schema):
    request_id: UUID
    status: Literal["pending", "approved", "rejected", "withdrawn"]
    assignment_id: UUID | None


router = Router(tags=["job-participation"])


@csrf_protect
def join_job_endpoint(
    request: HttpRequest,
    company_id: UUID,
    job_id: UUID,
    data: JoinJobInput,
) -> JoinJobResult:
    participation = join_job(
        identity=current_identity(request),
        company_id=company_id,
        job_id=job_id,
        request_key=data.request_key,
    )
    return JoinJobResult(
        request_id=participation.id,
        status=participation.status,
        assignment_id=participation.assignment_id,
    )


define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/jobs/{job_id}/join",
    endpoint=join_job_endpoint,
    response=JoinJobResult,
)
