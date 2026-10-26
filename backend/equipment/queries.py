from backend_platform.api import not_found
from django.db.models import Exists, OuterRef, Q, Subquery
from django.utils import timezone

from companies.access import require_member

from .models import AssetIncident, CustodyPeriod, ToolAsset, ToolRequest


def assets_with_availability(company_id):
    custody = CustodyPeriod.objects.filter(
        asset_id=OuterRef("pk"), ends_at__isnull=True, starts_at__lte=timezone.now()
    )
    missing = AssetIncident.objects.filter(
        asset_id=OuterRef("pk"), kind="missing", resolved_at__isnull=True
    )
    return (
        ToolAsset.objects.filter(company_id=company_id)
        .select_related("tool_model__category")
        .annotate(
            current_custody_id=Subquery(custody.values("id")[:1]),
            current_custody_started_at=Subquery(custody.values("starts_at")[:1]),
            warehouse_id=Subquery(custody.values("holder_warehouse_id")[:1]),
            holder_membership_id=Subquery(custody.values("holder_membership_id")[:1]),
            warehouse_archived_at=Subquery(custody.values("holder_warehouse__archived_at")[:1]),
            is_missing=Exists(missing),
        )
    )


def unavailable_reason(asset):
    if asset.lifecycle != "active":
        return "asset_not_active"
    if asset.is_missing:
        return "asset_missing"
    if asset.serviceability != "serviceable":
        return "asset_not_serviceable"
    if asset.warehouse_id is None:
        return "asset_not_at_warehouse"
    if asset.warehouse_archived_at is not None:
        return "warehouse_archived"
    return None


def list_assets(
    identity, company_id, *, limit, offset, search="", warehouse_id=None, holder_membership_id=None
):
    require_member(identity, company_id, "tools.read")
    query = assets_with_availability(company_id)
    if search:
        text = search[:200]
        query = query.filter(
            Q(asset_tag__icontains=text)
            | Q(serial_number__icontains=text)
            | Q(tool_model__name__icontains=text)
            | Q(tool_model__manufacturer__icontains=text)
            | Q(tool_model__model_number__icontains=text)
        )
    if warehouse_id:
        query = query.filter(warehouse_id=warehouse_id)
    if holder_membership_id:
        query = query.filter(holder_membership_id=holder_membership_id)
    rows = list(query.order_by("asset_tag", "id")[offset : offset + limit + 1])
    return {
        "items": [asset_view(asset) for asset in rows[:limit]],
        "next_offset": offset + limit if len(rows) > limit else None,
    }


def asset_view(asset):
    reason = unavailable_reason(asset)
    return {
        "id": asset.id,
        "asset_tag": asset.asset_tag,
        "serial_number": asset.serial_number,
        "tool_model_id": asset.tool_model_id,
        "category_id": asset.tool_model.category_id,
        "category_name": asset.tool_model.category.name,
        "custody_started_at": asset.current_custody_started_at,
        "name": asset.tool_model.name,
        "manufacturer": asset.tool_model.manufacturer,
        "model_number": asset.tool_model.model_number,
        "lifecycle": asset.lifecycle,
        "serviceability": asset.serviceability,
        "missing": asset.is_missing,
        "warehouse_id": asset.warehouse_id,
        "requestable": reason is None,
        "unavailable_reason": reason,
        "revision": asset.revision,
        "holder_membership_id": asset.holder_membership_id,
        "responsible_warehouse_id": asset.responsible_warehouse_id,
        "registration_photo_id": asset.registration_photo_id,
    }


def read_request(identity, company_id, request_id):
    member = require_member(identity, company_id, "tools.request")
    result = ToolRequest.objects.filter(
        pk=request_id, company_id=company_id, requester=member
    ).first()
    if result is None:
        raise not_found("Tool request not found.")
    return result
