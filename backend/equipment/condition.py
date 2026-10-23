from backend_platform.api import conflict, forbidden, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write
from companies.audit import record_company_event
from companies.revisions import expect_revision
from evidence.files import claim_file

from .access import lock_asset, manages_warehouse, require_warehouse_authority
from .handoffs import current_custody
from .models import (
    AssetIncident,
    AssetLifecycleEvent,
    AssetServiceEvent,
    CustodyHandoff,
    IncidentAttachment,
    ServiceEventAttachment,
    ToolRequest,
)


@transaction.atomic
def report_incident(identity, company_id, asset_id, data):
    member = authorize_write(identity, company_id, "tools.report")
    asset = lock_asset(company_id, asset_id)
    expect_revision(asset, data.expected_revision)
    source = current_custody(asset)
    if source.holder_membership_id != member.pk and not manages_warehouse(
        member, asset.responsible_warehouse_id
    ):
        raise forbidden("Only the holder or an authorized manager may report this tool.")
    if asset.lifecycle != "active":
        raise conflict("Only active tools can be reported.", code="asset_not_active")
    if AssetIncident.objects.filter(asset=asset, kind=data.kind, resolved_at__isnull=True).exists():
        raise conflict("This kind of incident is already open.", code="incident_already_open")
    incident = AssetIncident.objects.create(
        company_id=company_id,
        asset=asset,
        kind=data.kind,
        description=data.description,
        reported_by=member,
    )
    if data.photo_id:
        IncidentAttachment.objects.create(
            company_id=company_id,
            incident=incident,
            file=claim_file(member, data.photo_id, "incident"),
        )
    if data.kind == "damage":
        asset.serviceability = "damaged"
    asset.revision += 1
    asset.save(update_fields=["serviceability", "revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.incident.reported",
        incident,
        metadata={"asset_id": str(asset.pk), "kind": data.kind},
    )
    return incident


@transaction.atomic
def resolve_missing(identity, company_id, incident_id, data):
    member = authorize_write(identity, company_id, "tools.read")
    reference = AssetIncident.objects.filter(
        company_id=company_id, pk=incident_id, kind="missing"
    ).first()
    if reference is None:
        raise not_found("Missing-asset incident not found.")
    asset = lock_asset(company_id, reference.asset_id)
    require_warehouse_authority(member, asset.responsible_warehouse_id)
    incident = AssetIncident.objects.select_for_update().get(pk=incident_id)
    if incident.resolved_at:
        return incident
    expect_revision(incident, data.expected_revision)
    incident.resolved_at = timezone.now()
    incident.resolved_by = member
    incident.resolution_note = data.note
    incident.revision += 1
    incident.save()
    asset.revision += 1
    asset.save(update_fields=["revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.incident.found",
        incident,
        metadata={"asset_id": str(asset.pk)},
    )
    return incident


@transaction.atomic
def record_service(identity, company_id, asset_id, data):
    member = authorize_write(identity, company_id, "tools.read")
    asset = lock_asset(company_id, asset_id)
    require_warehouse_authority(member, asset.responsible_warehouse_id)
    expect_revision(asset, data.expected_revision)
    if asset.lifecycle == "disposed":
        raise conflict("Disposed tools cannot be serviced.", code="asset_disposed")
    event = AssetServiceEvent.objects.create(
        company_id=company_id,
        asset=asset,
        performed_by=member,
        resulting_serviceability=data.serviceability,
        note=data.note,
    )
    if data.photo_id:
        ServiceEventAttachment.objects.create(
            company_id=company_id, event=event, file=claim_file(member, data.photo_id, "service")
        )
    if data.serviceability == "serviceable":
        from django.db.models import F

        AssetIncident.objects.filter(asset=asset, kind="damage", resolved_at__isnull=True).update(
            resolved_at=timezone.now(),
            resolved_by=member,
            resolution_note=data.note,
            revision=F("revision") + 1,
        )
    asset.serviceability = data.serviceability
    asset.revision += 1
    asset.save(update_fields=["serviceability", "revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.asset.serviced",
        event,
        metadata={"asset_id": str(asset.pk)},
    )
    return event


@transaction.atomic
def change_lifecycle(identity, company_id, asset_id, data):
    member = authorize_write(identity, company_id, "tools.read")
    asset = lock_asset(company_id, asset_id)
    require_warehouse_authority(member, asset.responsible_warehouse_id)
    expect_revision(asset, data.expected_revision)
    if asset.lifecycle == "disposed" or asset.lifecycle == data.lifecycle:
        raise conflict(
            "This lifecycle transition is not allowed.", code="invalid_lifecycle_transition"
        )
    if AssetIncident.objects.filter(asset=asset, kind="missing", resolved_at__isnull=True).exists():
        raise conflict(
            "Resolve missing accountability before changing lifecycle.", code="asset_missing"
        )
    source = current_custody(asset)
    if not source.holder_warehouse_id:
        raise conflict(
            "Receive the tool at a warehouse before changing lifecycle.",
            code="asset_not_at_warehouse",
        )
    if CustodyHandoff.objects.filter(asset=asset, status="pending").exists():
        raise conflict("Resolve the pending handoff first.", code="handoff_pending")
    event = AssetLifecycleEvent.objects.create(
        company_id=company_id,
        asset=asset,
        actor=member,
        from_lifecycle=asset.lifecycle,
        to_lifecycle=data.lifecycle,
        reason=data.note,
    )
    if data.lifecycle != "active":
        from django.db.models import F

        ToolRequest.objects.filter(asset=asset, status__in=["pending", "approved"]).update(
            status="rejected",
            decided_at=timezone.now(),
            decided_by=member,
            decision_note=data.note,
            revision=F("revision") + 1,
        )
    if data.lifecycle == "disposed":
        source.ends_at = timezone.now()
        source.save(update_fields=["ends_at"])
    asset.lifecycle = data.lifecycle
    asset.revision += 1
    asset.save(update_fields=["lifecycle", "revision"])
    record_company_event(
        identity,
        company_id,
        "equipment.asset.lifecycle_changed",
        event,
        metadata={"asset_id": str(asset.pk), "lifecycle": data.lifecycle},
    )
    return asset
