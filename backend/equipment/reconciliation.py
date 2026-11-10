"""Reconciliation: fixing tool records that don't match what is really on hand.

Each case kind has its own outcomes, and each outcome changes only what it says:

- duplicate_asset: ``merge`` keeps one record and retires the other, or ``not_duplicate``.
- missing_asset: ``found`` moves custody to where it turned up, or ``write_off`` disposes of it.
- custody_dispute: ``move_custody`` moves it to whoever has it, or ``records_correct``.
"""

from backend_platform.api import conflict, not_found
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.models import CompanyMembership
from companies.revisions import expect_revision
from evidence.files import claim_file

from .access import active_warehouse, lock_asset
from .events import asset_event_metadata
from .handoffs import move_custody
from .models import (
    AssetIncident,
    AssetLifecycleEvent,
    CustodyHandoff,
    CustodyPeriod,
    ReconciliationAttachment,
    ReconciliationCase,
    ToolRequest,
)

OUTCOMES = {
    "duplicate_asset": ("merge", "not_duplicate"),
    "missing_asset": ("found", "write_off"),
    "custody_dispute": ("move_custody", "records_correct"),
}


def record_summary(asset):
    """What a person needs to tell two units apart: photo, model, serial, holder, registered."""
    if asset is None:
        return None
    custody = (
        CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True)
        .select_related("holder_membership__person", "holder_warehouse")
        .first()
    )
    holder = None
    if custody:
        holder = (
            custody.holder_membership.person.preferred_name
            if custody.holder_membership_id
            else custody.holder_warehouse.name
        )
    return {
        "id": asset.pk,
        "name": asset.tool_model.name,
        "manufacturer": asset.tool_model.manufacturer,
        "model_number": asset.tool_model.model_number,
        "serial_number": asset.serial_number or None,
        "registration_photo_id": asset.registration_photo_id,
        "registered_at": asset.registered_at,
        "holder_name": holder,
        "lifecycle": asset.lifecycle,
        "revision": asset.revision,
    }


@transaction.atomic
def open_case(identity, company_id, asset_id, data):
    member = authorize_write(identity, company_id, "reconciliation.manage")
    duplicate_id = data.duplicate_of_id if data.kind == "duplicate_asset" else None
    if data.kind == "duplicate_asset" and not duplicate_id:
        raise conflict(
            "Choose the other tool record this one duplicates.", code="duplicate_required"
        )
    if data.kind != "duplicate_asset" and data.duplicate_of_id:
        raise conflict(
            "Only a duplicate case names another tool record.", code="duplicate_not_allowed"
        )
    if duplicate_id == asset_id:
        raise conflict("A tool record cannot duplicate itself.", code="duplicate_self")
    # Lock both units in one order so two cases opened at once never deadlock.
    locked = {
        pk: lock_asset(company_id, pk) for pk in sorted({asset_id, duplicate_id} - {None}, key=str)
    }
    asset = locked[asset_id]
    if any(unit.lifecycle == "disposed" for unit in locked.values()):
        raise conflict("Disposed tools are already out of circulation.", code="asset_disposed")
    result = ReconciliationCase.objects.create(
        company_id=company_id,
        asset=asset,
        duplicate_of=locked.get(duplicate_id),
        kind=data.kind,
        opened_by=member,
        narrative=data.narrative,
    )
    record_company_event(
        identity,
        company_id,
        "equipment.reconciliation.opened",
        result,
        metadata=asset_event_metadata(asset, kind=data.kind),
    )
    return result


def _ensure_no_pending_movement(asset):
    if CustodyHandoff.objects.filter(asset=asset, status="pending").exists():
        raise conflict(
            f"{asset.tool_model.name} has a pending handoff. Resolve it first.",
            code="handoff_pending",
        )


def _destination(company_id, data):
    if bool(data.destination_membership_id) == bool(data.destination_warehouse_id):
        raise conflict("Choose one person or one warehouse.", code="invalid_destination")
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
    return data.destination_membership_id, data.destination_warehouse_id


def _correct_custody(case, asset, data):
    """Put the unit with the chosen holder. Returns the new period, or None if already there."""
    expect_revision(asset, data.expected_asset_revision)
    if asset.lifecycle != "active":
        raise conflict("Only active tools can have custody corrected.", code="asset_not_active")
    _ensure_no_pending_movement(asset)
    member_id, warehouse_id = _destination(case.company_id, data)
    source = CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).first()
    if source and (source.holder_membership_id, source.holder_warehouse_id) == (
        member_id,
        warehouse_id,
    ):
        asset.revision += 1
        asset.save(update_fields=["revision"])
        return None
    if source:
        return move_custody(asset, source, member_id=member_id, warehouse_id=warehouse_id)
    period = CustodyPeriod.objects.create(
        company_id=case.company_id,
        asset=asset,
        holder_membership_id=member_id,
        holder_warehouse_id=warehouse_id,
        starts_at=timezone.now(),
    )
    if warehouse_id:
        asset.responsible_warehouse_id = warehouse_id
    asset.revision += 1
    asset.save(update_fields=["revision", "responsible_warehouse"])
    return period


