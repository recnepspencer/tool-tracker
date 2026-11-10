from datetime import timedelta
from io import StringIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.apps import apps
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, connection, transaction
from django.db.migrations.autodetector import MigrationAutodetector
from django.db.migrations.executor import MigrationExecutor
from django.db.migrations.loader import MigrationLoader
from django.db.migrations.operations.models import AddConstraint, RemoveConstraint
from django.db.migrations.state import ProjectState
from django.utils import timezone

from companies.constraints import ScopedForeignKey
from equipment.asset_creation import create_asset_at_warehouse
from equipment.models import CustodyPeriod, ToolAsset, ToolRequest

pytestmark = pytest.mark.django_db(transaction=True)


def historical_tools(apps, company, member):
    """Two identical units stored the way an older schema kept them, tags and codes included."""
    Warehouse = apps.get_model("equipment", "Warehouse")
    Category = apps.get_model("equipment", "ToolCategory")
    Model = apps.get_model("equipment", "ToolModel")
    Asset = apps.get_model("equipment", "ToolAsset")
    Custody = apps.get_model("equipment", "CustodyPeriod")
    with transaction.atomic():
        warehouse = Warehouse.objects.create(
            company_id=company.pk, code="MAIN", name="Main warehouse"
        )
        category = Category.objects.create(company_id=company.pk, name="Drills")
        model = Model.objects.create(
            company_id=company.pk,
            category_id=category.pk,
            name="Hammer drill",
            manufacturer="Milwaukee",
            model_number="2904-20",
        )
        assets = []
        for tag in ("NE-001", "NE-002"):
            asset = Asset.objects.create(
                company_id=company.pk,
                tool_model_id=model.pk,
                asset_tag=tag,
                origin_warehouse_id=warehouse.pk,
                responsible_warehouse_id=warehouse.pk,
                registered_by_id=member.pk,
            )
            Custody.objects.create(
                company_id=company.pk,
                asset_id=asset.pk,
                holder_warehouse_id=warehouse.pk,
                starts_at=timezone.now() - timedelta(hours=1),
            )
            assets.append(asset)
    return SimpleNamespace(warehouse=warehouse, model=model, assets=assets)


def without(rows, *fields):
    return [{key: value for key, value in row.items() if key not in fields} for row in rows]


def test_purchase_details_upgrade_preserves_existing_units_and_custody(password_hash):
    # Removing tags and warehouse codes cannot be reversed over stored rows, so the
    # older records are written after rolling back to the schema that held them.
    from companies.models import Company
    from tests.factories import member_in

    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("equipment", "0005_registration_retry_fingerprint")]
    try:
        executor.migrate(previous)
        historical = executor.loader.project_state(previous).apps
        company = Company.objects.create(name="Existing tools")
        member = member_in(company, password_hash)
        tools = historical_tools(historical, company, member.member)
        Asset = historical.get_model("equipment", "ToolAsset")
        Custody = historical.get_model("equipment", "CustodyPeriod")
        before = without(Asset.objects.order_by("pk").values(), "asset_tag")
        custody = list(Custody.objects.order_by("pk").values())
        MigrationExecutor(connection).migrate(latest)
        assert list(ToolAsset.objects.order_by("pk").values(*before[0])) == before
        assert list(CustodyPeriod.objects.order_by("pk").values()) == custody
        for asset in ToolAsset.objects.all():
            assert asset.acquisition_date is None
            assert asset.acquisition_cost is None
            assert asset.notes == ""
        unit = ToolAsset.objects.filter(pk=tools.assets[0].pk)
        with pytest.raises(IntegrityError) as error, transaction.atomic():
            unit.update(acquisition_cost=-1)
        assert error.value.__cause__.diag.constraint_name == "asset_acquisition_cost_valid"
        # Prices are always US dollars, so a price needs nothing else beside it.
        unit.update(acquisition_cost=10)
    finally:
        MigrationExecutor(connection).migrate(latest)


