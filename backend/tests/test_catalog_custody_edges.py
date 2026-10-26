from uuid import uuid4

import pytest
from backend_platform.jobs import run_pending_jobs
from backend_platform.models import PlatformAuditEventRecord

from companies.models import CompanyRoleGrant
from equipment.models import CustodyHandoff, CustodyPeriod, ToolAsset, Warehouse, WarehouseRoleGrant
from tests.conftest import login_client
from tests.factories import member_in


def command(client, path, body):
    return client.post(path, body, content_type="application/json")


def test_archived_category_preserves_models_and_units_but_stops_registration(world, password_hash):
    actor = member_in(world.company, password_hash, "equipment_manager")
    client = login_client(actor.user)
    base = f"/api/companies/{world.company.pk}"
    category = world.model.category
    custody = list(CustodyPeriod.objects.order_by("id").values())
    assert (
        command(
            client,
            f"{base}/tool-categories/{category.pk}/update",
            {"expected_revision": 1, "name": "Old drills", "archived": True},
        ).status_code
        == 200
    )
    model = client.get(f"{base}/tool-models").json()["items"][0]
    assert model["id"] == str(world.model.pk) and model["registrable"] is False
    body = {
        "expected_revision": model["revision"],
        "category_id": str(category.pk),
        "name": "Historical hammer drill",
        "manufacturer": world.model.manufacturer,
        "model_number": world.model.model_number,
        "archived": True,
    }
    assert command(client, f"{base}/tool-models/{model['id']}/update", body).status_code == 200
    archived = client.get(f"{base}/tool-models?archived=true").json()["items"][0]
    assert archived["registrable"] is False
    assert (
        command(
            client,
            f"{base}/tool-models/{model['id']}/update",
            {**body, "expected_revision": archived["revision"], "archived": False},
        ).status_code
        == 200
    )
    registration = {
        "request_key": str(uuid4()),
        "asset_tag": "NEW",
        "tool_model_id": model["id"],
        "warehouse_id": str(world.warehouse.pk),
    }
    assert command(client, f"{base}/tools", registration).status_code == 404
    assert not ToolAsset.objects.filter(asset_tag="NEW").exists()
    assert {item["name"] for item in client.get(f"{base}/tools").json()["items"]} == {
        "Historical hammer drill"
    }
    assert list(CustodyPeriod.objects.order_by("id").values()) == custody
    assert (
        command(
            client,
            f"{base}/tool-categories/{category.pk}/update",
            {"expected_revision": 2, "name": "Drills", "archived": False},
        ).status_code
        == 200
    )
    assert client.get(f"{base}/tool-models").json()["items"][0]["registrable"] is True
    assert command(client, f"{base}/tools", registration).status_code == 201


def test_destination_and_warehouse_grants_require_effective_equipment_access(world, password_hash):
    admin = member_in(world.company, password_hash, "company_admin")
    estimator = member_in(world.company, password_hash, "estimator")
    client = login_client(admin.user)
    base = f"/api/companies/{world.company.pk}"
    transfer = command(
        client,
        f"{base}/tools/{world.assets[0].pk}/handoffs",
        {
            "expected_revision": 1,
            "request_key": str(uuid4()),
            "destination_membership_id": str(estimator.member.pk),
        },
    )
    assert transfer.status_code == 409 and transfer.json()["code"] == "destination_cannot_receive"
    grant = {"expected_revision": 1, "membership_id": str(estimator.member.pk), "enabled": True}
    denied = command(client, f"{base}/warehouses/{world.warehouse.pk}/authority", grant)
    assert denied.status_code == 409 and denied.json()["code"] == "warehouse_manager_ineligible"
    assert not CustodyHandoff.objects.exists() and not WarehouseRoleGrant.objects.exists()
    CompanyRoleGrant.objects.create(membership=estimator.member, role_code="field_member")
    assert (
        command(client, f"{base}/warehouses/{world.warehouse.pk}/authority", grant).status_code
        == 200
    )
    estimator.member.access_state = "suspended"
    estimator.member.save(update_fields=["access_state"])
    assert (
        command(
            client,
            f"{base}/warehouses/{world.warehouse.pk}/authority",
            {**grant, "expected_revision": 2, "enabled": False},
        ).status_code
        == 200
    )
    assert not WarehouseRoleGrant.objects.filter(revoked_at__isnull=True).exists()


def test_old_warehouse_grants_can_be_revoked_after_archive_and_role_loss(world, password_hash):
    admin = member_in(world.company, password_hash, "company_admin")
    member = member_in(world.company, password_hash)
    empty = Warehouse.objects.create(company=world.company, code="EMPTY", name="Empty")
    grant = WarehouseRoleGrant.objects.create(
        company=world.company, warehouse=empty, membership=member.member, granted_by=admin.member
    )
    CompanyRoleGrant.objects.filter(membership=member.member).update(role_code="estimator")
    client = login_client(admin.user)
    base = f"/api/companies/{world.company.pk}"
    assert (
        login_client(member.user).get("/api/me").json()["memberships"][0]["managed_warehouse_ids"]
        == []
    )
    assert (
        command(
            client,
            f"{base}/warehouses/{empty.pk}/update",
            {"expected_revision": 1, "name": empty.name, "address": "", "archived": True},
        ).status_code
        == 200
    )
    warehouse = client.get(f"{base}/warehouses?archived=true").json()["items"][0]
    assert warehouse["managers"] == [
        {"membership_id": str(member.member.pk), "name": "Employee", "eligible": False}
    ]
    assert (
        command(
            client,
            f"{base}/warehouses/{empty.pk}/authority",
            {"expected_revision": 2, "membership_id": str(member.member.pk), "enabled": False},
        ).status_code
        == 200
    )
    grant.refresh_from_db()
    assert grant.revoked_at is not None


