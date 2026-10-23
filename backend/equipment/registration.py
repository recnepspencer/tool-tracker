import hashlib

from backend_platform.api import conflict, forbidden, not_found
from django.db import IntegrityError, transaction

from companies.access import authorize_write, capabilities, require_member
from companies.audit import record_company_event
from companies.models import Company
from companies.revisions import expect_revision
from evidence.files import claim_file

from .access import active_warehouse, require_warehouse_authority
from .asset_creation import create_asset_at_warehouse
from .models import ToolAsset, ToolCategory, ToolModel, ToolRegistrationPolicy


def registration_allowed(member, *, lock=False):
    query = (
        ToolRegistrationPolicy.objects.select_for_update()
        if lock
        else ToolRegistrationPolicy.objects
    )
    policy = query.filter(company_id=member.company_id).first()
    manager = "tools.manage" in capabilities(member)
    if not manager and (policy is None or not policy.employee_tool_creation_enabled):
        raise forbidden(
            "Employee tool registration is disabled.", code="employee_registration_disabled"
        )
    return manager


def read_registration_policy(identity, company_id):
    require_member(identity, company_id, "company.read")
    return ToolRegistrationPolicy.objects.filter(
        company_id=company_id
    ).first() or ToolRegistrationPolicy(company_id=company_id)


@transaction.atomic
def set_registration_policy(identity, company_id, enabled, expected_revision):
    member = authorize_write(identity, company_id, "tools.manage_registration_policy")
    Company.objects.select_for_update().get(pk=company_id)
    policy, _ = ToolRegistrationPolicy.objects.get_or_create(company_id=company_id)
    policy = ToolRegistrationPolicy.objects.select_for_update().get(pk=company_id)
    expect_revision(policy, expected_revision)
    policy.employee_tool_creation_enabled = enabled
    policy.updated_by = member
    policy.revision += 1
    policy.save()
    record_company_event(
        identity,
        company_id,
        "equipment.registration_policy.updated",
        policy,
        metadata={"enabled": enabled},
    )
    return policy


@transaction.atomic
def register_asset(identity, company_id, data):
    member = authorize_write(identity, company_id, "tools.register")
    fingerprint = hashlib.sha256(data.model_dump_json(exclude={"request_key"}).encode()).hexdigest()
    previous = ToolAsset.objects.filter(
        registered_by=member, registration_key=data.request_key
    ).first()
    if previous:
        if previous.registration_fingerprint != fingerprint:
            raise conflict(
                "Registration key was used for different input.", code="request_key_reused"
            )
        return previous, False
    manager = registration_allowed(member, lock=True)
    category_id = (
        ToolModel.objects.filter(pk=data.tool_model_id, company_id=company_id)
        .values_list("category_id", flat=True)
        .first()
    )
    if (
        not ToolCategory.objects.select_for_update()
        .filter(pk=category_id, company_id=company_id, archived_at__isnull=True)
        .exists()
    ):
        raise not_found("Active tool category not found.")
    model = (
        ToolModel.objects.select_for_update(of=("self",))
        .filter(
            pk=data.tool_model_id,
            company_id=company_id,
            category_id=category_id,
            archived_at__isnull=True,
            category__archived_at__isnull=True,
        )
        .first()
    )
    if not model:
        raise not_found("Active tool model not found.")
    warehouse = active_warehouse(company_id, data.warehouse_id, lock=True)
    if manager:
        require_warehouse_authority(member, warehouse.pk)
    if ToolAsset.objects.filter(company_id=company_id, asset_tag=data.asset_tag).exists():
        raise conflict("Asset tag already exists.", code="asset_tag_exists")
    # Warehouse lock serializes registrations to that warehouse; a company tag
    # can still race across warehouses, so the unique constraint remains authority.
    photo = claim_file(member, data.photo_id, "registration") if data.photo_id else None
    try:
        with transaction.atomic():
            asset = create_asset_at_warehouse(
                company=member.company,
                tool_model=model,
                asset_tag=data.asset_tag,
                warehouse=warehouse,
                registered_by=member,
            )
    except IntegrityError as exc:
        if (
            getattr(getattr(exc.__cause__, "diag", None), "constraint_name", None)
            == "asset_tag_unique"
        ):
            raise conflict("Asset tag already exists.", code="asset_tag_exists") from exc
        raise
    asset.serial_number = data.serial_number
    asset.registration_key = data.request_key
    asset.registration_fingerprint = fingerprint
    asset.registration_photo = photo
    asset.save(
        update_fields=[
            "serial_number",
            "registration_key",
            "registration_photo",
            "registration_fingerprint",
        ]
    )
    record_company_event(identity, company_id, "equipment.asset.registered", asset)
    return asset, True