def test_company_profile_upgrade_preserves_existing_company_identity():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("companies", "0002_membershipinvitation_and_more")]
    try:
        executor.migrate(previous)
        Company = executor.loader.project_state(previous).apps.get_model("companies", "Company")
        company = Company.objects.create(
            name="Historical Electric", timezone="America/Chicago", revision=7
        )
        identity = company.pk
        MigrationExecutor(connection).migrate(latest)
        from companies.models import Company as CurrentCompany

        upgraded = CurrentCompany.objects.get(pk=identity)
        assert (upgraded.name, upgraded.timezone, upgraded.revision, upgraded.address) == (
            "Historical Electric",
            "America/Chicago",
            7,
            "",
        )
    finally:
        MigrationExecutor(connection).migrate(latest)


def test_work_decision_note_upgrade_preserves_existing_participation(password_hash):
    from django.utils import timezone

    from companies.models import Company
    from tests.factories import member_in

    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("work", "0001_initial")]
    try:
        executor.migrate(previous)
        historical = executor.loader.project_state(previous).apps
        company = Company.objects.create(name="Existing work records")
        actor = member_in(company, password_hash, "admin")
        Project = historical.get_model("work", "Project")
        Job = historical.get_model("work", "Job")
        Request = historical.get_model("work", "JobParticipationRequest")
        project = Project.objects.create(company_id=company.pk, number="OLD-P", name="Campus")
        job = Job.objects.create(
            company_id=company.pk, project=project, number="OLD-J", name="Rough-in"
        )
        request = Request.objects.create(
            company_id=company.pk,
            job=job,
            membership_id=actor.member.pk,
            intent="join",
            request_key=uuid4(),
            status="rejected",
            policy_revision=3,
            reason="Original request",
            decided_by_id=actor.member.pk,
            decided_at=timezone.now(),
            revision=2,
        )
        before = Request.objects.values().get(pk=request.pk)
        MigrationExecutor(connection).migrate(latest)
        from work.models import JobParticipationRequest

        upgraded = JobParticipationRequest.objects.get(pk=request.pk)
        assert JobParticipationRequest.objects.values(*before).get(pk=request.pk) == before
        assert upgraded.decision_note == ""  # An unknown historical note is not invented.
    finally:
        MigrationExecutor(connection).migrate(latest)


def test_existing_database_upgrades_without_losing_assets_custody_or_requests(password_hash):
    from companies.models import Company
    from tests.factories import member_in

    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("equipment", "0002_company_and_custody_integrity")]
    try:
        executor.migrate(previous)
        old_apps = executor.loader.project_state(previous).apps
        company = Company.objects.create(name="Existing records")
        member = member_in(company, password_hash)
        tools = historical_tools(old_apps, company, member.member)
        Request = old_apps.get_model("equipment", "ToolRequest")
        Asset = old_apps.get_model("equipment", "ToolAsset")
        Custody = old_apps.get_model("equipment", "CustodyPeriod")
        request = Request.objects.create(
            company_id=company.pk,
            requester_id=member.member.pk,
            asset_id=tools.assets[0].pk,
            source_custody_id=Custody.objects.get(asset_id=tools.assets[0].pk).pk,
            request_key=uuid4(),
            note="Preserve this request across the upgrade",
        )
        asset_rows = without(Asset.objects.order_by("id").values(), "asset_tag")
        custody_rows = list(Custody.objects.order_by("id").values())
        request_rows = list(Request.objects.order_by("id").values())
        # Reversal really restored the historical trigger, not just its migration state.
        with pytest.raises(IntegrityError, match="requires exactly one"), transaction.atomic():
            Asset.objects.create(
                company_id=company.pk,
                tool_model_id=tools.model.pk,
                asset_tag="OLD-ORPHAN",
                origin_warehouse_id=tools.warehouse.pk,
                responsible_warehouse_id=tools.warehouse.pk,
                registered_by_id=member.member.pk,
            )
        MigrationExecutor(connection).migrate(latest)
        assert list(ToolAsset.objects.order_by("id").values(*asset_rows[0])) == asset_rows
        assert list(CustodyPeriod.objects.order_by("id").values()) == custody_rows
        assert list(ToolRequest.objects.order_by("id").values(*request_rows[0])) == request_rows
        assert ToolRequest.objects.get(pk=request.pk).source_custody.asset_id == tools.assets[0].pk
        call_command("check_database_schema", stdout=StringIO())
    finally:
        MigrationExecutor(connection).migrate(latest)


