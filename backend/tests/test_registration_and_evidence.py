from datetime import timedelta
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone
from PIL import Image

from equipment.models import CustodyPeriod, ToolAsset, ToolRegistrationPolicy
from evidence.models import StoredFile
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response


@pytest.fixture
def registration(world, api_client, password_hash, settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    manager = member_in(world.company, password_hash, "equipment_manager")
    policy = ToolRegistrationPolicy.objects.create(
        company=world.company, employee_tool_creation_enabled=True
    )
    return SimpleNamespace(
        world=world,
        worker=api_client,
        manager=login_client(manager.user),
        manager_member=manager.member,
        policy=policy,
        base=f"/api/companies/{world.company.pk}",
    )


def photo():
    stream = BytesIO()
    Image.new("RGB", (3, 3), "blue").save(stream, format="PNG")
    return SimpleUploadedFile("review.png", stream.getvalue(), content_type="image/png")


def payload(ctx, **overrides):
    return {
        "request_key": str(uuid4()),
        "tool_model_id": str(ctx.world.model.pk),
        "warehouse_id": str(ctx.world.warehouse.pk),
        "asset_tag": "NEW-UNIT",
        **overrides,
    }


def test_employee_switch_manager_override_and_duplicate_units(registration):
    ctx = registration
    body = payload(ctx)
    first = ctx.worker.post(f"{ctx.base}/tools", body, content_type="application/json")
    asset = assert_response(first, "/api/companies/{company_id}/tools", status=201)
    assert asset["id"] != str(ctx.world.assets[0].pk)
    assert asset["tool_model_id"] == str(ctx.world.model.pk)
    assert CustodyPeriod.objects.get(asset_id=asset["id"]).holder_warehouse == ctx.world.warehouse
    replay = ctx.worker.post(f"{ctx.base}/tools", body, content_type="application/json")
    assert replay.status_code == 200 and replay.json() == asset
    policy = ctx.manager.post(
        f"{ctx.base}/tool-registration-policy",
        {"expected_revision": 1, "employee_tool_creation_enabled": False},
        content_type="application/json",
    )
    assert_response(policy, "/api/companies/{company_id}/tool-registration-policy")
    assert (
        ctx.worker.post(
            f"{ctx.base}/tools", payload(ctx, asset_tag="BLOCKED"), content_type="application/json"
        ).status_code
        == 403
    )
    manager_created = ctx.manager.post(
        f"{ctx.base}/tools", payload(ctx, asset_tag="MANAGED"), content_type="application/json"
    )
    assert manager_created.status_code == 201
    assert ToolAsset.objects.filter(pk=asset["id"]).exists()
    assert (
        ctx.worker.post(
            f"{ctx.base}/tool-registration-policy",
            {"expected_revision": 2, "employee_tool_creation_enabled": True},
            content_type="application/json",
        ).status_code
        == 403
    )
    assert (
        ctx.manager.post(
            f"{ctx.base}/tool-registration-policy",
            {"expected_revision": 1, "employee_tool_creation_enabled": True},
            content_type="application/json",
        ).status_code
        == 409
    )


def test_photo_staging_does_not_bypass_later_policy_disable(registration):
    ctx = registration
    uploaded = ctx.worker.post(f"{ctx.base}/files", {"file": photo(), "purpose": "registration"})
    staged = assert_response(uploaded, "/api/companies/{company_id}/files")
    assert ctx.manager.get(f"{ctx.base}/files/{staged['id']}").status_code == 403
    assert (
        ctx.manager.post(
            f"{ctx.base}/tool-registration-policy",
            {"expected_revision": 1, "employee_tool_creation_enabled": False},
            content_type="application/json",
        ).status_code
        == 200
    )
    denied = ctx.worker.post(
        f"{ctx.base}/tools", payload(ctx, photo_id=staged["id"]), content_type="application/json"
    )
    assert denied.status_code == 403
    assert StoredFile.objects.get(pk=staged["id"]).attached_at is None
    assert not ToolAsset.objects.filter(asset_tag="NEW-UNIT").exists()


def test_photo_claim_download_and_cleanup_preserve_attached_evidence(registration):
    ctx = registration
    uploaded = ctx.worker.post(
        f"{ctx.base}/files", {"file": photo(), "purpose": "registration"}
    ).json()
    created = ctx.worker.post(
        f"{ctx.base}/tools", payload(ctx, photo_id=uploaded["id"]), content_type="application/json"
    )
    assert created.status_code == 201
    download = ctx.manager.get(f"{ctx.base}/files/{uploaded['id']}")
    assert download.status_code == 200
    assert download["Content-Type"] == "image/png"
    assert b"PNG" in b"".join(download.streaming_content)[:10]
    assert (
        ctx.worker.post(
            f"{ctx.base}/tools",
            payload(ctx, photo_id=uploaded["id"], asset_tag="REUSE"),
            content_type="application/json",
        ).status_code
        == 409
    )
    orphan = ctx.worker.post(f"{ctx.base}/files", {"file": photo(), "purpose": "incident"}).json()
    StoredFile.objects.update(expires_at=timezone.now() - timedelta(days=1))
    call_command("cleanup_staged_photos")
    assert StoredFile.objects.filter(pk=uploaded["id"]).exists()
    assert not StoredFile.objects.filter(pk=orphan["id"]).exists()


def test_upload_checks_real_bytes_and_tool_registration_rejects_foreign_ids(registration):
    ctx = registration
    upload = SimpleUploadedFile(
        "pretend.png", b"<script>not a photo</script>", content_type="image/png"
    )
    assert (
        ctx.worker.post(
            f"{ctx.base}/files", {"file": upload, "purpose": "registration"}
        ).status_code
        == 409
    )
    from equipment.models import Warehouse

    foreign = Warehouse.objects.create(company=ctx.world.other_company, code="OTHER", name="Other")
    assert (
        ctx.worker.post(
            f"{ctx.base}/tools",
            payload(ctx, warehouse_id=str(foreign.pk)),
            content_type="application/json",
        ).status_code
        == 404
    )
    assert not ToolAsset.objects.filter(asset_tag="NEW-UNIT").exists()
