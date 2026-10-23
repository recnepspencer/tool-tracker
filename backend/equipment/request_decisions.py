from uuid import uuid4

from backend_platform.api import conflict, forbidden, not_found
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import CompanyMembership
from companies.revisions import expect_revision

from .access import active_warehouse, lock_asset, require_warehouse_authority
from .handoffs import current_custody, ensure_transferable
from .models import CustodyHandoff, ToolRequest


@transaction.atomic
def decide_request(identity, company_id, request_id, action, data):
    reference = ToolRequest.objects.filter(company_id=company_id, pk=request_id).first()
    if reference is None:
        raise not_found("Request not found.")
    member = authorize_write(
        identity, company_id, "tools.request", related_members=[reference.requester_id]
    )
    asset = lock_asset(company_id, reference.asset_id)
    result = (
        ToolRequest.objects.select_for_update().select_related("source_custody").get(pk=request_id)
    )
    if action == "withdraw":
        if result.requester_id != member.pk:
            raise forbidden("Only the requester may withdraw.")
        target = "withdrawn"
    else:
        require_warehouse_authority(member, result.source_custody.holder_warehouse_id)
        target = "approved" if action == "approve" else "rejected"
    if result.status == target:
        return result
    expect_revision(result, data.expected_revision)
    if result.status not in {"pending", "approved"}:
        raise conflict("Request is already resolved.", code="request_resolved")
    if action == "approve":
        ensure_transferable(asset)
        source = current_custody(asset)
        if source.pk != result.source_custody_id:
            raise conflict("The tool's source custody changed.", code="stale_custody")
        active_warehouse(company_id, source.holder_warehouse_id, lock=True)
        if not CompanyMembership.objects.filter(
            pk=result.requester_id, access_state="active", ended_at__isnull=True
        ).exists():
            raise conflict("Requester is no longer active.", code="requester_inactive")
        if CustodyHandoff.objects.filter(asset=asset, status="pending").exists():
            raise conflict("Tool already has a pending handoff.", code="handoff_pending")
        CustodyHandoff.objects.create(
            company_id=company_id,
            asset=asset,
            source_custody=source,
            destination_membership_id=result.requester_id,
            proposed_by=member,
            tool_request=result,
            request_key=uuid4(),
            note=data.note,
        )
    else:
        CustodyHandoff.objects.filter(tool_request=result, status="pending").update(
            status="cancelled",
            resolved_at=timezone.now(),
            resolved_by=member,
            resolution_note=data.note,
            revision=F("revision") + 1,
        )
    asset.revision += 1
    asset.save(update_fields=["revision"])
    result.status = target
    result.decided_at = timezone.now()
    result.decided_by = member
    result.decision_note = data.note
    result.revision += 1
    result.save()
    record_company_event(
        identity,
        company_id,
        f"equipment.request.{target}",
        result,
        metadata={"asset_id": str(asset.pk)},
    )
    return result