def test_three_roles_upgrade_keeps_each_persons_strongest_role():
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("companies", "0004_company_logo_and_owner")]
    try:
        executor.migrate(previous)
        historical = executor.loader.project_state(previous).apps
        Company = historical.get_model("companies", "Company")
        Person = historical.get_model("companies", "Person")
        Membership = historical.get_model("companies", "CompanyMembership")
        Grant = historical.get_model("companies", "CompanyRoleGrant")
        Invitation = historical.get_model("companies", "MembershipInvitation")
        company = Company.objects.create(name="Old roles")

        def member(name, *roles, revoked=()):
            person = Person.objects.create(preferred_name=name)
            result = Membership.objects.create(company_id=company.pk, person_id=person.pk)
            for role in roles:
                Grant.objects.create(membership_id=result.pk, role_code=role)
            for role in revoked:
                Grant.objects.create(
                    membership_id=result.pk, role_code=role, revoked_at=timezone.now()
                )
            return result.pk

        expected = {
            member("Admin", "company_admin"): "admin",
            member("Equipment", "equipment_manager"): "manager",
            member("Dispatch", "dispatcher"): "manager",
            member("Estimate", "estimator"): "foreman",
            member("Field", "field_member"): "foreman",
            member("Former admin", "field_member", revoked=["company_admin"]): "foreman",
        }
        both = member("Field and dispatch", "field_member", "dispatcher")
        expected[both] = "manager"
        twice = member("Two manager roles", "equipment_manager", "dispatcher")
        expected[twice] = "manager"
        Invitation.objects.create(
            company_id=company.pk,
            email="invited@example.com",
            preferred_name="Invited",
            role_code="dispatcher",
            token_digest="0" * 64,
            expires_at=timezone.now() + timedelta(days=1),
            invited_by_id=next(iter(expected)),
        )
        MigrationExecutor(connection).migrate(latest)
        from companies.models import CompanyRoleGrant, MembershipInvitation

        live = CompanyRoleGrant.objects.filter(revoked_at__isnull=True)
        assert live.count() == len(expected)
        assert dict(live.values_list("membership_id", "role_code")) == expected
        # The weaker role is ended, not deleted, so the history stays readable.
        for membership in (both, twice):
            assert CompanyRoleGrant.objects.filter(membership_id=membership).count() == 2
        assert set(
            CompanyRoleGrant.objects.filter(revoked_at__isnull=False).values_list(
                "role_code", flat=True
            )
        ) == {"admin", "foreman", "manager"}
        assert MembershipInvitation.objects.get().role_code == "manager"
        call_command("check_database_schema", stdout=StringIO())
    finally:
        MigrationExecutor(connection).migrate(latest)


def test_scoped_constraint_changes_generate_and_apply_database_operations():
    loader = MigrationLoader(connection)
    before = loader.project_state()
    after = before.clone()
    after.remove_constraint("equipment", "toolrequest", "request_source_same_asset")
    after.add_constraint(
        "equipment",
        "toolrequest",
        ScopedForeignKey(field="source_custody", name="request_source_same_asset"),
    )
    changes = MigrationAutodetector(before, after).changes(graph=loader.graph)
    migration = changes["equipment"][0]
    assert [type(op) for op in migration.operations] == [RemoveConstraint, AddConstraint]
    try:
        with connection.schema_editor() as editor:
            applied = migration.apply(before.clone(), editor)
        # A migration that weakens the scope is observable in PostgreSQL, not state-only.
        with pytest.raises(CommandError, match="request_source_same_asset"):
            call_command("check_database_schema")
    finally:
        with connection.schema_editor() as editor:
            migration.unapply(before.clone(), editor)
    assert (
        applied.models["equipment", "toolrequest"].options
        != before.models["equipment", "toolrequest"].options
    )
    call_command("check_database_schema", stdout=StringIO())


