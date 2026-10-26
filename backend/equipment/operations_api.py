from datetime import datetime
from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint, not_found
from cleanforce_identity.users.facade import current_identity
from django.db.models import Q
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema, Status
from pydantic import Field

from companies.access import capabilities, require_member
from config.contracts import CommandInput, PageInput, RevisionInput, paginate

from . import condition, handoffs, reconciliation, request_decisions
from .api import AssetView, RequestView
from .models import (
    AssetIncident,
    AssetLifecycleEvent,
    AssetServiceEvent,
    CustodyHandoff,
    CustodyPeriod,
    ReconciliationCase,
    ToolRequest,
    WarehouseRoleGrant,
)
from .queries import asset_view, assets_with_availability

router = Router(tags=["equipment operations"])


class NoteInput(RevisionInput):
    note: str = Field(default="", max_length=2000)


class ReasonInput(RevisionInput):
    note: str = Field(min_length=1, max_length=2000)


class HandoffInput(RevisionInput):
    request_key: UUID
    destination_membership_id: UUID | None = None
    destination_warehouse_id: UUID | None = None
    note: str = Field(default="", max_length=2000)
    photo_id: UUID | None = None


class HandoffView(Schema):
    id: UUID
    asset_id: UUID
    source_custody_id: UUID
    destination_membership_id: UUID | None
    destination_warehouse_id: UUID | None
    tool_request_id: UUID | None
    proposed_by_id: UUID
    status: Literal["pending", "accepted", "declined", "cancelled"]
    proposed_at: datetime
    resolved_at: datetime | None
    resolved_by_id: UUID | None
    note: str
    resolution_note: str
    revision: int
    photo_ids: list[UUID]
    source_warehouse_id: UUID | None
    destination_name: str
    proposed_by_name: str

    @staticmethod
    def resolve_source_warehouse_id(obj):
        return obj.source_custody.holder_warehouse_id

    @staticmethod
    def resolve_destination_name(obj):
        return (
            obj.destination_membership.person.preferred_name
            if obj.destination_membership_id
            else obj.destination_warehouse.name
        )

    @staticmethod
    def resolve_proposed_by_name(obj):
        return obj.proposed_by.person.preferred_name

    @staticmethod
    def resolve_photo_ids(obj):
        return list(obj.handoffattachment_set.values_list("file_id", flat=True))


class HandoffPage(Schema):
    items: list[HandoffView]
    next_offset: int | None


class RequestPage(Schema):
    items: list[RequestView]
    next_offset: int | None


class CustodyView(Schema):
    id: UUID
    asset_id: UUID
    holder_membership_id: UUID | None
    holder_warehouse_id: UUID | None
    starts_at: datetime
    ends_at: datetime | None
    holder_name: str

    @staticmethod
    def resolve_holder_name(obj):
        return (
            obj.holder_membership.person.preferred_name
            if obj.holder_membership_id
            else obj.holder_warehouse.name
        )


class CustodyPage(Schema):
    items: list[CustodyView]
    next_offset: int | None


class IncidentInput(RevisionInput):
    kind: Literal["damage", "missing"]
    description: str = Field(min_length=1, max_length=2000)
    photo_id: UUID | None = None


class IncidentView(Schema):
    id: UUID
    asset_id: UUID
    kind: Literal["damage", "missing"]
    description: str
    reported_by_id: UUID
    reported_at: datetime
    resolved_at: datetime | None
    resolved_by_id: UUID | None
    resolution_note: str
    revision: int
    photo_ids: list[UUID]
    reported_by_name: str
    resolved_by_name: str | None

    @staticmethod
    def resolve_reported_by_name(obj):
        return obj.reported_by.person.preferred_name

    @staticmethod
    def resolve_resolved_by_name(obj):
        return obj.resolved_by.person.preferred_name if obj.resolved_by_id else None

    @staticmethod
    def resolve_photo_ids(obj):
        return list(obj.incidentattachment_set.values_list("file_id", flat=True))


class IncidentPage(Schema):
    items: list[IncidentView]
    next_offset: int | None


class ServiceInput(ReasonInput):
    serviceability: Literal["serviceable", "damaged", "out_of_service"]
    photo_id: UUID | None = None


class ServiceView(Schema):
    id: UUID
    asset_id: UUID
    performed_by_id: UUID
    occurred_at: datetime
    resulting_serviceability: Literal["serviceable", "damaged", "out_of_service"]
    note: str
    photo_ids: list[UUID]
    performed_by_name: str

    @staticmethod
    def resolve_performed_by_name(obj):
        return obj.performed_by.person.preferred_name

    @staticmethod
    def resolve_photo_ids(obj):
        return list(obj.serviceeventattachment_set.values_list("file_id", flat=True))


class ServicePage(Schema):
    items: list[ServiceView]
    next_offset: int | None


class LifecycleInput(ReasonInput):
    lifecycle: Literal["active", "retired", "disposed"]


