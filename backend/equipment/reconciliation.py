from backend_platform.api import conflict, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import CompanyMembership
from companies.revisions import expect_revision
from evidence.files import claim_file

from .access import active_warehouse, lock_asset
from .handoffs import current_custody, move_custody
from .models import CustodyHandoff, ReconciliationAttachment, ReconciliationCase


@transaction.atomic
def open_case(identity, company_id, asset_id, data):
    member = authorize_write(identity, company_id, "reconciliation.manage")
    asset = lock_asset(company_id, asset_id)
    result = ReconciliationCase.objects.create(
        company_id=company_id,
        asset=asset,
        kind=data.kind,
        opened_by=member,
        narrative=data.narrative,
    )
    record_company_event(
        identity,
        company_id,
        "equipment.reconciliation.opened",
        result,
        metadata={"asset_id": str(asset.pk)},
    )
    return result


@transaction.atomic
def resolve_case(identity, company_id, case_id, data):
    member = authorize_write(
        identity,
        company_id,
        "reconciliation.manage",
        related_members=[data.destination_membership_id],
    )
    reference = ReconciliationCase.objects.filter(company_id=company_id, pk=case_id).first()
    if reference is None:
        raise not_found("Reconciliation case not found.")
    asset = lock_asset(company_id, reference.asset_id)
    case = ReconciliationCase.objects.select_for_update().get(pk=case_id)
    expect_revision(case, data.expected_revision)
    if case.resolved_at:
        raise conflict("Case already resolved.", code="case_resolved")
    if data.destination_membership_id or data.destination_warehouse_id:
        expect_revision(asset, data.expected_asset_revision)
        if (
            bool(data.destination_membership_id) == bool(data.destination_warehouse_id)
            or not data.photo_id
        ):
            raise conflict(
                "A custody correction requires one destination and photo evidence.",
                code="correction_evidence_required",
            )
        if asset.lifecycle != "active":
            raise conflict(
                "Only active assets can have custody corrected.", code="asset_not_active"
            )
        if CustodyHandoff.objects.filter(asset=asset, status="pending").exists():
            raise conflict("Resolve the pending handoff first.", code="handoff_pending")
        if data.destination_membership_id:
            if not CompanyMembership.objects.filter(
                pk=data.destination_membership_id,
                company_id=company_id,
                access_state="active",
                ended_at__isnull=True,
            ).exists():
                raise not_found("Active destination member not found.")
        else:
            active_warehouse(company_id, data.destination_warehouse_id, lock=True)
        from .models import CustodyPeriod

        source = CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).first()
        if source:
            case.corrected_custody = move_custody(
                asset,
                current_custody(asset),
                member_id=data.destination_membership_id,
                warehouse_id=data.destination_warehouse_id,
            )
        else:
            case.corrected_custody = CustodyPeriod.objects.create(
                company_id=company_id,
                asset=asset,
                holder_membership_id=data.destination_membership_id,
                holder_warehouse_id=data.destination_warehouse_id,
                starts_at=timezone.now(),
            )
            if data.destination_warehouse_id:
                asset.responsible_warehouse_id = data.destination_warehouse_id
            asset.revision += 1
            asset.save(update_fields=["revision", "responsible_warehouse"])
    if data.photo_id:
        ReconciliationAttachment.objects.create(
            company_id=company_id,
            case=case,
            file=claim_file(member, data.photo_id, "reconciliation"),
        )
    case.resolved_at = timezone.now()
    case.resolved_by = member
    case.resolution_note = data.note
    case.revision += 1
    case.save()
    record_company_event(
        identity,
        company_id,
        "equipment.reconciliation.resolved",
        case,
        metadata={"asset_id": str(asset.pk)},
    )
    return case
