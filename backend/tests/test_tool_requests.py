from uuid import uuid4

import pytest
from backend_platform.jobs import run_pending_jobs
from backend_platform.models import PlatformAuditEventRecord, PlatformJobRecord
from django.test import Client
from django.utils import timezone

from equipment.models import AssetIncident, CustodyPeriod, ToolRequest


def post(client, url, key=None, **extra):
    return client.post(
        url, {"request_key": str(key or uuid4()), **extra}, content_type="application/json"
    )


def test_two_identical_tools_remain_distinct(api_client, world, asset_url):
    url = f"/api/companies/{world.company.id}/tools"
    items = api_client.get(url).json()["items"]
    assert {item["id"] for item in items} == {str(a.id) for a in world.assets}
    assert {item["tool_model_id"] for item in items} == {str(world.model.id)}
    assert {item["asset_tag"] for item in items} == {"NE-001", "NE-002"}
    before = list(CustodyPeriod.objects.values())
    response = post(api_client, asset_url, note="  Needed for rough-in  ")
    assert response.status_code == 201, response.content
    result = response.json()
    assert result["asset_id"] == str(world.assets[0].id)
    assert result["requester_id"] == str(world.member.id)
    assert result["status"] == "pending"
    assert result["note"] == "Needed for rough-in"
    assert list(CustodyPeriod.objects.values()) == before
    assert not ToolRequest.objects.filter(asset=world.assets[1]).exists()
    assert PlatformJobRecord.objects.filter(name="platform.audit.record_event").count() == 1
    run_pending_jobs(limit=20)
    event = PlatformAuditEventRecord.objects.get(event_key="equipment.tool.requested")
    assert event.actor_user_id == world.user.id
    assert event.metadata["asset_id"] == str(world.assets[0].id)
    assert event.metadata["company_id"] == str(world.company.id)


def test_request_is_readable_by_its_requester(api_client, world, asset_url):
    result = post(api_client, asset_url).json()
    response = api_client.get(f"/api/companies/{world.company.id}/tool-requests/{result['id']}")
    assert response.status_code == 200
    assert response.json() == result


def test_retry_returns_same_resource_without_duplicate_audit(api_client, asset_url):
    key = uuid4()
    first = post(api_client, asset_url, key, note="Needed")
    second = post(api_client, asset_url, key, note=" Needed ")
    assert (first.status_code, second.status_code) == (201, 200)
    assert first.json() == second.json()
    assert ToolRequest.objects.count() == 1
    assert PlatformJobRecord.objects.count() == 1


def test_key_cannot_be_reused_for_another_asset_or_note(api_client, world, asset_url):
    key = uuid4()
    assert post(api_client, asset_url, key).status_code == 201
    other_url = f"/api/companies/{world.company.id}/tools/{world.assets[1].id}/requests"
    for url, note in ((other_url, ""), (asset_url, "Different")):
        response = post(api_client, url, key, note=note)
        assert response.status_code == 409
        assert response.json()["code"] == "request_key_reused"
    assert ToolRequest.objects.count() == 1


def test_another_key_does_not_create_second_open_request(api_client, asset_url):
    first = post(api_client, asset_url).json()
    second = post(api_client, asset_url)
    assert second.status_code == 409
    assert second.json()["code"] == "request_already_open"
    assert second.json()["detail"]["request_id"] == first["id"]


@pytest.mark.parametrize(
    "field,value,code",
    [
        ("lifecycle", "retired", "asset_not_active"),
        ("serviceability", "damaged", "asset_not_serviceable"),
        ("serviceability", "out_of_service", "asset_not_serviceable"),
    ],
)
def test_unavailable_tools_cannot_be_requested(api_client, world, asset_url, field, value, code):
    asset = world.assets[0]
    setattr(asset, field, value)
    asset.save(update_fields=[field])
    response = post(api_client, asset_url)
    assert response.status_code == 409
    assert response.json()["code"] == code
    assert ToolRequest.objects.count() == 0


