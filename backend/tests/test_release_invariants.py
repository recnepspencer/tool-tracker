from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Barrier, Event
from time import monotonic, sleep
from uuid import uuid4

import pytest
from backend_platform.models import PlatformJobRecord
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import close_old_connections, connection, transaction
from django.test import Client
from PIL import Image

from equipment.models import CustodyHandoff, CustodyPeriod, ToolAsset, ToolRegistrationPolicy
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response, contract


def copy_client(source):
    client = Client(enforce_csrf_checks=True)
    client.cookies = source.cookies.copy()
    client.defaults.update(source.defaults)
    return client


def test_combined_directory_requires_both_work_and_equipment_access(world, password_hash):
    estimator = member_in(world.company, password_hash, "estimator")
    client = login_client(estimator.user)
    base = f"/api/companies/{world.company.pk}"
    assert client.get(f"{base}/jobs").status_code == 200
    assert client.get(f"{base}/directory").status_code == 403
    assert client.get(f"{base}/directory?search=NE-001").status_code == 403


@pytest.mark.django_db(transaction=True)
def test_registration_waiting_on_policy_observes_disable(world, api_client):
    policy = ToolRegistrationPolicy.objects.create(
        company=world.company, employee_tool_creation_enabled=True
    )
    ready = Event()
    pids = []

    def submit():
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                pids.append(cursor.fetchone()[0])
            ready.set()
            return copy_client(api_client).post(
                f"/api/companies/{world.company.pk}/tools",
                {
                    "request_key": str(uuid4()),
                    "asset_tag": "RACING-REGISTRATION",
                    "tool_model_id": str(world.model.pk),
                    "warehouse_id": str(world.warehouse.pk),
                },
                content_type="application/json",
            )
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as executor:
        with transaction.atomic():
            ToolRegistrationPolicy.objects.select_for_update().get(pk=policy.pk)
            future = executor.submit(submit)
            assert ready.wait(10)
            deadline = monotonic() + 10
            while True:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT cardinality(pg_blocking_pids(%s))", [pids[0]])
                    if cursor.fetchone()[0] > 0:
                        break
                assert monotonic() < deadline, "Registration never waited on policy"
                sleep(0.02)
            policy.employee_tool_creation_enabled = False
            policy.save()
        response = future.result(timeout=10)
    assert response.status_code == 403, response.content
    assert not ToolAsset.objects.filter(asset_tag="RACING-REGISTRATION").exists()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("actions", [("accept", "accept"), ("accept", "decline")])
def test_concurrent_receipt_decisions_preserve_one_transition(world, api_client, actions):
    handoff = CustodyHandoff.objects.create(
        company=world.company,
        asset=world.assets[0],
        source_custody=CustodyPeriod.objects.get(asset=world.assets[0]),
        destination_membership=world.member,
        proposed_by=world.member,
        request_key=uuid4(),
    )
    barrier = Barrier(2)

    def decide(action):
        close_old_connections()
        try:
            client = copy_client(api_client)
            barrier.wait(timeout=10)
            return client.post(
                f"/api/companies/{world.company.pk}/handoffs/{handoff.pk}/{action}",
                {"expected_revision": 1},
                content_type="application/json",
            ).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        codes = sorted(executor.map(decide, actions))
    assert codes == ([200, 200] if actions[0] == actions[1] else [200, 409])
    handoff.refresh_from_db()
    assert CustodyPeriod.objects.filter(asset=world.assets[0], ends_at__isnull=True).count() == 1
    assert CustodyPeriod.objects.filter(asset=world.assets[0]).count() == (
        2 if handoff.status == "accepted" else 1
    )
    assert PlatformJobRecord.objects.filter(name="platform.audit.record_event").count() == 1


def test_evidenced_reconciliation_preserves_custody_and_binary_contract(
    world, password_hash, settings, tmp_path
):
    settings.MEDIA_ROOT = tmp_path
    manager = member_in(world.company, password_hash, "equipment_manager")
    client = login_client(manager.user)
    base = f"/api/companies/{world.company.pk}"
    asset = world.assets[0]
    opened = client.post(
        f"{base}/tools/{asset.pk}/reconciliations",
        {"kind": "custody_dispute", "narrative": "Physical receipt was not recorded"},
        content_type="application/json",
    )
    case = assert_response(opened, "/api/companies/{company_id}/tools/{asset_id}/reconciliations")
    path = f"{base}/reconciliations/{case['id']}/resolve"
    body = {
        "expected_revision": 1,
        "expected_asset_revision": 1,
        "destination_membership_id": str(world.member.pk),
        "note": "Verified physical receipt",
    }
    assert client.post(path, body, content_type="application/json").status_code == 409
    stream = BytesIO()
    Image.new("RGB", (2, 2), "green").save(stream, format="PNG")
    uploaded = client.post(
        f"{base}/files",
        {
            "purpose": "reconciliation",
            "file": SimpleUploadedFile("receipt.png", stream.getvalue(), content_type="image/png"),
        },
    ).json()
    resolved = client.post(
        path, {**body, "photo_id": uploaded["id"]}, content_type="application/json"
    )
    result = assert_response(
        resolved, "/api/companies/{company_id}/reconciliations/{case_id}/resolve"
    )
    assert result["photo_ids"] == [uploaded["id"]]
    assert result["corrected_custody_id"]
    assert CustodyPeriod.objects.filter(asset=asset).count() == 2
    assert (
        CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True).holder_membership
        == world.member
    )
    download = client.get(f"{base}/files/{uploaded['id']}")
    formats = contract()["paths"]["/api/companies/{company_id}/files/{file_id}"]["get"][
        "responses"
    ]["200"]["content"]
    assert set(formats) == {"image/png", "image/jpeg", "image/webp"}
    assert formats[download["Content-Type"]]["schema"]["format"] == "binary"
    assert b"PNG" in b"".join(download.streaming_content)[:10]
