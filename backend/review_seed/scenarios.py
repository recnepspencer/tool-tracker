"""Deterministic review identities and coherent scenarios; never reset existing records."""

from datetime import timedelta
from uuid import NAMESPACE_URL, uuid5

from cleanforce_identity.models import PlatformUser
from django.db import transaction
from django.utils import timezone

from companies.models import Company, CompanyMembership, CompanyRoleGrant, Person
from equipment.models import (
    AssetIncident,
    CustodyHandoff,
    CustodyPeriod,
    ToolAsset,
    ToolCategory,
    ToolModel,
    ToolRegistrationPolicy,
    ToolRequest,
    Warehouse,
    WarehouseRoleGrant,
)
from work.models import Job, JobAssignment, JobAssignmentPolicy, JobParticipationRequest, Project


def review_id(name):
    return uuid5(NAMESPACE_URL, f"nelson-electric/local-review/{name}")


@transaction.atomic
def seed_review_scenarios(password):
    company, _ = Company.objects.get_or_create(
        id=review_id("company"), defaults={"name": "Nelson Electric review"}
    )
    Company.objects.select_for_update().get(pk=company.pk)
    members = {}
    profiles = [
        ("admin", "Morgan Administrator", "company_admin", "active"),
        ("manager", "Sam Equipment Manager", "equipment_manager", "active"),
        ("reviewer", "Ray Foreman", "field_member", "active"),
        ("apprentice", "Alex Apprentice", "field_member", "active"),
        ("warehouse", "Jo North Warehouse", "field_member", "active"),
        ("estimator", "Casey Estimator", "estimator", "active"),
        ("suspended", "Taylor Suspended", "field_member", "suspended"),
    ]
    for key, name, role, access in profiles:
        user, created = PlatformUser.objects.get_or_create(email=f"{key}@example.com")
        if created:
            user.set_password(password)
            user.save()
        person, _ = Person.objects.get_or_create(
            identity_user=user, defaults={"preferred_name": name}
        )
        member, created = CompanyMembership.objects.get_or_create(
            company=company,
            person=person,
            defaults={"id": review_id(f"member/{key}"), "access_state": access},
        )
        if created:
            CompanyRoleGrant.objects.create(membership=member, role_code=role)
        members[key] = member
    warehouses = {}
    for code, name in [("MAIN", "Main warehouse"), ("NORTH", "North warehouse")]:
        warehouse, created = Warehouse.objects.get_or_create(
            company=company,
            code=code,
            defaults={
                "id": review_id(f"warehouse/{code}"),
                "name": name,
                "address": f"{code.title()} review location",
            },
        )
        warehouses[code] = warehouse
        if created and code == "NORTH":
            WarehouseRoleGrant.objects.create(
                company=company,
                warehouse=warehouse,
                membership=members["warehouse"],
                granted_by=members["admin"],
            )
    ToolRegistrationPolicy.objects.get_or_create(
        company=company,
        defaults={"employee_tool_creation_enabled": True, "updated_by": members["admin"]},
    )
    JobAssignmentPolicy.objects.get_or_create(
        company=company,
        defaults={"self_join_mode": "direct", "self_leave_mode": "approval_required"},
    )
    category, _ = ToolCategory.objects.get_or_create(
        id=review_id("category"), defaults={"company": company, "name": "Drills"}
    )
    model, _ = ToolModel.objects.get_or_create(
        id=review_id("drill-model"),
        defaults={
            "company": company,
            "category": category,
            "name": "M18 hammer drill",
            "manufacturer": "Milwaukee",
            "model_number": "2904-20",
        },
    )
    laser_category, _ = ToolCategory.objects.get_or_create(
        id=review_id("laser-category"), defaults={"company": company, "name": "Measuring equipment"}
    )
    laser, _ = ToolModel.objects.get_or_create(
        id=review_id("laser-model"),
        defaults={
            "company": company,
            "category": laser_category,
            "name": "Three-plane laser",
            "manufacturer": "DeWalt",
            "model_number": "DCE089",
        },
    )
    now = timezone.now()
    assets = {}
    scenarios = [
        ("NE-001", model, "MAIN", None, "serviceable", False, "active"),
        ("NE-002", model, "MAIN", None, "serviceable", False, "active"),
        ("NE-003", laser, "MAIN", "reviewer", "serviceable", False, "active"),
        ("NE-004", model, "MAIN", None, "damaged", False, "active"),
        ("NE-005", model, "MAIN", "reviewer", "damaged", True, "active"),
        ("NE-006", model, "MAIN", "reviewer", "serviceable", False, "active"),
        ("NE-007", laser, "MAIN", "apprentice", "serviceable", False, "active"),
        ("NE-008", model, "NORTH", None, "serviceable", False, "active"),
        ("NE-009", model, "MAIN", None, "out_of_service", False, "retired"),
        ("NE-010", laser, "MAIN", None, "serviceable", False, "active"),
    ]
    for tag, definition, code, holder, condition, missing, lifecycle in scenarios:
        warehouse = warehouses[code]
        asset, created = ToolAsset.objects.get_or_create(
            company=company,
            asset_tag=tag,
            defaults={
                "id": review_id(f"asset/{tag}"),
                "tool_model": definition,
                "origin_warehouse": warehouse,
                "responsible_warehouse": warehouse,
                "registered_by": members["manager"],
                "serviceability": condition,
                "serial_number": f"REVIEW-{tag}",
                "lifecycle": lifecycle,
            },
        )
        assets[tag] = asset
        if not created:
            continue
        if holder:
            CustodyPeriod.objects.create(
                company=company,
                asset=asset,
                holder_warehouse=warehouse,
                starts_at=now - timedelta(days=14),
                ends_at=now - timedelta(days=3),
            )
        custody = CustodyPeriod.objects.create(
            company=company,
            asset=asset,
            holder_membership=members[holder] if holder else None,
            holder_warehouse=warehouse if not holder else None,
            starts_at=now - timedelta(days=3),
        )
        for kind in (["damage"] if condition == "damaged" else []) + (
            ["missing"] if missing else []
        ):
            AssetIncident.objects.create(
                company=company,
                asset=asset,
                kind=kind,
                reported_by=members[holder or "manager"],
                description=f"Review scenario: {kind} recorded; custody remains accountable.",
            )
        if tag in {"NE-006", "NE-007"}:
            CustodyHandoff.objects.create(
                id=review_id(f"handoff/{tag}"),
                company=company,
                asset=asset,
                source_custody=custody,
                destination_membership=members["apprentice"] if tag == "NE-006" else None,
                destination_warehouse=warehouse if tag == "NE-007" else None,
                proposed_by=members[holder],
                request_key=review_id(f"handoff-key/{tag}"),
                note="Review pending transfer" if tag == "NE-006" else "Review pending return",
            )
        if tag in {"NE-008", "NE-010"}:
            approved = tag == "NE-010"
            request = ToolRequest.objects.create(
                id=review_id(f"request/{tag}"),
                company=company,
                asset=asset,
                requester=members["reviewer"],
                source_custody=custody,
                request_key=review_id(f"request-key/{tag}"),
                status="approved" if approved else "pending",
                note="Review specific-unit request",
                decided_by=members["manager"] if approved else None,
                decided_at=now if approved else None,
            )
            if approved:
                CustodyHandoff.objects.create(
                    id=review_id(f"handoff/{tag}"),
                    company=company,
                    asset=asset,
                    source_custody=custody,
                    destination_membership=members["reviewer"],
                    tool_request=request,
                    proposed_by=members["manager"],
                    request_key=review_id(f"handoff-key/{tag}"),
                    note="Approved; awaiting actual receipt",
                )
    project, _ = Project.objects.get_or_create(
        id=review_id("project"),
        defaults={"company": company, "number": "P-100", "name": "Riverside campus"},
    )
    jobs = {}
    for number, name, status, archived in [
        ("J-100", "Electrical rough-in", "active", False),
        ("J-200", "Finish electrical", "active", False),
        ("J-OLD", "Completed service call", "completed", True),
    ]:
        job, created = Job.objects.get_or_create(
            id=review_id(f"job/{number}"),
            defaults={
                "company": company,
                "project": project,
                "number": number,
                "name": name,
                "status": status,
                "archived_at": now if archived else None,
            },
        )
        jobs[number] = job
        if created:
            assignment = JobAssignment.objects.create(
                company=company,
                job=job,
                membership=members["reviewer"],
                responsibility="foreman",
                assigned_by=members["admin"],
                starts_at=now - timedelta(days=7),
                ends_at=now - timedelta(days=1) if archived else None,
                ended_by=members["admin"] if archived else None,
                end_reason="Completed review job" if archived else "",
            )
            if number == "J-200":
                JobParticipationRequest.objects.create(
                    id=review_id("leave-request"),
                    company=company,
                    job=job,
                    membership=members["reviewer"],
                    intent="leave",
                    target_assignment=assignment,
                    request_key=review_id("leave-request-key"),
                    policy_revision=1,
                    reason="Review approval-required departure",
                )
    return {
        "company": company,
        "members": members,
        "warehouses": warehouses,
        "assets": assets,
        "jobs": jobs,
    }
