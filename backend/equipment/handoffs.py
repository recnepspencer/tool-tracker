from backend_platform.api import conflict, forbidden, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import CompanyMembership
from companies.revisions import expect_revision
from evidence.files import claim_file

from .access import active_warehouse, lock_asset, require_warehouse_authority
from .models import AssetIncident, CustodyHandoff, CustodyPeriod, HandoffAttachment, ToolRequest


def current_custody(asset):
    result = CustodyPeriod.objects.filter(
        asset=asset, ends_at__isnull=True, starts_at__lte=timezone.now()
    ).first()
    if result is None:
        raise conflict("Tool has no current custody; reconcile it first.", code="custody_missing")
    return result


def ensure_transferable(asset, *, to_warehouse=False):
    if (
        asset.lifecycle != "active"
        or AssetIncident.objects.filter(
            asset=asset, kind="missing", resolved_at__isnull=True
        ).exists()
    ):
        raise conflict(
            "Inactive or missing tools cannot be handed off.", code="asset_not_transferable"
        )
    if not to_warehouse and asset.serviceability != "serviceable":
        raise conflict(
            "Unserviceable tools may only be returned to a warehouse.", code="asset_not_serviceable"
        )


def move_custody(asset, previous, *, member_id=None, warehouse_id=None):
    """Called only under the asset lock; authorization is owned by the command."""
    boundary = timezone.now()
    previous.ends_at = boundary
    previous.save(update_fields=["ends_at"])
    result = CustodyPeriod.objects.create(
        company_id=asset.company_id,
        asset=asset,
        holder_membership_id=member_id,
        holder_warehouse_id=warehouse_id,
        starts_at=boundary,
    )
    if warehouse_id:
        asset.responsible_warehouse_id = warehouse_id
    asset.revision += 1
    asset.save(update_fields=["responsible_warehouse", "revision"])
    return result


@transaction.atomic
def propose_handoff(identity, company_id, asset_id, data):
    member = authorize_write(
        identity, company_id, "tools.transfer", related_members=[data.destination_membership_id]
    )
    previous = CustodyHandoff.objects.filter(
        proposed_by=member, request_key=data.request_key
    ).first()
    if previous:
        photo_ids = list(
            HandoffAttachment.objects.filter(handoff=previous).values_list("file_id", flat=True)
        )
        if (
            previous.asset_id,
            previous.destination_membership_id,
            previous.destination_warehouse_id,
            previous.note,
            photo_ids,
        ) != (
            asset_id,
            data.destination_membership_id,
            data.destination_warehouse_id,
            data.note,
            [data.photo_id] if data.photo_id else [],
        ):
            raise conflict("Handoff key was used for different input.", code="request_key_reused")
        return previous, False
    asset = lock_asset(company_id, asset_id)
    expect_revision(asset, data.expected_revision)
    source = current_custody(asset)
    if source.holder_warehouse_id:
        require_warehouse_authority(member, source.holder_warehouse_id)
    elif source.holder_membership_id != member.pk:
        raise forbidden("Only the accountable holder can propose this transfer.")
    if bool(data.destination_membership_id) == bool(data.destination_warehouse_id):
        raise conflict("Choose exactly one destination.", code="invalid_destination")
    if data.destination_membership_id:
        destination = CompanyMembership.objects.filter(
            pk=data.destination_membership_id,
            company_id=company_id,
            access_state="active",
            ended_at__isnull=True,
        ).first()
        if not destination:
            raise not_found("Active destination member not found.")
    else:
        active_warehouse(company_id, data.destination_warehouse_id, lock=True)
    if (source.holder_membership_id, source.holder_warehouse_id) == (
        data.destination_membership_id,
        data.destination_warehouse_id,
    ):
        raise conflict("Tool is already held by this destination.", code="same_holder")
    ensure_transferable(asset, to_warehouse=bool(data.destination_warehouse_id))
    if CustodyHandoff.objects.filter(asset=asset, status="pending").exists():
        raise conflict("Tool already has a pending handoff.", code="handoff_pending")
    result = CustodyHandoff.objects.create(
        company_id=company_id,
        asset=asset,
        source_custody=source,
        destination_membership_id=data.destination_membership_id,
        destination_warehouse_id=data.destination_warehouse_id,
        proposed_by=member,
        request_key=data.request_key,
        note=data.note,
    )
    if data.photo_id:
        HandoffAttachment.objects.create(
            company_id=company_id, handoff=result, file=claim_file(member, data.photo_id, "handoff")
        )
    asset.revision += 1
    asset.save(update_fields=["revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.handoff.proposed",
        result,
        metadata={"asset_id": str(asset.pk)},
    )
    return result, True


@transaction.atomic
def resolve_handoff(identity, company_id, handoff_id, action, data):
    member = authorize_write(identity, company_id, "tools.transfer")
    reference = CustodyHandoff.objects.filter(company_id=company_id, pk=handoff_id).first()
    if reference is None:
        raise not_found("Handoff not found.")
    asset = lock_asset(company_id, reference.asset_id)
    handoff = CustodyHandoff.objects.select_for_update().get(pk=handoff_id)
    if action == "cancel":
        if handoff.proposed_by_id != member.pk:
            raise forbidden("Only the proposer may cancel this handoff.")
        target = "cancelled"
    else:
        if handoff.destination_warehouse_id:
            require_warehouse_authority(member, handoff.destination_warehouse_id)
        elif handoff.destination_membership_id != member.pk:
            raise forbidden("Only the receiving member may accept or decline.")
        target = "accepted" if action == "accept" else "declined"
    if handoff.status == target:
        return handoff
    expect_revision(handoff, data.expected_revision)
    if handoff.status != "pending":
        raise conflict("Handoff is already resolved.", code="handoff_resolved")
    if action == "accept":
        ensure_transferable(asset, to_warehouse=bool(handoff.destination_warehouse_id))
        source = current_custody(asset)
        if source.pk != handoff.source_custody_id:
            raise conflict("The source custody has changed.", code="stale_custody")
        if handoff.destination_warehouse_id:
            active_warehouse(company_id, handoff.destination_warehouse_id, lock=True)
        move_custody(
            asset,
            source,
            member_id=handoff.destination_membership_id,
            warehouse_id=handoff.destination_warehouse_id,
        )
    else:
        asset.revision += 1
        asset.save(update_fields=["revision"])
    handoff.status = target
    handoff.resolved_at = timezone.now()
    handoff.resolved_by = member
    handoff.resolution_note = data.note
    handoff.revision += 1
    handoff.save()
    if handoff.tool_request_id:
        request = ToolRequest.objects.select_for_update().get(pk=handoff.tool_request_id)
        request.status = "fulfilled" if target == "accepted" else "rejected"
        request.decision_note = data.note
        request.revision += 1
        request.save()
    record_company_event(
        identity,
        company_id,
        f"equipment.handoff.{target}",
        handoff,
        metadata={"asset_id": str(asset.pk)},
    )
    return handoff
