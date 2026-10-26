from backend_platform.api import conflict, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write, capabilities
from companies.audit import record_company_event
from companies.models import Company, CompanyMembership
from companies.revisions import expect_revision

from .access import active_warehouse, lock_asset
from .events import asset_event_metadata
from .models import (
    CustodyHandoff,
    CustodyPeriod,
    ToolAsset,
    ToolCategory,
    ToolModel,
    Warehouse,
    WarehouseRoleGrant,
)


@transaction.atomic
def create_warehouse(identity, company_id, data):
    authorize_write(identity, company_id, "warehouses.manage")
    Company.objects.select_for_update().get(pk=company_id)
    if Warehouse.objects.filter(company_id=company_id, code=data.code).exists():
        raise conflict("Warehouse code already exists.", code="warehouse_code_exists")
    result = Warehouse.objects.create(
        company_id=company_id, code=data.code, name=data.name, address=data.address
    )
    record_company_event(
        identity,
        company_id,
        "equipment.warehouse.created",
        result,
        metadata={"warehouse_id": str(result.pk)},
    )
    return result


@transaction.atomic
def update_warehouse(identity, company_id, warehouse_id, data):
    authorize_write(identity, company_id, "warehouses.manage")
    result = (
        Warehouse.objects.select_for_update().filter(company_id=company_id, pk=warehouse_id).first()
    )
    if result is None:
        raise not_found("Warehouse not found.")
    expect_revision(result, data.expected_revision)
    if data.archived and (
        CustodyPeriod.objects.filter(holder_warehouse=result, ends_at__isnull=True).exists()
        or ToolAsset.objects.filter(responsible_warehouse=result, lifecycle="active").exists()
        or CustodyHandoff.objects.filter(destination_warehouse=result, status="pending").exists()
    ):
        raise conflict(
            "Resolve warehouse custody, stewardship, and pending receipts first.",
            code="warehouse_in_use",
        )
    result.name, result.address = data.name, data.address
    result.archived_at = (result.archived_at or timezone.now()) if data.archived else None
    result.revision += 1
    result.save()
    record_company_event(
        identity,
        company_id,
        "equipment.warehouse.updated",
        result,
        metadata={"warehouse_id": str(result.pk)},
    )
    return result