@pytest.mark.parametrize("mutation", ["missing", "unvalidated", "extra"])
def test_schema_check_rejects_actual_database_drift(mutation):
    # Transaction rollback restores schema even when an assertion fails.
    with transaction.atomic():
        with connection.cursor() as cursor:
            if mutation in {"missing", "unvalidated"}:
                cursor.execute("ALTER TABLE tool_assets DROP CONSTRAINT asset_warehouse_company")
            if mutation == "unvalidated":
                cursor.execute(
                    "ALTER TABLE tool_assets ADD CONSTRAINT asset_warehouse_company "
                    "FOREIGN KEY (company_id, responsible_warehouse_id) "
                    "REFERENCES warehouses (company_id, id) NOT VALID"
                )
            if mutation == "extra":
                cursor.execute(
                    "ALTER TABLE tool_assets ADD CONSTRAINT unmodeled_company_constraint "
                    "FOREIGN KEY (company_id, responsible_warehouse_id) "
                    "REFERENCES warehouses (company_id, id)"
                )
        with pytest.raises(CommandError, match="Database schema drift"):
            call_command("check_database_schema")
        transaction.set_rollback(True)


def test_new_company_relationship_requires_scope_declaration(monkeypatch):
    constraints = [c for c in ToolAsset._meta.constraints if c.name != "asset_warehouse_company"]
    monkeypatch.setattr(ToolAsset._meta, "constraints", constraints)
    with pytest.raises(
        CommandError, match="responsible_warehouse: missing company scope declaration"
    ):
        call_command("check_database_schema")


def test_models_match_migration_state():
    loader = MigrationLoader(connection)
    changes = MigrationAutodetector(loader.project_state(), ProjectState.from_apps(apps)).changes(
        graph=loader.graph
    )
    assert changes == {}
    call_command("check_database_schema", stdout=StringIO())


def test_column_and_target_table_renames_preserve_company_enforcement(world):
    loader = MigrationLoader(connection)
    before = loader.project_state()
    after = before.clone()
    field = after.models["equipment", "toolasset"].fields["origin_warehouse"].clone()
    field.db_column = "original_warehouse_id"
    after.alter_field("equipment", "toolasset", "origin_warehouse", field, preserve_default=True)
    after.models["equipment", "warehouse"].options["db_table"] = "renamed_warehouses"
    after.reload_model("equipment", "warehouse")
    migration = MigrationAutodetector(before, after).changes(graph=loader.graph)["equipment"][0]
    try:
        with connection.schema_editor() as editor:
            applied = migration.apply(before.clone(), editor)
        Asset = applied.apps.get_model("equipment", "ToolAsset")
        Warehouse = applied.apps.get_model("equipment", "Warehouse")
        foreign = Warehouse.objects.create(company_id=world.other_company.pk, name="Other")
        with pytest.raises(IntegrityError) as error, transaction.atomic():
            Asset.objects.filter(pk=world.assets[0].pk).update(origin_warehouse=foreign)
        assert error.value.__cause__.diag.constraint_name == "asset_origin_company"
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='asset_origin_company'"
            )
            definition = cursor.fetchone()[0]
        assert "original_warehouse_id" in definition
        assert "renamed_warehouses" in definition
    finally:
        with connection.schema_editor() as editor:
            migration.unapply(before.clone(), editor)
    call_command("check_database_schema", stdout=StringIO())


def test_atomic_asset_creation_establishes_initial_custody(world):
    asset = create_asset_at_warehouse(
        company=world.company,
        tool_model=world.model,
        warehouse=world.warehouse,
        registered_by=world.member,
    )
    custody = CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True)
    assert custody.holder_warehouse == world.warehouse
    assert custody.company == world.company