def _close_incidents(asset, member, note, kinds=("missing",)):
    AssetIncident.objects.filter(asset=asset, kind__in=kinds, resolved_at__isnull=True).update(
        resolved_at=timezone.now(),
        resolved_by=member,
        resolution_note=note,
        revision=F("revision") + 1,
    )


def _dispose(asset, member, reason):
    """Take a unit out of circulation the way the lifecycle command disposes of one."""
    event = AssetLifecycleEvent.objects.create(
        company_id=asset.company_id,
        asset=asset,
        actor=member,
        from_lifecycle=asset.lifecycle,
        to_lifecycle="disposed",
        reason=reason,
    )
    ToolRequest.objects.filter(asset=asset, status__in=["pending", "approved"]).update(
        status="rejected",
        decided_at=timezone.now(),
        decided_by=member,
        decision_note=reason,
        revision=F("revision") + 1,
    )
    CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).update(ends_at=timezone.now())
    asset.lifecycle = "disposed"
    asset.revision += 1
    asset.save(update_fields=["lifecycle", "revision"])
    return event


def _describe(asset):
    serial = f", serial {asset.serial_number}" if asset.serial_number else ""
    return f"{asset.tool_model.name}{serial}, registered {asset.registered_at:%b %d, %Y}"


def _merge(identity, member, case, asset, other, data):
    if case.duplicate_of_id is None:
        raise conflict(
            "This case does not name the other record. Open a new duplicate case from the tool.",
            code="duplicate_unknown",
        )
    if data.keep_asset_id not in (case.asset_id, case.duplicate_of_id):
        raise conflict("Keep one of the two records in this case.", code="invalid_keep")
    expect_revision(asset, data.expected_asset_revision)
    expect_revision(other, data.expected_duplicate_revision)
    kept, removed = (asset, other) if data.keep_asset_id == asset.pk else (other, asset)
    for unit in (kept, removed):
        if unit.lifecycle == "disposed":
            raise conflict(f"{unit.tool_model.name} is already disposed.", code="asset_disposed")
        _ensure_no_pending_movement(unit)
        if ToolRequest.objects.filter(asset=unit, status__in=["pending", "approved"]).exists():
            raise conflict(
                f"{unit.tool_model.name} has an open request. Decide it first.",
                code="request_pending",
            )
    carried = []
    if not kept.registration_photo_id and removed.registration_photo_id:
        kept.registration_photo_id = removed.registration_photo_id
        carried.append("registration_photo")
    if not kept.serial_number and removed.serial_number:
        kept.serial_number = removed.serial_number
        carried.append("serial_number")
    kept.revision += 1
    kept.save(update_fields=["registration_photo", "serial_number", "revision"])
    reason = f"Merged into {_describe(kept)}."
    if data.note:
        reason = f"{reason} {data.note}"
    _close_incidents(removed, member, reason, kinds=("missing", "damage"))
    _dispose(removed, member, reason)
    record_company_event(
        identity,
        case.company_id,
        "equipment.reconciliation.merged",
        removed,
        metadata=asset_event_metadata(
            removed,
            merged_into_id=str(kept.pk),
            merged_into=_describe(kept),
            carried_over=carried,
        ),
    )
    return kept


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
    # Lock the units in one order; a merge touches both.
    units = sorted({reference.asset_id, reference.duplicate_of_id} - {None}, key=str)
    locked = {pk: lock_asset(company_id, pk) for pk in units}
    asset = locked[reference.asset_id]
    case = ReconciliationCase.objects.select_for_update().get(pk=case_id)
    expect_revision(case, data.expected_revision)
    if case.resolved_at:
        raise conflict("Case already resolved.", code="case_resolved")
    if data.outcome not in OUTCOMES[case.kind]:
        raise conflict("That outcome does not apply to this kind of case.", code="invalid_outcome")
    if data.outcome == "merge":
        _merge(identity, member, case, asset, locked.get(case.duplicate_of_id), data)
    elif data.outcome in ("found", "move_custody"):
        case.corrected_custody = _correct_custody(case, asset, data)
        if data.outcome == "found":
            _close_incidents(asset, member, data.note or "Found during reconciliation.")
    elif data.outcome == "write_off":
        expect_revision(asset, data.expected_asset_revision)
        if asset.lifecycle == "disposed":
            raise conflict("This tool is already disposed.", code="asset_disposed")
        _ensure_no_pending_movement(asset)
        reason = data.note or "Written off as lost."
        _close_incidents(asset, member, reason)
        event = _dispose(asset, member, reason)
        record_company_event(
            identity,
            company_id,
            "equipment.asset.lifecycle_changed",
            event,
            metadata=asset_event_metadata(asset, lifecycle="disposed"),
        )
    if data.photo_id:
        ReconciliationAttachment.objects.create(
            company_id=company_id,
            case=case,
            file=claim_file(member, data.photo_id, "reconciliation"),
        )
    case.outcome = data.outcome
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
        metadata=asset_event_metadata(asset, outcome=data.outcome),
    )
    return case