class LifecycleView(Schema):
    id: UUID
    asset_id: UUID
    actor_id: UUID
    actor_name: str
    occurred_at: datetime
    from_lifecycle: Literal["active", "retired", "disposed"]
    to_lifecycle: Literal["active", "retired", "disposed"]
    reason: str

    @staticmethod
    def resolve_actor_name(obj):
        return obj.actor.person.preferred_name


class LifecyclePage(Schema):
    items: list[LifecycleView]
    next_offset: int | None


class ReconciliationInput(CommandInput):
    kind: Literal["custody_dispute", "missing_asset", "duplicate_asset"]
    narrative: str = Field(min_length=1, max_length=4000)


class ReconciliationResolution(ReasonInput):
    expected_asset_revision: int = Field(ge=1)
    destination_membership_id: UUID | None = None
    destination_warehouse_id: UUID | None = None
    photo_id: UUID | None = None


class ReconciliationView(Schema):
    id: UUID
    asset_id: UUID
    kind: Literal["custody_dispute", "missing_asset", "duplicate_asset"]
    narrative: str
    opened_at: datetime
    opened_by_id: UUID
    resolved_at: datetime | None
    resolved_by_id: UUID | None
    resolution_note: str
    corrected_custody_id: UUID | None
    revision: int
    photo_ids: list[UUID]

    @staticmethod
    def resolve_photo_ids(obj):
        return list(obj.reconciliationattachment_set.values_list("file_id", flat=True))


class ReconciliationPage(Schema):
    items: list[ReconciliationView]
    next_offset: int | None


def asset_detail(request: HttpRequest, company_id: UUID, asset_id: UUID):
    require_member(current_identity(request), company_id, "tools.read")
    asset = assets_with_availability(company_id).filter(pk=asset_id).first()
    if asset is None:
        raise not_found("Tool not found.")
    return asset_view(asset)


def requests_list(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    pending: bool = True,
    warehouse_id: UUID | None = None,
    asset_id: UUID | None = None,
    mine: bool = False,
):
    member = require_member(current_identity(request), company_id, "tools.read")
    query = ToolRequest.objects.filter(company_id=company_id).select_related(
        "source_custody", "requester__person"
    )
    if "tools.manage" not in capabilities(member):
        grants = WarehouseRoleGrant.objects.filter(
            membership=member, revoked_at__isnull=True
        ).values_list("warehouse_id", flat=True)
        query = query.filter(
            Q(requester=member) | Q(source_custody__holder_warehouse_id__in=grants)
        )
    if pending:
        query = query.filter(status__in=["pending", "approved"])
    if asset_id:
        query = query.filter(asset_id=asset_id)
    if mine:
        query = query.filter(requester=member)
    if warehouse_id:
        query = query.filter(source_custody__holder_warehouse_id=warehouse_id)
    return paginate(query.order_by("requested_at", "id"), page.limit, page.offset)


@csrf_protect
def request_decide(
    request: HttpRequest,
    company_id: UUID,
    request_id: UUID,
    action: Literal["approve", "reject", "withdraw"],
    data: NoteInput,
):
    return request_decisions.decide_request(
        current_identity(request), company_id, request_id, action, data
    )


@csrf_protect
def handoff_propose(request: HttpRequest, company_id: UUID, asset_id: UUID, data: HandoffInput):
    result, created = handoffs.propose_handoff(
        current_identity(request), company_id, asset_id, data
    )
    return Status(201 if created else 200, HandoffView.model_validate(result))


@csrf_protect
def handoff_resolve(
    request: HttpRequest,
    company_id: UUID,
    handoff_id: UUID,
    action: Literal["accept", "decline", "cancel", "void"],
    data: NoteInput,
):
    return handoffs.resolve_handoff(current_identity(request), company_id, handoff_id, action, data)


def handoffs_list(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    pending: bool = True,
    warehouse_id: UUID | None = None,
    mine: bool = False,
):
    member = require_member(current_identity(request), company_id, "tools.read")
    query = CustodyHandoff.objects.filter(company_id=company_id).select_related(
        "source_custody",
        "destination_membership__person",
        "destination_warehouse",
        "proposed_by__person",
    )
    if "tools.manage" not in capabilities(member):
        grants = WarehouseRoleGrant.objects.filter(
            membership=member, revoked_at__isnull=True
        ).values_list("warehouse_id", flat=True)
        query = query.filter(
            Q(proposed_by=member)
            | Q(destination_membership=member)
            | Q(destination_warehouse_id__in=grants)
            | Q(source_custody__holder_warehouse_id__in=grants)
            | (
                Q(source_custody__holder_membership_id__isnull=False)
                & Q(asset__responsible_warehouse_id__in=grants)
            )
        )
    if mine:
        query = query.filter(Q(proposed_by=member) | Q(destination_membership=member))
    if pending:
        query = query.filter(status="pending")
    if warehouse_id:
        query = query.filter(
            Q(destination_warehouse_id=warehouse_id)
            | Q(source_custody__holder_warehouse_id=warehouse_id)
            | (
                Q(source_custody__holder_membership_id__isnull=False)
                & Q(asset__responsible_warehouse_id=warehouse_id)
            )
        )
    return paginate(query.order_by("proposed_at", "id"), page.limit, page.offset)


