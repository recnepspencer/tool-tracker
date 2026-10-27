from uuid import uuid4

import pytest
from backend_platform.jobs import run_pending_jobs
from backend_platform.models import PlatformAuditEventRecord

from equipment.models import CustodyPeriod, Warehouse
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response
from tests.test_tool_requests import post


@pytest.mark.parametrize("timezone", ["../UTC", "Not/A_Timezone", ""])
def test_bootstrap_invalid_timezone_has_no_partial_company(api_client, timezone):
    from companies.models import Company, CompanyMembership

    before = (Company.objects.count(), CompanyMembership.objects.count())
    response = api_client.post(
        "/api/companies",
        {
            "request_key": str(uuid4()),
            "name": "Invalid timezone",
            "preferred_name": "Owner",
            "timezone": timezone,
        },
        content_type="application/json",
    )
    assert response.status_code == 409 and response.json()["code"] == "invalid_timezone"
    assert (Company.objects.count(), CompanyMembership.objects.count()) == before


@pytest.mark.parametrize(
    "role", ["company_admin", "equipment_manager", "dispatcher", "estimator", "field_member"]
)
def test_company_profile_permission_revision_and_validation(world, password_hash, role):
    actor = member_in(world.company, password_hash, role)
    client = login_client(actor.user)
    base = f"/api/companies/{world.company.pk}"
    body = {
        "expected_revision": 1,
        "name": "Updated Electric",
        "address": "123 Main Street",
        "timezone": "America/Chicago",
    }
    response = client.post(f"{base}/update", body, content_type="application/json")
    if role != "company_admin":
        assert response.status_code == 403
        world.company.refresh_from_db()
        assert world.company.name == "Nelson Electric" and world.company.address == ""
        return
    data = assert_response(response, "/api/companies/{company_id}/update")
    assert data == {
        "id": str(world.company.pk),
        "name": "Updated Electric",
        "address": "123 Main Street",
        "timezone": "America/Chicago",
        "revision": 2,
    }
    assert client.get(base).json() == data
    assert client.post(f"{base}/update", body, content_type="application/json").status_code == 409
    invalid = client.post(
        f"{base}/update",
        {**body, "expected_revision": 2, "timezone": "../UTC"},
        content_type="application/json",
    )
    assert invalid.status_code == 409 and invalid.json()["code"] == "invalid_timezone"
    assert client.get(base).json() == data
    assert (
        client.post(
            f"/api/companies/{world.other_company.pk}/update", body, content_type="application/json"
        ).status_code
        == 403
    )
    run_pending_jobs(limit=100)
    assert (
        PlatformAuditEventRecord.objects.filter(event_key="companies.company.updated").count() == 1
    )


def test_activity_filters_apply_before_pagination_and_preserve_private_scope(
    world, password_hash, api_client, asset_url
):
    manager = member_in(world.company, password_hash, "equipment_manager")
    client = login_client(manager.user)
    base = f"/api/companies/{world.company.pk}"
    assert post(api_client, asset_url).status_code == 201
    assert post(api_client, f"{base}/tools/{world.assets[1].pk}/requests").status_code == 201
    other = Warehouse.objects.create(company=world.company, code="OTHER", name="Other warehouse")
    response = client.post(
        f"{base}/tools/{world.assets[0].pk}/service",
        {"expected_revision": 1, "serviceability": "damaged", "note": "Inspection"},
        content_type="application/json",
    )
    assert response.status_code == 200, response.content
    run_pending_jobs(limit=100)
    # Historical warehouse context does not follow a later stewardship change.
    world.assets[0].responsible_warehouse = other
    world.assets[0].save(update_fields=["responsible_warehouse"])
    page = client.get(
        f"{base}/activity", {"kind": "request", "warehouse_id": str(world.warehouse.pk), "limit": 1}
    ).json()
    assert len(page["items"]) == 1 and page["next_offset"] == 1
    next_page = client.get(
        f"{base}/activity",
        {
            "kind": "request",
            "warehouse_id": str(world.warehouse.pk),
            "limit": 1,
            "offset": page["next_offset"],
        },
    ).json()
    assert len(next_page["items"]) == 1 and next_page["next_offset"] is None
    assert {item["metadata"]["asset_tag"] for item in [*page["items"], *next_page["items"]]} == {
        "NE-001",
        "NE-002",
    }
    assert (
        client.get(f"{base}/activity", {"kind": "flag"}).json()["items"][0]["event_key"]
        == "equipment.asset.serviced"
    )
    assert len(client.get(f"{base}/activity", {"search": "NE-001"}).json()["items"]) == 2
    assert client.get(f"{base}/activity", {"warehouse_id": str(other.pk)}).json()["items"] == []
    own = api_client.get(f"{base}/activity", {"kind": "flag", "mine": "false"}).json()
    assert own["items"] == []  # A client filter cannot expand own-event visibility.
    assert client.get(f"{base}/activity", {"mine": "true", "kind": "request"}).json()["items"] == []
    assert client.get(f"/api/companies/{world.other_company.pk}/activity").status_code == 403
    assert client.get(f"{base}/activity", {"kind": "invented"}).status_code == 400
    assert CustodyPeriod.objects.filter(
        asset=world.assets[0], ends_at__isnull=True, holder_warehouse=world.warehouse
    ).exists()
