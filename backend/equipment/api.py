from datetime import datetime
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema, Status
from pydantic import ConfigDict, Field

from .queries import list_assets, read_request
from .request_tool import request_tool

router = Router(tags=["tools"])


class AssetView(Schema):
    id: UUID
    asset_tag: str
    serial_number: str | None
    tool_model_id: UUID
    name: str
    manufacturer: str
    model_number: str
    lifecycle: str
    serviceability: str
    missing: bool
    warehouse_id: UUID | None
    requestable: bool
    unavailable_reason: str | None
    revision: int


class AssetPage(Schema):
    items: list[AssetView]
    next_offset: int | None


class PageInput(Schema):
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


class RequestInput(Schema):
    model_config = ConfigDict(extra="forbid")
    request_key: UUID
    note: str = Field(default="", max_length=2000)


class RequestView(Schema):
    id: UUID
    asset_id: UUID
    requester_id: UUID
    source_custody_id: UUID
    status: str
    note: str
    requested_at: datetime


def browse_tools(request: HttpRequest, company_id: UUID, page: Query[PageInput]):
    return list_assets(current_identity(request), company_id, limit=page.limit, offset=page.offset)


@csrf_protect
def create_request(request: HttpRequest, company_id: UUID, asset_id: UUID, data: RequestInput):
    result, created = request_tool(
        identity=current_identity(request),
        company_id=company_id,
        asset_id=asset_id,
        request_key=data.request_key,
        note=data.note,
    )
    return Status(201 if created else 200, RequestView.model_validate(result))


def get_request(request: HttpRequest, company_id: UUID, request_id: UUID):
    return RequestView.model_validate(
        read_request(current_identity(request), company_id, request_id)
    )


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tools",
    endpoint=browse_tools,
    response=AssetPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/requests",
    endpoint=create_request,
    response={201: RequestView, 200: RequestView},
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tool-requests/{request_id}",
    endpoint=get_request,
    response=RequestView,
)
