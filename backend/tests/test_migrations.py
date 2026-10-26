from io import StringIO
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

from companies.constraints import ScopedForeignKey
from equipment.asset_creation import create_asset_at_warehouse
from equipment.models import CustodyPeriod, ToolAsset, ToolRequest

pytestmark = pytest.mark.django_db(transaction=True)


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


def test_existing_database_upgrades_without_losing_assets_custody_or_requests(world):
    executor = MigrationExecutor(connection)
    latest = executor.loader.graph.leaf_nodes()
    previous = [("equipment", "0002_company_and_custody_integrity")]
    try:
        executor.migrate(previous)
        old_apps = executor.loader.project_state(previous).apps
        Request = old_apps.get_model("equipment", "ToolRequest")
        Asset = old_apps.get_model("equipment", "ToolAsset")
        request = Request.objects.create(
            company_id=world.company.pk,
            requester_id=world.member.pk,
            asset_id=world.assets[0].pk,
            source_custody_id=CustodyPeriod.objects.get(asset=world.assets[0]).pk,
            request_key=uuid4(),
            note="Preserve this request across the upgrade",
        )
        asset_rows = list(Asset.objects.order_by("id").values())
        custody_rows = list(CustodyPeriod.objects.order_by("id").values())
        request_rows = list(Request.objects.order_by("id").values())
        # Reversal really restored the historical trigger, not just its migration state.
        with pytest.raises(IntegrityError, match="requires exactly one"), transaction.atomic():
            Asset.objects.create(
                company_id=world.company.pk,
                tool_model_id=world.model.pk,
                asset_tag="OLD-ORPHAN",
                origin_warehouse_id=world.warehouse.pk,
                responsible_warehouse_id=world.warehouse.pk,
                registered_by_id=world.member.pk,
            )
        MigrationExecutor(connection).migrate(latest)
        assert list(ToolAsset.objects.order_by("id").values(*asset_rows[0])) == asset_rows
        assert list(CustodyPeriod.objects.order_by("id").values()) == custody_rows
        assert list(ToolRequest.objects.order_by("id").values(*request_rows[0])) == request_rows
        assert ToolRequest.objects.get(pk=request.pk).source_custody.asset_id == world.assets[0].pk
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
        foreign = Warehouse.objects.create(
            company_id=world.other_company.pk, code="OTHER", name="Other"
        )
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
        asset_tag="NEW-001",
        warehouse=world.warehouse,
        registered_by=world.member,
    )
    custody = CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True)
    assert custody.holder_warehouse == world.warehouse
    assert custody.company == world.company
