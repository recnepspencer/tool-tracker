from uuid import uuid4

import pytest

from companies.models import CompanyRoleGrant
from equipment.models import CustodyPeriod, EquipmentSubmission, ToolAsset, ToolCategory, ToolModel
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response

pytestmark = pytest.mark.django_db


def post(client, path, body):
    return client.post(path, body, content_type="application/json")


@pytest.fixture
def collection(world, password_hash, api_client):
    manager = login_client(member_in(world.company, password_hash, "equipment_manager").user)
    base = f"/api/companies/{world.company.pk}"
    enabled = post(
        manager,
        f"{base}/tool-registration-policy",
        {"expected_revision": 1, "employee_tool_creation_enabled": True},
    )
    assert enabled.status_code == 200, enabled.content
    return manager, api_client, base


def report_body(**extra):
    return {
        "request_key": str(uuid4()),
        "description": "Pickup truck already in the field",
        "location": "Library job",
        **extra,
    }


def test_submission_photo_is_retained_and_adopted_by_the_reviewed_item(world, collection):
    from io import BytesIO

    from django.core.files.uploadedfile import SimpleUploadedFile
    from PIL import Image

    from evidence.models import StoredFile

    manager, worker, base = collection
    image = BytesIO()
    Image.new("RGB", (2, 2), "blue").save(image, "PNG")
    photo = worker.post(
        f"{base}/files",
        {
            "purpose": "registration",
            "file": SimpleUploadedFile("truck.png", image.getvalue(), content_type="image/png"),
        },
    ).json()
    report = post(worker, f"{base}/equipment-submissions", report_body(photo_id=photo["id"])).json()
    assert StoredFile.objects.get(pk=photo["id"]).attached_at is not None
    assert (
        post(worker, f"{base}/equipment-submissions", report_body(photo_id=photo["id"])).status_code
        == 409
    )
    reviewed = post(
        manager,
        f"{base}/equipment-submissions/{report['id']}/review",
        {
            "expected_revision": 1,
            "decision": "register",
            "registration": {
                "request_key": str(uuid4()),
                "tool_model_id": str(world.model.pk),
                "warehouse_id": str(world.warehouse.pk),
                "asset_tag": "WITH-PHOTO",
            },
        },
    )
    assert reviewed.status_code == 200, reviewed.content
    assert (
        str(ToolAsset.objects.get(pk=reviewed.json()["asset_id"]).registration_photo_id)
        == photo["id"]
    )
    assert manager.get(f"{base}/files/{photo['id']}").status_code == 200


def test_collection_does_not_create_catalog_or_inventory_and_review_records_reported_holder(
    world, collection
):
    manager, worker, base = collection
    body = report_body()
    before = (ToolAsset.objects.count(), ToolModel.objects.count(), ToolCategory.objects.count())
    response = post(worker, f"{base}/equipment-submissions", body)
    report = assert_response(response, "/api/companies/{company_id}/equipment-submissions")
    assert before == (
        ToolAsset.objects.count(),
        ToolModel.objects.count(),
        ToolCategory.objects.count(),
    )
    assert report["status"] == "pending" and report["asset_id"] is None
    assert post(worker, f"{base}/equipment-submissions", body).json()["id"] == report["id"]
    assert (
        post(worker, f"{base}/equipment-submissions", {**body, "description": "Other"}).status_code
        == 409
    )
    url = f"{base}/equipment-submissions/{report['id']}/review"
    registration = {
        "request_key": str(uuid4()),
        "tool_model_id": str(world.model.pk),
        "warehouse_id": str(world.warehouse.pk),
        "asset_tag": "REVIEWED-001",
    }
    decision = {"expected_revision": 1, "decision": "register", "registration": registration}
    assert post(worker, url, decision).status_code == 403
    settled = assert_response(
        post(manager, url, decision),
        "/api/companies/{company_id}/equipment-submissions/{submission_id}/review",
    )
    asset = ToolAsset.objects.get(pk=settled["asset_id"])
    period = CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True)
    assert period.holder_membership == world.member and period.holder_warehouse_id is None
    assert EquipmentSubmission.objects.get(pk=report["id"]).description == body["description"]
    assert post(manager, url, decision).status_code == 409
    assert ToolAsset.objects.filter(asset_tag="REVIEWED-001").count() == 1


