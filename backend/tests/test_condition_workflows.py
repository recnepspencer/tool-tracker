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
