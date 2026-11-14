from datetime import datetime
from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema
from pydantic import Field

from config.contracts import CommandInput, PageInput, RevisionInput, paginate

from . import intake
from .catalog_api import RegistrationInput

router = Router(tags=["equipment collection"])


class SubmissionInput(CommandInput):
    request_key: UUID
    description: str = Field(min_length=1, max_length=500)
    suggested_type_id: UUID | None = None
    in_my_possession: bool = True
    location: str = Field(default="", max_length=500)
    notes: str = Field(default="", max_length=4000)
    photo_id: UUID | None = None


class ReplyInput(RevisionInput):
    note: str = Field(min_length=1, max_length=4000)


class ReviewInput(RevisionInput):
    decision: Literal["clarify", "link", "register"]
    note: str = Field(default="", max_length=4000)
    asset_id: UUID | None = None
    registration: RegistrationInput | None = None


class DiscussionMessage(Schema):
    author: str
    text: str
    at: str


class SubmissionView(Schema):
    id: UUID
    description: str
    location: str
    in_my_possession: bool
    notes: str
    suggested_type_id: UUID | None
    photo_id: UUID | None
    status: Literal["pending", "clarification", "registered", "linked"]
    asset_id: UUID | None
    discussion: list[DiscussionMessage]
    revision: int
    submitted_at: datetime
    reporter_id: UUID
    reporter_name: str

    @staticmethod
    def resolve_reporter_name(obj):
        return obj.reporter.person.preferred_name


class SubmissionPage(Schema):
    items: list[SubmissionView]
    next_offset: int | None


def listing(request: HttpRequest, company_id: UUID, page: Query[PageInput]):
    return paginate(
        intake.submissions(current_identity(request), company_id), page.limit, page.offset
    )


@csrf_protect
def submit(request: HttpRequest, company_id: UUID, data: SubmissionInput):
    return intake.submit(current_identity(request), company_id, data)


@csrf_protect
def reply(request: HttpRequest, company_id: UUID, submission_id: UUID, data: ReplyInput):
    return intake.reply(current_identity(request), company_id, submission_id, data)


@csrf_protect
def review(request: HttpRequest, company_id: UUID, submission_id: UUID, data: ReviewInput):
    return intake.review(current_identity(request), company_id, submission_id, data)


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/equipment-submissions",
    endpoint=listing,
    response=SubmissionPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/equipment-submissions",
    endpoint=submit,
    response=SubmissionView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/equipment-submissions/{submission_id}/reply",
    endpoint=reply,
    response=SubmissionView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/equipment-submissions/{submission_id}/review",
    endpoint=review,
    response=SubmissionView,
)