def test_clarification_and_duplicate_matching_work_after_collection_closes(
    world, collection, password_hash
):
    manager, worker, base = collection
    report = post(worker, f"{base}/equipment-submissions", report_body()).json()
    url = f"{base}/equipment-submissions/{report['id']}"
    question = post(
        manager,
        f"{url}/review",
        {"expected_revision": 1, "decision": "clarify", "note": "Which truck?"},
    )
    assert question.status_code == 200, question.content
    post(
        manager,
        f"{base}/tool-registration-policy",
        {"expected_revision": 2, "employee_tool_creation_enabled": False},
    )
    denied = post(worker, f"{base}/equipment-submissions", report_body())
    assert denied.status_code == 403
    outsider = login_client(member_in(world.company, password_hash, "field_member").user)
    assert outsider.get(f"{base}/equipment-submissions").json()["items"] == []
    assert (
        post(outsider, f"{url}/reply", {"expected_revision": 2, "note": "Other person"}).status_code
        == 404
    )
    reply = post(worker, f"{url}/reply", {"expected_revision": 2, "note": "The white truck"})
    assert reply.status_code == 200 and reply.json()["status"] == "pending"
    custody_before = list(CustodyPeriod.objects.order_by("pk").values())
    matched = post(
        manager,
        f"{url}/review",
        {"expected_revision": 3, "decision": "link", "asset_id": str(world.assets[0].pk)},
    )
    assert matched.status_code == 200, matched.content
    assert matched.json()["status"] == "linked"
    assert [m["text"] for m in matched.json()["discussion"]] == ["Which truck?", "The white truck"]
    assert list(CustodyPeriod.objects.order_by("pk").values()) == custody_before
    assert (
        post(
            worker,
            f"{base}/tools",
            {
                "request_key": str(uuid4()),
                "tool_model_id": str(world.model.pk),
                "warehouse_id": str(world.warehouse.pk),
                "asset_tag": "BYPASS",
            },
        ).status_code
        == 403
    )


def test_reports_cannot_reference_foreign_types_or_assets_and_failed_review_rolls_back(
    world, collection, password_hash
):
    manager, worker, base = collection
    category = ToolCategory.objects.create(company=world.other_company, name="Other")
    foreign_type = ToolModel.objects.create(
        company=world.other_company, category=category, name="Laptop"
    )
    assert (
        post(
            worker,
            f"{base}/equipment-submissions",
            report_body(suggested_type_id=str(foreign_type.pk)),
        ).status_code
        == 404
    )
    report = post(worker, f"{base}/equipment-submissions", report_body()).json()
    url = f"{base}/equipment-submissions/{report['id']}/review"
    before = ToolAsset.objects.count()
    failed = post(
        manager,
        url,
        {
            "expected_revision": 1,
            "decision": "register",
            "registration": {
                "request_key": str(uuid4()),
                "tool_model_id": str(foreign_type.pk),
                "warehouse_id": str(world.warehouse.pk),
                "asset_tag": "BAD",
            },
        },
    )
    assert failed.status_code == 404
    assert ToolAsset.objects.count() == before
    assert EquipmentSubmission.objects.get(pk=report["id"]).status == "pending"
    assert (
        post(
            manager, url, {"expected_revision": 1, "decision": "link", "asset_id": str(uuid4())}
        ).status_code
        == 404
    )
    other_manager = login_client(
        member_in(world.other_company, password_hash, "company_admin").user
    )
    assert other_manager.get(f"{base}/equipment-submissions").status_code == 403


def test_field_roles_never_receive_serial_or_purchase_details_in_reads_or_search(world, api_client):
    asset = world.assets[0]
    asset.serial_number = "PRIVATE-SERIAL-ABC"
    asset.acquisition_cost = "319.99"
    asset.acquisition_currency = "USD"
    asset.acquisition_date = "2026-11-01"
    asset.save()
    CustodyPeriod.objects.filter(asset=asset).update(
        holder_warehouse=None, holder_membership=world.member
    )
    base = f"/api/companies/{world.company.pk}"
    detail = api_client.get(f"{base}/tools/{asset.pk}").json()
    for key in ["serial_number", "acquisition_cost", "acquisition_date"]:
        assert detail[key] is None
    assert api_client.get(f"{base}/tools?search=PRIVATE-SERIAL-ABC").json()["items"] == []
    assert api_client.get(f"{base}/directory?search=PRIVATE-SERIAL-ABC").json()["items"] == []
    directory = api_client.get(f"{base}/directory").json()
    assert directory["items"][0]["tools"][0]["serial_number"] is None
    CompanyRoleGrant.objects.create(membership=world.member, role_code="company_admin")
    visible = api_client.get(f"{base}/tools/{asset.pk}").json()
    assert visible["serial_number"] == "PRIVATE-SERIAL-ABC"
    assert visible["acquisition_cost"] == "319.99"
    assert visible["acquisition_date"] == "2026-11-01"
