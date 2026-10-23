from backend_platform.api import conflict, not_found
from backend_platform.audit import AuditActor, AuditSubject, build_audit_event, record_audit_event
from django.db import transaction

from companies.access import require_member

from .models import ToolAsset, ToolRequest, Warehouse
from .queries import assets_with_availability, unavailable_reason


@transaction.atomic
def request_tool(*, identity, company_id, asset_id, request_key, note):
    # Global write order for this slice: membership, asset, warehouse.
    # Future role/access writers lock their membership; custody/condition writers
    # lock their asset. Requests never modify custody or claim a reservation.
    member = require_member(identity, company_id, "tools.request", lock=True)
    note = note.strip()
    previous = ToolRequest.objects.filter(requester=member, request_key=request_key).first()
    if previous is not None:
        if previous.asset_id != asset_id or previous.note != note:
            raise conflict("Request key was used for different input.", code="request_key_reused")
        return previous, False

    asset = ToolAsset.objects.select_for_update().filter(pk=asset_id, company_id=company_id).first()
    if asset is None:
        raise not_found("Tool not found.")
    # At READ COMMITTED, subqueries in a waiting SELECT FOR UPDATE can retain
    # the pre-lock snapshot. Read related custody/incidents in a new statement
    # after the asset lock has actually been acquired.
    asset = assets_with_availability(company_id).get(pk=asset.id)
    if asset.warehouse_id is not None:
        warehouse = Warehouse.objects.select_for_update().get(pk=asset.warehouse_id)
        asset.warehouse_archived_at = warehouse.archived_at
    reason = unavailable_reason(asset)
    if reason is not None:
        raise conflict("This tool cannot currently be requested.", code=reason)
    existing = ToolRequest.objects.filter(
        requester=member, asset=asset, status__in=["pending", "approved"]
    ).first()
    if existing is not None:
        raise conflict(
            "You already have an open request for this tool.",
            code="request_already_open",
            detail={"request_id": str(existing.id)},
        )
    result = ToolRequest.objects.create(
        company_id=company_id,
        requester=member,
        asset=asset,
        source_custody_id=asset.current_custody_id,
        request_key=request_key,
        note=note,
    )
    actor_id = identity.actor_user_id or identity.user_id
    record_audit_event(
        build_audit_event(
            event_key="equipment.tool.requested",
            subject=AuditSubject(
                domain="equipment", entity_type="tool_request", entity_id=str(result.id)
            ),
            actor=AuditActor(
                user_id=actor_id,
                email=identity.actor_email or identity.email,
                principal_id=identity.principal_id or actor_id,
                effective_user_id=identity.user_id,
                effective_email=identity.email,
                is_impersonating=identity.is_impersonating,
            ),
            metadata={
                "company_id": str(company_id),
                "asset_id": str(asset.id),
                "requester_id": str(member.id),
                "source_custody_id": str(asset.current_custody_id),
            },
        )
    )
    return result, True