def custody_history(request: HttpRequest, company_id: UUID, asset_id: UUID, page: Query[PageInput]):
    require_member(current_identity(request), company_id, "tools.read")
    if not assets_with_availability(company_id).filter(pk=asset_id).exists():
        raise not_found("Tool not found.")
    return paginate(
        CustodyPeriod.objects.filter(company_id=company_id, asset_id=asset_id)
        .select_related("holder_membership__person", "holder_warehouse")
        .order_by("-starts_at", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def incident_report(request: HttpRequest, company_id: UUID, asset_id: UUID, data: IncidentInput):
    return condition.report_incident(current_identity(request), company_id, asset_id, data)


def incidents_list(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    open_only: bool = True,
    asset_id: UUID | None = None,
):
    require_member(current_identity(request), company_id, "tools.read")
    query = AssetIncident.objects.filter(company_id=company_id).select_related(
        "reported_by__person", "resolved_by__person"
    )
    if open_only:
        query = query.filter(resolved_at__isnull=True)
    if asset_id:
        query = query.filter(asset_id=asset_id)
    return paginate(query.order_by("-reported_at", "id"), page.limit, page.offset)


@csrf_protect
def missing_resolve(request: HttpRequest, company_id: UUID, incident_id: UUID, data: ReasonInput):
    return condition.resolve_missing(current_identity(request), company_id, incident_id, data)


@csrf_protect
def service_record(request: HttpRequest, company_id: UUID, asset_id: UUID, data: ServiceInput):
    return condition.record_service(current_identity(request), company_id, asset_id, data)


def services_list(request: HttpRequest, company_id: UUID, asset_id: UUID, page: Query[PageInput]):
    require_member(current_identity(request), company_id, "tools.read")
    return paginate(
        AssetServiceEvent.objects.filter(company_id=company_id, asset_id=asset_id)
        .select_related("performed_by__person")
        .order_by("-occurred_at", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def lifecycle_change(request: HttpRequest, company_id: UUID, asset_id: UUID, data: LifecycleInput):
    asset = condition.change_lifecycle(current_identity(request), company_id, asset_id, data)
    return asset_view(assets_with_availability(company_id).get(pk=asset.pk))


def lifecycle_history(
    request: HttpRequest, company_id: UUID, asset_id: UUID, page: Query[PageInput]
):
    require_member(current_identity(request), company_id, "tools.read")
    return paginate(
        AssetLifecycleEvent.objects.filter(company_id=company_id, asset_id=asset_id)
        .select_related("actor__person")
        .order_by("-occurred_at", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def case_open(request: HttpRequest, company_id: UUID, asset_id: UUID, data: ReconciliationInput):
    return reconciliation.open_case(current_identity(request), company_id, asset_id, data)


@csrf_protect
def case_resolve(
    request: HttpRequest, company_id: UUID, case_id: UUID, data: ReconciliationResolution
):
    return reconciliation.resolve_case(current_identity(request), company_id, case_id, data)


def cases_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], open_only: bool = True
):
    require_member(current_identity(request), company_id, "reconciliation.manage")
    query = ReconciliationCase.objects.filter(company_id=company_id)
    if open_only:
        query = query.filter(resolved_at__isnull=True)
    return paginate(query.order_by("-opened_at", "id"), page.limit, page.offset)


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tools/{asset_id}",
    endpoint=asset_detail,
    response=AssetView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tool-requests",
    endpoint=requests_list,
    response=RequestPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-requests/{request_id}/{action}",
    endpoint=request_decide,
    response=RequestView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/handoffs",
    endpoint=handoff_propose,
    response={200: HandoffView, 201: HandoffView},
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/handoffs/{handoff_id}/{action}",
    endpoint=handoff_resolve,
    response=HandoffView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/handoffs",
    endpoint=handoffs_list,
    response=HandoffPage,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tools/{asset_id}/custody",
    endpoint=custody_history,
    response=CustodyPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/incidents",
    endpoint=incident_report,
    response=IncidentView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/incidents",
    endpoint=incidents_list,
    response=IncidentPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/incidents/{incident_id}/found",
    endpoint=missing_resolve,
    response=IncidentView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/service",
    endpoint=service_record,
    response=ServiceView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tools/{asset_id}/service",
    endpoint=services_list,
    response=ServicePage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/lifecycle",
    endpoint=lifecycle_change,
    response=AssetView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tools/{asset_id}/lifecycle",
    endpoint=lifecycle_history,
    response=LifecyclePage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/reconciliations",
    endpoint=case_open,
    response=ReconciliationView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/reconciliations/{case_id}/resolve",
    endpoint=case_resolve,
    response=ReconciliationView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/reconciliations",
    endpoint=cases_list,
    response=ReconciliationPage,
)
