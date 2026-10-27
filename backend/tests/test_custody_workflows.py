from types import SimpleNamespace
from uuid import uuid4

import pytest

from equipment.models import CustodyHandoff, CustodyPeriod, ToolRequest, WarehouseRoleGrant
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response


@pytest.fixture
def custody(world, password_hash, api_client):
    manager = member_in(world.company, password_hash, "equipment_manager")
    receiver = member_in(world.company, password_hash)
    return SimpleNamespace(
        world=world,
        worker=api_client,
        manager=login_client(manager.user),
        receiver=login_client(receiver.user),
        receiver_member=receiver.member,
        manager_member=manager.member,
        base=f"/api/companies/{world.company.pk}",
    )


def request_and_approve(ctx, asset=None):
    asset = asset or ctx.world.assets[0]
    response = ctx.worker.post(
        f"{ctx.base}/tools/{asset.pk}/requests",
        {"request_key": str(uuid4())},
        content_type="application/json",
    )
    request = assert_response(
        response, "/api/companies/{company_id}/tools/{asset_id}/requests", status=201
    )
    approved = ctx.manager.post(
        f"{ctx.base}/tool-requests/{request['id']}/approve",
        {"expected_revision": 1, "note": "Ready to collect"},
        content_type="application/json",
    )
    assert_response(approved, "/api/companies/{company_id}/tool-requests/{request_id}/{action}")
    return request, CustodyHandoff.objects.get(tool_request_id=request["id"])


def accept(ctx, handoff, client=None):
    response = (client or ctx.worker).post(
        f"{ctx.base}/handoffs/{handoff.pk}/accept",
        {"expected_revision": handoff.revision, "note": "Received physically"},
        content_type="application/json",
    )
    return assert_response(response, "/api/companies/{company_id}/handoffs/{handoff_id}/{action}")


def test_approval_is_not_receipt_and_acceptance_is_replay_safe(custody):
    ctx = custody
    request, handoff = request_and_approve(ctx)
    asset = ctx.world.assets[0]
    assert (
        CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True).holder_warehouse
        == ctx.world.warehouse
    )
    assert handoff.status == "pending"
    denied = ctx.manager.post(
        f"{ctx.base}/handoffs/{handoff.pk}/accept",
        {"expected_revision": 1},
        content_type="application/json",
    )
    assert denied.status_code == 403
    accepted = accept(ctx, handoff)
    assert accepted["status"] == "accepted"
    assert (
        CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True).holder_membership
        == ctx.world.member
    )
    assert CustodyPeriod.objects.filter(asset=asset).count() == 2
    assert ToolRequest.objects.get(pk=request["id"]).status == "fulfilled"
    assert accept(ctx, handoff) == accepted
    assert CustodyPeriod.objects.filter(asset=asset).count() == 2
    assert (
        CustodyPeriod.objects.get(asset=ctx.world.assets[1]).holder_warehouse == ctx.world.warehouse
    )


def test_worker_transfer_and_return_update_only_the_correct_authorities(custody):
    ctx = custody
    _, handoff = request_and_approve(ctx)
    accept(ctx, handoff)
    asset = ctx.world.assets[0]
    asset.refresh_from_db()
    payload = {
        "request_key": str(uuid4()),
        "expected_revision": asset.revision,
        "destination_membership_id": str(ctx.receiver_member.pk),
        "note": "Pass this drill",
    }
    response = ctx.worker.post(
        f"{ctx.base}/tools/{asset.pk}/handoffs", payload, content_type="application/json"
    )
    proposed = assert_response(
        response, "/api/companies/{company_id}/tools/{asset_id}/handoffs", status=201
    )
    retry = ctx.worker.post(
        f"{ctx.base}/tools/{asset.pk}/handoffs", payload, content_type="application/json"
    )
    assert retry.status_code == 200
    assert retry.json() == proposed
    transfer = CustodyHandoff.objects.get(pk=proposed["id"])
    accept(ctx, transfer, ctx.receiver)
    asset.refresh_from_db()
    assert asset.responsible_warehouse == ctx.world.warehouse
    returned = ctx.receiver.post(
        f"{ctx.base}/tools/{asset.pk}/handoffs",
        {
            "request_key": str(uuid4()),
            "expected_revision": asset.revision,
            "destination_warehouse_id": str(ctx.world.warehouse.pk),
        },
        content_type="application/json",
    )
    assert returned.status_code == 201
    accept(ctx, CustodyHandoff.objects.get(pk=returned.json()["id"]), ctx.manager)
    assert (
        CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True).holder_warehouse
        == ctx.world.warehouse
    )
    assert CustodyPeriod.objects.filter(asset=asset).count() == 4


def test_withdraw_approved_request_cancels_handoff_without_moving_tool(custody):
    ctx = custody
    request, handoff = request_and_approve(ctx)
    response = ctx.worker.post(
        f"{ctx.base}/tool-requests/{request['id']}/withdraw",
        {"expected_revision": 2},
        content_type="application/json",
    )
    assert response.status_code == 200
    handoff.refresh_from_db()
    assert handoff.status == "cancelled"
    assert CustodyPeriod.objects.filter(asset=ctx.world.assets[0]).count() == 1


def test_audit_failure_rolls_back_receipt(custody, monkeypatch):
    ctx = custody
    request, handoff = request_and_approve(ctx)

    def fail_audit(*args, **kwargs):
        raise RuntimeError("Audit enqueue unavailable")

    monkeypatch.setattr("companies.audit.record_audit_event", fail_audit)
    with pytest.raises(RuntimeError, match="Audit enqueue unavailable"):
        ctx.worker.post(
            f"{ctx.base}/handoffs/{handoff.pk}/accept",
            {"expected_revision": 1},
            content_type="application/json",
        )
    handoff.refresh_from_db()
    assert handoff.status == "pending"
    assert ToolRequest.objects.get(pk=request["id"]).status == "approved"
    assert CustodyPeriod.objects.filter(asset=ctx.world.assets[0]).count() == 1


def test_unrelated_worker_cannot_propose_cancel_or_accept(custody):
    ctx = custody
    _, handoff = request_and_approve(ctx)
    for action in ["accept", "decline", "cancel"]:
        response = ctx.receiver.post(
            f"{ctx.base}/handoffs/{handoff.pk}/{action}",
            {"expected_revision": 1},
            content_type="application/json",
        )
        assert response.status_code == 403
    assert (
        ctx.receiver.post(
            f"{ctx.base}/tools/{ctx.world.assets[1].pk}/handoffs",
            {
                "expected_revision": 1,
                "request_key": str(uuid4()),
                "destination_membership_id": str(ctx.world.member.pk),
            },
            content_type="application/json",
        ).status_code
        == 403
    )


def test_warehouse_grant_is_scoped_and_revocation_is_live(custody):
    ctx = custody
    request = ctx.worker.post(
        f"{ctx.base}/tools/{ctx.world.assets[0].pk}/requests",
        {"request_key": str(uuid4())},
        content_type="application/json",
    ).json()
    path = f"{ctx.base}/tool-requests/{request['id']}/approve"
    body = {"expected_revision": 1}
    assert ctx.receiver.post(path, body, content_type="application/json").status_code == 403
    grant = WarehouseRoleGrant.objects.create(
        company=ctx.world.company,
        warehouse=ctx.world.warehouse,
        membership=ctx.receiver_member,
        granted_by=ctx.manager_member,
    )
    assert ctx.receiver.post(path, body, content_type="application/json").status_code == 200
    from django.utils import timezone

    grant.revoked_at = timezone.now()
    grant.save()
    assert ctx.receiver.post(path, body, content_type="application/json").status_code == 403
