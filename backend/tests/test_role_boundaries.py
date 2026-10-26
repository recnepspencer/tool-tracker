"""Public HTTP authorization for each company role and supplemental warehouse scope."""

from uuid import uuid4

import pytest

from companies.models import CompanyRoleGrant, MembershipInvitation
from equipment.models import (
    CustodyPeriod,
    ToolAsset,
    ToolCategory,
    ToolRegistrationPolicy,
    Warehouse,
    WarehouseRoleGrant,
)
from tests.conftest import login_client
from tests.factories import member_in
from work.models import Job, Project

ROLES = ["company_admin", "equipment_manager", "dispatcher", "estimator", "field_member"]


@pytest.mark.parametrize("role", ROLES)
def test_public_read_surfaces_and_write_boundaries(world, password_hash, role):
    actor = member_in(world.company, password_hash, role)
    client = login_client(actor.user)
    base = f"/api/companies/{world.company.pk}"
    equipment = role in {"company_admin", "equipment_manager", "field_member"}
    catalog = role in {"company_admin", "equipment_manager"}
    work = role in {"company_admin", "dispatcher"}
    reads = {
        "": True,
        "/people": True,
        "/permissions": True,
        "/warehouses": True,
        "/activity": True,
        "/tool-registration-policy": True,
        "/projects": True,
        "/jobs": True,
        "/assignments": True,
        "/job-participation-policy": True,
        "/job-participation-requests": True,
        "/tools": equipment,
        "/tool-models": equipment,
        "/tool-categories": equipment,
        f"/tools/{world.assets[0].pk}": equipment,
        f"/tools/{world.assets[0].pk}/custody": equipment,
        f"/tools/{world.assets[0].pk}/service": equipment,
        "/tool-requests": equipment,
        "/handoffs": equipment,
        "/incidents": equipment,
        "/directory": equipment,
        "/invitations": role == "company_admin",
        "/reconciliations": catalog,
        "/summary": catalog,
    }
    for suffix, allowed in reads.items():
        response = client.get(base + suffix)
        assert response.status_code == (200 if allowed else 403), (role, suffix, response.content)

    def command(suffix, body, allowed, *, status=200):
        response = client.post(base + suffix, body, content_type="application/json")
        assert response.status_code == (status if allowed else 403), (
            role,
            suffix,
            response.content,
        )
        return response.json()

    command("/warehouses", {"code": "NEW", "name": "New location"}, catalog)
    assert Warehouse.objects.filter(company=world.company, code="NEW").exists() == catalog
    command("/tool-categories", {"name": "Meters"}, catalog)
    assert ToolCategory.objects.filter(company=world.company, name="Meters").exists() == catalog
    command(
        "/invitations",
        {"email": "invited@example.com", "preferred_name": "Invited", "role": "field_member"},
        role == "company_admin",
    )
    assert MembershipInvitation.objects.filter(company=world.company).exists() == (
        role == "company_admin"
    )
    command("/projects", {"number": "P1", "name": "Project"}, work)
    assert Project.objects.filter(company=world.company).exists() == work
    ToolRegistrationPolicy.objects.create(
        company=world.company, employee_tool_creation_enabled=True
    )
    command(
        "/tools",
        {
            "request_key": str(uuid4()),
            "tool_model_id": str(world.model.pk),
            "warehouse_id": str(world.warehouse.pk),
            "asset_tag": "REGISTERED",
        },
        equipment,
        status=201,
    )
    assert (
        ToolAsset.objects.filter(company=world.company, asset_tag="REGISTERED").exists()
        == equipment
    )
    command(
        f"/tools/{world.assets[0].pk}/requests",
        {"request_key": str(uuid4())},
        equipment,
        status=201,
    )
    command(
        f"/tools/{world.assets[1].pk}/service",
        {"expected_revision": 1, "serviceability": "damaged", "note": "Checked trigger"},
        catalog,
    )
    world.assets[1].refresh_from_db()
    assert world.assets[1].serviceability == ("damaged" if catalog else "serviceable")
    assert CustodyPeriod.objects.filter(
        asset=world.assets[1], ends_at__isnull=True, holder_warehouse=world.warehouse
    ).exists()
    command(
        f"/warehouses/{world.warehouse.pk}/authority",
        {"expected_revision": 1, "membership_id": str(world.member.pk), "enabled": True},
        role == "company_admin",
    )
    assert WarehouseRoleGrant.objects.filter(membership=world.member).exists() == (
        role == "company_admin"
    )


def test_combined_roles_and_job_responsibilities_do_not_create_warehouse_authority(
    world, password_hash
):
    from django.utils import timezone

    from work.models import JobAssignment

    actor = member_in(world.company, password_hash, "dispatcher")
    CompanyRoleGrant.objects.create(membership=actor.member, role_code="field_member")
    project = Project.objects.create(company=world.company, number="P1", name="Project")
    job = Job.objects.create(company=world.company, project=project, number="J1", name="Job")
    JobAssignment.objects.create(
        company=world.company,
        job=job,
        membership=actor.member,
        responsibility="foreman",
        assigned_by=world.member,
        starts_at=timezone.now(),
    )
    client = login_client(actor.user)
    base = f"/api/companies/{world.company.pk}"
    assert client.get(f"{base}/tools").status_code == 200
    assert (
        client.post(
            f"{base}/jobs/{job.pk}/assignments",
            {
                "expected_revision": 1,
                "membership_id": str(world.member.pk),
                "responsibility": "crew",
                "reason": "Staff the job",
            },
            content_type="application/json",
        ).status_code
        == 200
    )
    service = {"expected_revision": 1, "serviceability": "damaged", "note": "Inspection"}
    assert (
        client.post(
            f"{base}/tools/{world.assets[0].pk}/service", service, content_type="application/json"
        ).status_code
        == 403
    )
    WarehouseRoleGrant.objects.create(
        company=world.company,
        warehouse=world.warehouse,
        membership=actor.member,
        granted_by=world.member,
    )
    assert (
        client.post(
            f"{base}/tools/{world.assets[0].pk}/service", service, content_type="application/json"
        ).status_code
        == 200
    )
    foreign_warehouse = Warehouse.objects.create(
        company=world.company, code="OTHER", name="Other location"
    )
    world.assets[1].responsible_warehouse = foreign_warehouse
    world.assets[1].save(update_fields=["responsible_warehouse"])
    assert (
        client.post(
            f"{base}/tools/{world.assets[1].pk}/service", service, content_type="application/json"
        ).status_code
        == 403
    )
