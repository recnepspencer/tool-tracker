from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.db.models import Prefetch
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema, Status
from pydantic import Field

from companies.access import capabilities, require_member
from config.contracts import CommandInput, PageInput, RevisionInput, paginate

from . import catalog, registration
from .api import AssetView
from .models import ToolCategory, ToolModel, Warehouse, WarehouseRoleGrant
from .queries import asset_view, assets_with_availability

router = Router(tags=["equipment catalog"])


class WarehouseInput(CommandInput):
    code: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=2000)


class WarehouseUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=2000)
    archived: bool = False


class WarehouseManagerView(Schema):
    membership_id: UUID
    name: str
    eligible: bool


class WarehouseView(Schema):
    id: UUID
    code: str
    name: str
    address: str
    archived_at: datetime | None
    revision: int
    managers: list[WarehouseManagerView]

    @staticmethod
    def resolve_managers(obj):
        grants = getattr(obj, "live_managers", None)
        if grants is None:
            grants = obj.warehouserolegrant_set.filter(revoked_at__isnull=True).select_related(
                "membership__person"
            )
        return [
            {
                "membership_id": grant.membership_id,
                "name": grant.membership.person.preferred_name,
                "eligible": grant.membership.access_state == "active"
                and grant.membership.ended_at is None
                and "tools.transfer" in capabilities(grant.membership),
            }
            for grant in grants
        ]


class WarehousePage(Schema):
    items: list[WarehouseView]
    next_offset: int | None


class WarehouseGrantInput(RevisionInput):
    membership_id: UUID
    enabled: bool


class CategoryInput(CommandInput):
    name: str = Field(min_length=1, max_length=120)


class CategoryUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=120)
    archived: bool = False


class CategoryView(Schema):
    id: UUID
    name: str
    archived_at: datetime | None
    revision: int


class CategoryPage(Schema):
    items: list[CategoryView]
    next_offset: int | None


class ModelInput(CommandInput):
    category_id: UUID
    name: str = Field(min_length=1, max_length=200)
    manufacturer: str = Field(min_length=1, max_length=120)
    model_number: str = Field(min_length=1, max_length=120)


class ModelUpdate(ModelInput):
    expected_revision: int = Field(ge=1)
    archived: bool = False


class ModelView(Schema):
    id: UUID
    category_id: UUID
    name: str
    manufacturer: str
    model_number: str
    archived_at: datetime | None
    revision: int
    registrable: bool

    @staticmethod
    def resolve_registrable(obj):
        return obj.archived_at is None and obj.category.archived_at is None


class ModelPage(Schema):
    items: list[ModelView]
    next_offset: int | None


class AssetDetailsInput(CommandInput):
    serial_number: str | None = Field(default=None, max_length=120)
    acquisition_date: date | None = None
    acquisition_cost: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    acquisition_currency: str = Field(default="", pattern=r"^([A-Z]{3})?$")
    notes: str = Field(default="", max_length=4000)


class RegistrationInput(AssetDetailsInput):
    request_key: UUID
    tool_model_id: UUID
    warehouse_id: UUID
    asset_tag: str = Field(min_length=1, max_length=64)
    photo_id: UUID | None = None


class AssetUpdate(AssetDetailsInput, RevisionInput):
    pass


class StewardshipInput(RevisionInput):
    warehouse_id: UUID
    note: str = Field(min_length=1, max_length=2000)


class RegistrationPolicyInput(RevisionInput):
    employee_tool_creation_enabled: bool


class RegistrationPolicyView(Schema):
    employee_tool_creation_enabled: bool
    revision: int


