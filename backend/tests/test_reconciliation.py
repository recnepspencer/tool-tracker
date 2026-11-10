from io import BytesIO
from uuid import uuid4

import pytest
from backend_platform.jobs import run_pending_jobs
from backend_platform.models import PlatformAuditEventRecord
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from equipment.models import (
    AssetIncident,
    AssetLifecycleEvent,
    CustodyHandoff,
    CustodyPeriod,
    ReconciliationCase,
    ToolAsset,
    ToolRequest,
)
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response

OPEN_PATH = "/api/companies/{company_id}/tools/{asset_id}/reconciliations"
RESOLVE_PATH = "/api/companies/{company_id}/reconciliations/{case_id}/resolve"


@pytest.fixture
def manager(world, password_hash):
    return member_in(world.company, password_hash, "manager", name="Manager")


@pytest.fixture
def client(manager):
    return login_client(manager.user)


@pytest.fixture
def base(world):
    return f"/api/companies/{world.company.pk}"


def post(client, path, body):
    return client.post(path, body, content_type="application/json")


def open_case(client, base, asset, kind, **extra):
    response = post(client, f"{base}/tools/{asset.pk}/reconciliations", {"kind": kind, **extra})
    return assert_response(response, OPEN_PATH)


def resolve(client, base, case, body, status=200):
    response = post(
        client,
        f"{base}/reconciliations/{case['id']}/resolve",
        {"expected_revision": case["revision"], **body},
    )
    if status == 200:
        return assert_response(response, RESOLVE_PATH)
    assert response.status_code == status, response.content
    return response.json()


def open_custody(asset):
    return CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).first()


def upload_photo(client, base, purpose):
    stream = BytesIO()
    Image.new("RGB", (2, 2), "green").save(stream, format="PNG")
    return client.post(
        f"{base}/files",
        {
            "purpose": purpose,
            "file": SimpleUploadedFile("photo.png", stream.getvalue(), content_type="image/png"),
        },
    ).json()["id"]


def test_opening_needs_no_narrative_and_a_duplicate_names_the_other_record(world, client, base):
    first, second = world.assets
    dispute = open_case(client, base, first, "custody_dispute")
    assert dispute["narrative"] == ""
    assert dispute["duplicate_of_id"] is None
    assert dispute["record"]["id"] == str(first.pk)
    assert dispute["record"]["holder_name"] == world.warehouse.name

    missing = post(client, f"{base}/tools/{second.pk}/reconciliations", {"kind": "duplicate_asset"})
    assert missing.status_code == 409
    assert missing.json()["code"] == "duplicate_required"
    itself = post(
        client,
        f"{base}/tools/{second.pk}/reconciliations",
        {"kind": "duplicate_asset", "duplicate_of_id": str(second.pk)},
    )
    assert itself.status_code == 409
    assert itself.json()["code"] == "duplicate_self"
    stray = post(
        client,
        f"{base}/tools/{second.pk}/reconciliations",
        {"kind": "missing_asset", "duplicate_of_id": str(first.pk)},
    )
    assert stray.status_code == 409
    assert stray.json()["code"] == "duplicate_not_allowed"

    duplicate = open_case(client, base, second, "duplicate_asset", duplicate_of_id=str(first.pk))
    assert duplicate["duplicate_of_id"] == str(first.pk)
    assert duplicate["duplicate_record"]["id"] == str(first.pk)
    assert duplicate["duplicate_record"]["registered_at"]