def test_missing_tool_can_still_be_damaged_and_keeps_custody(api_client, world, asset_url):
    asset = world.assets[0]
    asset.serviceability = "damaged"
    asset.save(update_fields=["serviceability"])
    AssetIncident.objects.create(
        company=world.company,
        asset=asset,
        kind="missing",
        reported_by=world.member,
        description="Not in its case",
    )
    item = api_client.get(f"/api/companies/{world.company.id}/tools").json()["items"][0]
    assert item["missing"] and item["serviceability"] == "damaged"
    assert not item["requestable"]
    assert post(api_client, asset_url).json()["code"] == "asset_missing"
    assert CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).count() == 1


def test_person_held_and_archived_warehouse_tools_are_unavailable(api_client, world, asset_url):
    custody = CustodyPeriod.objects.get(asset=world.assets[0])
    custody.holder_warehouse = None
    custody.holder_membership = world.member
    custody.save()
    assert post(api_client, asset_url).json()["code"] == "asset_not_at_warehouse"
    world.warehouse.archived_at = timezone.now()
    world.warehouse.save()
    url = f"/api/companies/{world.company.id}/tools/{world.assets[1].id}/requests"
    assert post(api_client, url).json()["code"] == "warehouse_archived"


def test_csrf_is_enforced(api_client, asset_url):
    del api_client.defaults["HTTP_X_CSRFTOKEN"]
    assert post(api_client, asset_url).status_code == 403
    assert ToolRequest.objects.count() == 0


def test_anonymous_session_is_denied(world, asset_url):
    client = Client(enforce_csrf_checks=True)
    client.defaults["HTTP_X_CSRFTOKEN"] = client.get("/api/auth/csrf").json()["csrf_token"]
    assert post(client, asset_url).status_code == 401
    assert client.get(f"/api/companies/{world.company.id}/tools").status_code == 401


@pytest.mark.parametrize("revocation", ["suspended", "ended", "role", "identity"])
def test_live_access_revocation_denies_existing_session(api_client, world, asset_url, revocation):
    if revocation == "suspended":
        world.member.access_state = "suspended"
        world.member.save()
    elif revocation == "ended":
        world.member.ended_at = timezone.now()
        world.member.save()
    elif revocation == "role":
        world.grant.revoked_at = timezone.now()
        world.grant.save()
    else:
        world.user.is_active = False
        world.user.save()
    assert post(api_client, asset_url).status_code == 403
    assert ToolRequest.objects.count() == 0


def test_input_cannot_supply_actor_or_model_in_place_of_asset(api_client, asset_url):
    for payload in (
        {"request_key": str(uuid4()), "actor_id": str(uuid4())},
        {"tool_model_id": str(uuid4())},
        {"request_key": "invalid"},
        {"request_key": str(uuid4()), "note": "x" * 2001},
    ):
        response = api_client.post(asset_url, payload, content_type="application/json")
        assert response.status_code == 400, response.content
    assert ToolRequest.objects.count() == 0


def test_audit_enqueue_failure_rolls_back_business_write(api_client, asset_url, monkeypatch):
    def unavailable(event):
        raise RuntimeError("audit queue unavailable")

    monkeypatch.setattr("equipment.request_tool.record_audit_event", unavailable)
    with pytest.raises(RuntimeError, match="audit queue unavailable"):
        post(api_client, asset_url)
    assert ToolRequest.objects.count() == 0
    assert PlatformJobRecord.objects.count() == 0


def test_pagination_is_bounded_and_deterministic(api_client, world):
    url = f"/api/companies/{world.company.id}/tools"
    first = api_client.get(url, {"limit": 1}).json()
    second = api_client.get(url, {"limit": 1, "offset": first["next_offset"]}).json()
    assert first["items"][0]["asset_tag"] == "NE-001"
    assert second["items"][0]["asset_tag"] == "NE-002"
    assert second["next_offset"] is None
    assert api_client.get(url, {"limit": 101}).status_code == 400
    assert api_client.get(url, {"offset": -1}).status_code == 400