@pytest.mark.parametrize(
    "role,scope,allowed",
    [
        ("company_admin", False, True),
        ("equipment_manager", False, True),
        ("field_member", True, True),
        ("field_member", False, False),
        ("dispatcher", False, False),
        ("estimator", False, False),
    ],
)
def test_manager_cancellation_is_scoped_reasoned_and_never_records_receipt(
    world, password_hash, role, scope, allowed
):
    admin = member_in(world.company, password_hash, "company_admin")
    actor = member_in(world.company, password_hash, role)
    receiver = member_in(world.company, password_hash)
    if scope:
        WarehouseRoleGrant.objects.create(
            company=world.company,
            warehouse=world.warehouse,
            membership=actor.member,
            granted_by=admin.member,
        )
    base = f"/api/companies/{world.company.pk}"
    proposed = command(
        login_client(admin.user),
        f"{base}/tools/{world.assets[0].pk}/handoffs",
        {
            "expected_revision": 1,
            "request_key": str(uuid4()),
            "destination_membership_id": str(receiver.member.pk),
        },
    ).json()
    # The original proposer and recipient can no longer perform the ordinary decision.
    admin.member.access_state = receiver.member.access_state = "disabled"
    admin.member.save(update_fields=["access_state"])
    receiver.member.save(update_fields=["access_state"])
    client = login_client(actor.user)
    path = f"{base}/handoffs/{proposed['id']}/void"
    before = list(CustodyPeriod.objects.values())
    if allowed:
        assert command(client, path, {"expected_revision": 1}).status_code == 409
    response = command(
        client,
        path,
        {
            "expected_revision": 1,
            "note": "Both employees unavailable; keep physical accountability unchanged",
        },
    )
    assert response.status_code == (200 if allowed else 403), response.content
    assert list(CustodyPeriod.objects.values()) == before
    handoff = CustodyHandoff.objects.get(pk=proposed["id"])
    assert handoff.status == ("cancelled" if allowed else "pending")
    if allowed:
        assert handoff.resolved_by == actor.member
        run_pending_jobs(limit=100)
        audit = PlatformAuditEventRecord.objects.get(event_key="equipment.handoff.cancelled")
        assert audit.metadata["resolution_action"] == "void"


def test_ended_holder_stays_named_in_current_and_historical_custody(world, password_hash):
    admin = member_in(world.company, password_hash, "company_admin")
    worker = member_in(world.company, password_hash, name="Departed foreman")
    manager = login_client(admin.user)
    receiver = login_client(worker.user)
    base = f"/api/companies/{world.company.pk}"
    proposed = command(
        manager,
        f"{base}/tools/{world.assets[0].pk}/handoffs",
        {
            "expected_revision": 1,
            "request_key": str(uuid4()),
            "destination_membership_id": str(worker.member.pk),
        },
    ).json()
    assert (
        command(
            receiver, f"{base}/handoffs/{proposed['id']}/accept", {"expected_revision": 1}
        ).status_code
        == 200
    )
    assert (
        command(
            manager,
            f"{base}/people/{worker.member.pk}/update",
            {
                "expected_revision": 1,
                "access_state": "disabled",
                "roles": ["field_member"],
                "end_membership": True,
                "reason": "Employment ended",
            },
        ).status_code
        == 200
    )
    asset = manager.get(f"{base}/tools/{world.assets[0].pk}").json()
    assert asset["holder_name"] == "Departed foreman"
    assert asset["holder_access_state"] == "disabled" and asset["holder_ended_at"] is not None
    history = manager.get(f"{base}/tools/{world.assets[0].pk}/custody").json()["items"]
    assert history[0]["holder_name"] == "Departed foreman" and history[0]["ends_at"] is None
    assert history[1]["holder_name"] == world.warehouse.name


def test_requester_role_loss_blocks_approval_but_not_explicit_rejection(
    world, password_hash, api_client
):
    admin = member_in(world.company, password_hash, "company_admin")
    client = login_client(admin.user)
    base = f"/api/companies/{world.company.pk}"
    requested = command(
        api_client, f"{base}/tools/{world.assets[0].pk}/requests", {"request_key": str(uuid4())}
    ).json()
    CompanyRoleGrant.objects.filter(membership=world.member).update(role_code="estimator")
    listed = client.get(f"{base}/tool-requests").json()["items"][0]
    assert listed["requester_name"] == "Ray" and listed["requester_eligible"] is False
    approved = command(
        client, f"{base}/tool-requests/{requested['id']}/approve", {"expected_revision": 1}
    )
    assert approved.status_code == 409 and approved.json()["code"] == "requester_inactive"
    assert not CustodyHandoff.objects.exists()
    assert (
        command(
            client,
            f"{base}/tool-requests/{requested['id']}/reject",
            {"expected_revision": 1, "note": "Equipment access removed"},
        ).status_code
        == 200
    )
