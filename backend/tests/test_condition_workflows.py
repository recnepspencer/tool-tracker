from types import SimpleNamespace

import pytest

from equipment.models import AssetIncident, CustodyPeriod
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response


@pytest.fixture
def condition(world, password_hash):
    manager = member_in(world.company, password_hash, "equipment_manager")
    return SimpleNamespace(
        world=world,
        client=login_client(manager.user),
        actor=manager,
        base=f"/api/companies/{world.company.pk}",
        asset=world.assets[0],
    )


def test_missing_and_damage_resolve_independently_without_reassigning_custody(condition):
    ctx = condition
    original = CustodyPeriod.objects.get(asset=ctx.asset).pk
    for revision, kind in [(1, "damage"), (2, "missing")]:
        result = ctx.client.post(
            f"{ctx.base}/tools/{ctx.asset.pk}/incidents",
            {"expected_revision": revision, "kind": kind, "description": f"Report {kind}"},
            content_type="application/json",
        )
        assert_response(result, "/api/companies/{company_id}/tools/{asset_id}/incidents")
    repaired = ctx.client.post(
        f"{ctx.base}/tools/{ctx.asset.pk}/service",
        {
            "expected_revision": 3,
            "serviceability": "serviceable",
            "note": "Repaired before discovering the tool was misplaced",
        },
        content_type="application/json",
    )
    assert_response(repaired, "/api/companies/{company_id}/tools/{asset_id}/service")
    missing = AssetIncident.objects.get(asset=ctx.asset, kind="missing")
    assert missing.resolved_at is None
    assert AssetIncident.objects.get(asset=ctx.asset, kind="damage").resolved_at is not None
    found = ctx.client.post(
        f"{ctx.base}/incidents/{missing.pk}/found",
        {"expected_revision": 1, "note": "Located in the locked cabinet"},
        content_type="application/json",
    )
    assert found.status_code == 200
    detail = ctx.client.get(f"{ctx.base}/tools/{ctx.asset.pk}")
    body = assert_response(detail, "/api/companies/{company_id}/tools/{asset_id}", method="get")
    assert body["requestable"] and not body["missing"] and body["serviceability"] == "serviceable"
    assert CustodyPeriod.objects.get(asset=ctx.asset).pk == original
    reports = assert_response(
        ctx.client.get(f"{ctx.base}/incidents?asset_id={ctx.asset.pk}&open_only=false"),
        "/api/companies/{company_id}/incidents",
        method="get",
    )["items"]
    assert len(reports) == 2
    assert all(report["reported_by_name"] == "Employee" for report in reports)
    assert all(report["resolved_by_name"] == "Employee" for report in reports)
    assert {report["resolution_note"] for report in reports} == {
        "Repaired before discovering the tool was misplaced",
        "Located in the locked cabinet",
    }
    services = assert_response(
        ctx.client.get(f"{ctx.base}/tools/{ctx.asset.pk}/service"),
        "/api/companies/{company_id}/tools/{asset_id}/service",
        method="get",
    )["items"]
    assert services[0]["performed_by_name"] == "Employee"


def test_lifecycle_history_retains_reasons_and_actor_after_employment_ends(
    condition, password_hash
):
    ctx = condition
    path = f"{ctx.base}/tools/{ctx.asset.pk}/lifecycle"
    for revision, lifecycle, note in [
        (1, "retired", "Awaiting replacement parts"),
        (2, "active", "Inspection complete"),
        (3, "disposed", "Recycled damaged housing"),
    ]:
        response = ctx.client.post(
            path,
            {
                "expected_revision": revision,
                "lifecycle": lifecycle,
                "note": note,
            },
            content_type="application/json",
        )
        assert response.status_code == 200
    admin = member_in(ctx.world.company, password_hash, "company_admin")
    changed = login_client(admin.user).post(
        f"{ctx.base}/people/{ctx.actor.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "roles": ["field_member"],
            "end_membership": True,
            "reason": "Employment ended",
        },
        content_type="application/json",
    )
    assert changed.status_code == 200
    client = login_client(ctx.world.user)
    first = assert_response(
        client.get(f"{path}?limit=2"),
        "/api/companies/{company_id}/tools/{asset_id}/lifecycle",
        method="get",
    )
    assert first["next_offset"] == 2
    assert [event["to_lifecycle"] for event in first["items"]] == ["disposed", "active"]
    assert first["items"][0]["reason"] == "Recycled damaged housing"
    assert first["items"][0]["from_lifecycle"] == "active"
    assert all(event["actor_name"] == "Employee" for event in first["items"])
    assert all(event["actor_id"] == str(ctx.actor.member.pk) for event in first["items"])
    last = client.get(f"{path}?limit=2&offset=2").json()
    assert last["items"][0]["reason"] == "Awaiting replacement parts"
    assert last["next_offset"] is None
    assert CustodyPeriod.objects.get(asset=ctx.asset).ends_at is not None

    foreign = member_in(ctx.world.other_company, password_hash)
    foreign_client = login_client(foreign.user)
    assert foreign_client.get(path).status_code == 403
    own_path = f"/api/companies/{ctx.world.other_company.pk}/tools/{ctx.asset.pk}/lifecycle"
    assert foreign_client.get(own_path).json()["items"] == []


def test_lifecycle_requires_accounted_for_warehouse_tool(condition):
    ctx = condition
    source = CustodyPeriod.objects.get(asset=ctx.asset)
    source.holder_membership = ctx.world.member
    source.holder_warehouse = None
    source.save()
    path = f"{ctx.base}/tools/{ctx.asset.pk}/lifecycle"
    body = {"expected_revision": 1, "lifecycle": "retired", "note": "Replace aging tool"}
    assert ctx.client.post(path, body, content_type="application/json").status_code == 409
    source.holder_membership = None
    source.holder_warehouse = ctx.world.warehouse
    source.save()
    retired = ctx.client.post(path, body, content_type="application/json")
    assert retired.status_code == 200 and retired.json()["lifecycle"] == "retired"
    assert CustodyPeriod.objects.get(asset=ctx.asset).ends_at is None
    disposed = ctx.client.post(
        path,
        {
            "expected_revision": 2,
            "lifecycle": "disposed",
            "note": "Recycled through approved vendor",
        },
        content_type="application/json",
    )
    assert disposed.status_code == 200
    assert CustodyPeriod.objects.get(asset=ctx.asset).ends_at is not None
    assert (
        ctx.client.post(
            path,
            {
                "expected_revision": 3,
                "lifecycle": "active",
                "note": "Cannot resurrect disposed identity",
            },
            content_type="application/json",
        ).status_code
        == 409
    )


def test_worker_cannot_report_unheld_asset_or_resolve_missing(condition, api_client):
    ctx = condition
    payload = {"expected_revision": 1, "kind": "missing", "description": "Missing"}
    assert (
        api_client.post(
            f"{ctx.base}/tools/{ctx.asset.pk}/incidents", payload, content_type="application/json"
        ).status_code
        == 403
    )
    result = ctx.client.post(
        f"{ctx.base}/tools/{ctx.asset.pk}/incidents", payload, content_type="application/json"
    ).json()
    assert (
        api_client.post(
            f"{ctx.base}/incidents/{result['id']}/found",
            {"expected_revision": 1, "note": "Try to clear"},
            content_type="application/json",
        ).status_code
        == 403
    )
    assert (
        ctx.client.post(
            f"{ctx.base}/tools/{ctx.asset.pk}/lifecycle",
            {"expected_revision": 2, "lifecycle": "retired", "note": "Hide missing item"},
            content_type="application/json",
        ).status_code
        == 409
    )
