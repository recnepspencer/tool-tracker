from backend_platform.api import forbidden, not_found

from companies.access import capabilities

from .models import ToolAsset, Warehouse, WarehouseRoleGrant


def manages_warehouse(member, warehouse_id):
    return (
        "tools.manage" in capabilities(member)
        or WarehouseRoleGrant.objects.filter(
            company_id=member.company_id,
            membership=member,
            warehouse_id=warehouse_id,
            revoked_at__isnull=True,
        ).exists()
    )


def require_warehouse_authority(member, warehouse_id):
    if not manages_warehouse(member, warehouse_id):
        raise forbidden("Warehouse authority is required.", code="warehouse_authority_required")


def lock_asset(company_id, asset_id):
    asset = ToolAsset.objects.select_for_update().filter(company_id=company_id, pk=asset_id).first()
    if asset is None:
        raise not_found("Tool not found.")
    return asset


def active_warehouse(company_id, warehouse_id, *, lock=False):
    query = Warehouse.objects.select_for_update() if lock else Warehouse.objects
    warehouse = query.filter(
        company_id=company_id, pk=warehouse_id, archived_at__isnull=True
    ).first()
    if warehouse is None:
        raise not_found("Active warehouse not found.")
    return warehouse