@transaction.atomic
def set_warehouse_grant(identity, company_id, warehouse_id, data):
    actor = authorize_write(
        identity, company_id, "people.manage", related_members=[data.membership_id]
    )
    warehouse = (
        Warehouse.objects.select_for_update().filter(company_id=company_id, pk=warehouse_id).first()
    )
    if warehouse is None:
        raise not_found("Warehouse not found.")
    expect_revision(warehouse, data.expected_revision)
    subject = CompanyMembership.objects.filter(company_id=company_id, pk=data.membership_id).first()
    if subject is None:
        raise not_found("Membership not found.")
    if data.enabled:
        if (
            warehouse.archived_at
            or subject.access_state != "active"
            or subject.ended_at
            or "tools.transfer" not in capabilities(subject)
        ):
            raise conflict(
                "Choose an active equipment member and warehouse.",
                code="warehouse_manager_ineligible",
            )
        WarehouseRoleGrant.objects.get_or_create(
            company_id=company_id,
            warehouse=warehouse,
            membership=subject,
            revoked_at=None,
            defaults={"granted_by": actor},
        )
    else:
        WarehouseRoleGrant.objects.filter(
            warehouse=warehouse, membership=subject, revoked_at__isnull=True
        ).update(revoked_at=timezone.now())
    warehouse.revision += 1
    warehouse.save(update_fields=["revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.warehouse.authority_changed",
        warehouse,
        metadata={
            "warehouse_id": str(warehouse.pk),
            "membership_id": str(subject.pk),
            "enabled": data.enabled,
        },
    )
    return warehouse


@transaction.atomic
def create_category(identity, company_id, name):
    authorize_write(identity, company_id, "catalog.manage")
    Company.objects.select_for_update().get(pk=company_id)
    if ToolCategory.objects.filter(company_id=company_id, name__iexact=name).exists():
        raise conflict("Category already exists.", code="category_exists")
    result = ToolCategory.objects.create(company_id=company_id, name=name)
    record_company_event(identity, company_id, "equipment.category.created", result)
    return result


@transaction.atomic
def update_category(identity, company_id, category_id, data):
    authorize_write(identity, company_id, "catalog.manage")
    Company.objects.select_for_update().get(pk=company_id)
    result = (
        ToolCategory.objects.select_for_update()
        .filter(company_id=company_id, pk=category_id)
        .first()
    )
    if result is None:
        raise not_found("Category not found.")
    expect_revision(result, data.expected_revision)
    if (
        ToolCategory.objects.filter(company_id=company_id, name__iexact=data.name)
        .exclude(pk=result.pk)
        .exists()
    ):
        raise conflict("Category already exists.", code="category_exists")
    result.name = data.name
    result.archived_at = (result.archived_at or timezone.now()) if data.archived else None
    result.revision += 1
    result.save()
    record_company_event(identity, company_id, "equipment.category.updated", result)
    return result


@transaction.atomic
def create_model(identity, company_id, data):
    authorize_write(identity, company_id, "catalog.manage")
    category = (
        ToolCategory.objects.select_for_update()
        .filter(company_id=company_id, pk=data.category_id, archived_at__isnull=True)
        .first()
    )
    if category is None:
        raise not_found("Active category not found.")
    result = ToolModel.objects.create(
        company_id=company_id,
        category=category,
        name=data.name,
        manufacturer=data.manufacturer,
        model_number=data.model_number,
    )
    record_company_event(identity, company_id, "equipment.model.created", result)
    return result


@transaction.atomic
def update_model(identity, company_id, model_id, data):
    authorize_write(identity, company_id, "catalog.manage")
    category = (
        ToolCategory.objects.select_for_update()
        .filter(company_id=company_id, pk=data.category_id)
        .first()
    )
    if category is None:
        raise not_found("Active category not found.")
    result = (
        ToolModel.objects.select_for_update().filter(company_id=company_id, pk=model_id).first()
    )
    if result is None:
        raise not_found("Tool model not found.")
    expect_revision(result, data.expected_revision)
    if category.archived_at and result.category_id != category.pk:
        raise conflict("Choose an active category when moving a model.", code="category_archived")
    result.category = category
    result.name, result.manufacturer, result.model_number = (
        data.name,
        data.manufacturer,
        data.model_number,
    )
    result.archived_at = (result.archived_at or timezone.now()) if data.archived else None
    result.revision += 1
    result.save()
    record_company_event(identity, company_id, "equipment.model.updated", result)
    return result


@transaction.atomic
def update_asset(identity, company_id, asset_id, data):
    authorize_write(identity, company_id, "tools.manage")
    asset = lock_asset(company_id, asset_id)
    expect_revision(asset, data.expected_revision)
    asset.serial_number = data.serial_number
    asset.revision += 1
    asset.save(update_fields=["serial_number", "revision"])
    record_company_event(
        identity, company_id, "equipment.asset.updated", asset, metadata=asset_event_metadata(asset)
    )
    return asset


@transaction.atomic
def set_stewardship(identity, company_id, asset_id, data):
    authorize_write(identity, company_id, "tools.manage")
    asset = lock_asset(company_id, asset_id)
    expect_revision(asset, data.expected_revision)
    warehouse = active_warehouse(company_id, data.warehouse_id, lock=True)
    asset.responsible_warehouse = warehouse
    asset.revision += 1
    asset.save(update_fields=["responsible_warehouse", "revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.asset.stewardship_changed",
        asset,
        metadata=asset_event_metadata(asset, reason=data.note),
    )
    return asset