def warehouses_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], archived: bool = False
):
    require_member(current_identity(request), company_id, "company.read")
    return paginate(
        Warehouse.objects.filter(company_id=company_id, archived_at__isnull=not archived)
        .prefetch_related(
            Prefetch(
                "warehouserolegrant_set",
                queryset=WarehouseRoleGrant.objects.filter(revoked_at__isnull=True).select_related(
                    "membership__person"
                ),
                to_attr="live_managers",
            )
        )
        .order_by("code", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def warehouse_create(request: HttpRequest, company_id: UUID, data: WarehouseInput):
    return catalog.create_warehouse(current_identity(request), company_id, data)


@csrf_protect
def warehouse_update(
    request: HttpRequest, company_id: UUID, warehouse_id: UUID, data: WarehouseUpdate
):
    return catalog.update_warehouse(current_identity(request), company_id, warehouse_id, data)


@csrf_protect
def warehouse_grant(
    request: HttpRequest, company_id: UUID, warehouse_id: UUID, data: WarehouseGrantInput
):
    return catalog.set_warehouse_grant(current_identity(request), company_id, warehouse_id, data)


def categories_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], archived: bool = False
):
    require_member(current_identity(request), company_id, "tools.read")
    return paginate(
        ToolCategory.objects.filter(
            company_id=company_id, archived_at__isnull=not archived
        ).order_by("name", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def category_create(request: HttpRequest, company_id: UUID, data: CategoryInput):
    return catalog.create_category(current_identity(request), company_id, data.name)


@csrf_protect
def category_update(
    request: HttpRequest, company_id: UUID, category_id: UUID, data: CategoryUpdate
):
    return catalog.update_category(current_identity(request), company_id, category_id, data)


def models_list(
    request: HttpRequest, company_id: UUID, page: Query[PageInput], archived: bool = False
):
    require_member(current_identity(request), company_id, "tools.read")
    return paginate(
        ToolModel.objects.filter(company_id=company_id, archived_at__isnull=not archived)
        .select_related("category")
        .order_by("name", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def model_create(request: HttpRequest, company_id: UUID, data: ModelInput):
    return catalog.create_model(current_identity(request), company_id, data)


@csrf_protect
def model_update(request: HttpRequest, company_id: UUID, model_id: UUID, data: ModelUpdate):
    return catalog.update_model(current_identity(request), company_id, model_id, data)


@csrf_protect
def asset_register(request: HttpRequest, company_id: UUID, data: RegistrationInput):
    result, created = registration.register_asset(current_identity(request), company_id, data)
    return Status(
        201 if created else 200, asset_view(assets_with_availability(company_id).get(pk=result.pk))
    )


@csrf_protect
def asset_update(request: HttpRequest, company_id: UUID, asset_id: UUID, data: AssetUpdate):
    result = catalog.update_asset(current_identity(request), company_id, asset_id, data)
    return asset_view(assets_with_availability(company_id).get(pk=result.pk))


@csrf_protect
def stewardship_update(
    request: HttpRequest, company_id: UUID, asset_id: UUID, data: StewardshipInput
):
    result = catalog.set_stewardship(current_identity(request), company_id, asset_id, data)
    return asset_view(assets_with_availability(company_id).get(pk=result.pk))


def registration_policy_read(request: HttpRequest, company_id: UUID):
    return registration.read_registration_policy(current_identity(request), company_id)


@csrf_protect
def registration_policy_update(
    request: HttpRequest, company_id: UUID, data: RegistrationPolicyInput
):
    return registration.set_registration_policy(
        current_identity(request),
        company_id,
        data.employee_tool_creation_enabled,
        data.expected_revision,
    )


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/warehouses",
    endpoint=warehouses_list,
    response=WarehousePage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/warehouses",
    endpoint=warehouse_create,
    response=WarehouseView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/warehouses/{warehouse_id}/update",
    endpoint=warehouse_update,
    response=WarehouseView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/warehouses/{warehouse_id}/authority",
    endpoint=warehouse_grant,
    response=WarehouseView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tool-categories",
    endpoint=categories_list,
    response=CategoryPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-categories",
    endpoint=category_create,
    response=CategoryView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-categories/{category_id}/update",
    endpoint=category_update,
    response=CategoryView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tool-models",
    endpoint=models_list,
    response=ModelPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-models",
    endpoint=model_create,
    response=ModelView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-models/{model_id}/update",
    endpoint=model_update,
    response=ModelView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools",
    endpoint=asset_register,
    response={200: AssetView, 201: AssetView},
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/update",
    endpoint=asset_update,
    response=AssetView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tools/{asset_id}/stewardship",
    endpoint=stewardship_update,
    response=AssetView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/tool-registration-policy",
    endpoint=registration_policy_read,
    response=RegistrationPolicyView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/tool-registration-policy",
    endpoint=registration_policy_update,
    response=RegistrationPolicyView,
)