def test_merge_keeps_one_record_and_retires_the_other(world, client, base, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    kept, removed = world.assets
    photo_id = upload_photo(client, base, "registration")
    ToolAsset.objects.filter(pk=removed.pk).update(
        serial_number="SN-0042", registration_photo_id=photo_id
    )
    case = open_case(client, base, removed, "duplicate_asset", duplicate_of_id=str(kept.pk))
    assert case["record"]["serial_number"] == "SN-0042"

    # The outcome must say which record to keep and carry both revisions.
    incomplete = post(
        client,
        f"{base}/reconciliations/{case['id']}/resolve",
        {"expected_revision": 1, "outcome": "merge", "keep_asset_id": str(kept.pk)},
    )
    assert incomplete.status_code == 400, incomplete.content
    wrong = resolve(
        client,
        base,
        case,
        {
            "outcome": "merge",
            "keep_asset_id": str(uuid4()),
            "expected_asset_revision": 1,
            "expected_duplicate_revision": 1,
        },
        status=409,
    )
    assert wrong["code"] == "invalid_keep"
    other_kind = resolve(client, base, case, {"outcome": "records_correct"}, status=409)
    assert other_kind["code"] == "invalid_outcome"

    result = resolve(
        client,
        base,
        case,
        {
            "outcome": "merge",
            "keep_asset_id": str(kept.pk),
            "expected_asset_revision": 1,
            "expected_duplicate_revision": 1,
        },
    )
    assert result["outcome"] == "merge"
    assert result["resolved_at"]
    kept.refresh_from_db()
    removed.refresh_from_db()
    assert removed.lifecycle == "disposed"
    assert open_custody(removed) is None
    assert kept.lifecycle == "active"
    assert open_custody(kept).holder_warehouse == world.warehouse
    assert kept.serial_number == "SN-0042"
    assert str(kept.registration_photo_id) == photo_id
    event = AssetLifecycleEvent.objects.get(asset=removed)
    assert event.to_lifecycle == "disposed"
    assert event.reason.startswith("Merged into Hammer drill, serial SN-0042")
    run_pending_jobs(limit=100)
    audit = PlatformAuditEventRecord.objects.get(event_key="equipment.reconciliation.merged")
    assert audit.metadata["asset_id"] == str(removed.pk)
    assert audit.metadata["merged_into_id"] == str(kept.pk)
    assert sorted(audit.metadata["carried_over"].split(", ")) == [
        "registration_photo",
        "serial_number",
    ]


def test_merge_refuses_units_with_a_pending_handoff_or_request(world, client, base):
    first, second = world.assets
    case = open_case(client, base, second, "duplicate_asset", duplicate_of_id=str(first.pk))
    body = {
        "outcome": "merge",
        "keep_asset_id": str(second.pk),
        "expected_asset_revision": 1,
        "expected_duplicate_revision": 1,
    }
    handoff = CustodyHandoff.objects.create(
        company=world.company,
        asset=first,
        source_custody=open_custody(first),
        destination_membership=world.member,
        proposed_by=world.member,
        request_key=uuid4(),
    )
    refused = resolve(client, base, case, body, status=409)
    assert refused["code"] == "handoff_pending"
    handoff.status = "cancelled"
    handoff.save()
    ToolRequest.objects.create(
        company=world.company,
        requester=world.member,
        asset=second,
        source_custody=open_custody(second),
        request_key=uuid4(),
    )
    refused = resolve(client, base, case, body, status=409)
    assert refused["code"] == "request_pending"
    first.refresh_from_db()
    second.refresh_from_db()
    assert first.lifecycle == second.lifecycle == "active"
    assert ReconciliationCase.objects.get(pk=case["id"]).resolved_at is None


def test_not_a_duplicate_closes_without_changes(world, client, base):
    first, second = world.assets
    case = open_case(client, base, second, "duplicate_asset", duplicate_of_id=str(first.pk))
    before = list(CustodyPeriod.objects.order_by("id").values())
    result = resolve(client, base, case, {"outcome": "not_duplicate"})
    assert result["outcome"] == "not_duplicate"
    assert result["resolution_note"] == ""
    assert list(CustodyPeriod.objects.order_by("id").values()) == before
    assert set(ToolAsset.objects.values_list("lifecycle", flat=True)) == {"active"}
    # Fields another outcome needs are refused rather than ignored.
    extra = post(
        client,
        f"{base}/reconciliations/{case['id']}/resolve",
        {"expected_revision": 2, "outcome": "not_duplicate", "keep_asset_id": str(first.pk)},
    )
    assert extra.status_code == 400, extra.content


def test_found_moves_custody_and_closes_the_missing_report(world, client, base, manager):
    asset = world.assets[0]
    AssetIncident.objects.create(
        company=world.company,
        asset=asset,
        kind="missing",
        reported_by=world.member,
        description="Not in the van",
    )
    case = open_case(client, base, asset, "missing_asset", narrative="Not in the van")
    result = resolve(
        client,
        base,
        case,
        {
            "outcome": "found",
            "expected_asset_revision": 1,
            "destination_membership_id": str(world.member.pk),
            "note": "Under the bench",
        },
    )
    assert result["outcome"] == "found"
    assert result["corrected_custody_id"]
    assert result["photo_ids"] == []
    assert open_custody(asset).holder_membership == world.member
    incident = AssetIncident.objects.get(asset=asset)
    assert incident.resolved_at is not None
    assert incident.resolved_by == manager.member


def test_found_needs_exactly_one_destination(world, client, base):
    asset = world.assets[0]
    case = open_case(client, base, asset, "missing_asset")
    path = f"{base}/reconciliations/{case['id']}/resolve"
    common = {"expected_revision": 1, "outcome": "found", "expected_asset_revision": 1}
    assert post(client, path, common).status_code == 400
    both = {
        **common,
        "destination_membership_id": str(world.member.pk),
        "destination_warehouse_id": str(world.warehouse.pk),
    }
    assert post(client, path, both).status_code == 400


def test_write_off_disposes_of_a_lost_tool(world, client, base):
    asset = world.assets[0]
    AssetIncident.objects.create(
        company=world.company,
        asset=asset,
        kind="missing",
        reported_by=world.member,
        description="Gone",
    )
    request = ToolRequest.objects.create(
        company=world.company,
        requester=world.member,
        asset=asset,
        source_custody=open_custody(asset),
        request_key=uuid4(),
    )
    case = open_case(client, base, asset, "missing_asset")
    result = resolve(client, base, case, {"outcome": "write_off", "expected_asset_revision": 1})
    assert result["outcome"] == "write_off"
    asset.refresh_from_db()
    assert asset.lifecycle == "disposed"
    assert open_custody(asset) is None
    event = AssetLifecycleEvent.objects.get(asset=asset)
    assert (event.from_lifecycle, event.to_lifecycle) == ("active", "disposed")
    assert event.reason == "Written off as lost."
    assert AssetIncident.objects.get(asset=asset).resolved_at is not None
    request.refresh_from_db()
    assert request.status == "rejected"


def test_write_off_checks_the_tool_revision(world, client, base):
    asset = world.assets[0]
    case = open_case(client, base, asset, "missing_asset")
    stale = resolve(
        client, base, case, {"outcome": "write_off", "expected_asset_revision": 9}, status=409
    )
    assert stale["code"] == "stale_revision"
    asset.refresh_from_db()
    assert asset.lifecycle == "active"


def test_dispute_moves_custody_with_optional_evidence(world, client, base, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    asset = world.assets[0]
    case = open_case(client, base, asset, "custody_dispute", narrative="Ray says he has it")
    photo_id = upload_photo(client, base, "reconciliation")
    result = resolve(
        client,
        base,
        case,
        {
            "outcome": "move_custody",
            "expected_asset_revision": 1,
            "destination_membership_id": str(world.member.pk),
            "photo_id": photo_id,
        },
    )
    assert result["outcome"] == "move_custody"
    assert result["photo_ids"] == [photo_id]
    assert CustodyPeriod.objects.filter(asset=asset).count() == 2
    assert open_custody(asset).holder_membership == world.member


def test_dispute_records_correct_changes_nothing(world, client, base):
    asset = world.assets[0]
    case = open_case(client, base, asset, "custody_dispute")
    before = list(CustodyPeriod.objects.order_by("id").values())
    result = resolve(client, base, case, {"outcome": "records_correct", "note": "Checked"})
    assert result["outcome"] == "records_correct"
    assert result["resolution_note"] == "Checked"
    assert result["corrected_custody_id"] is None
    assert list(CustodyPeriod.objects.order_by("id").values()) == before
    again = resolve(client, base, {**case, "revision": 2}, {"outcome": "records_correct"}, 409)
    assert again["code"] == "case_resolved"


def test_dispute_refuses_a_pending_handoff(world, client, base):
    asset = world.assets[0]
    CustodyHandoff.objects.create(
        company=world.company,
        asset=asset,
        source_custody=open_custody(asset),
        destination_membership=world.member,
        proposed_by=world.member,
        request_key=uuid4(),
    )
    case = open_case(client, base, asset, "custody_dispute")
    refused = resolve(
        client,
        base,
        case,
        {
            "outcome": "move_custody",
            "expected_asset_revision": 1,
            "destination_membership_id": str(world.member.pk),
        },
        status=409,
    )
    assert refused["code"] == "handoff_pending"
    assert CustodyPeriod.objects.filter(asset=asset).count() == 1
