from django.db import models
from django.db.models import Q

from companies.base import CompanyRecord
from companies.constraints import ScopedForeignKey


class ToolRegistrationPolicy(models.Model):
    company = models.OneToOneField("companies.Company", primary_key=True, on_delete=models.PROTECT)
    employee_tool_creation_enabled = models.BooleanField(default=False)
    revision = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        "companies.CompanyMembership", null=True, on_delete=models.PROTECT
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            ScopedForeignKey(field="updated_by", name="registration_policy_actor_company")
        ]


class WarehouseRoleGrant(CompanyRecord):
    warehouse = models.ForeignKey("equipment.Warehouse", on_delete=models.PROTECT)
    membership = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    granted_by = models.ForeignKey(
        "companies.CompanyMembership",
        on_delete=models.PROTECT,
        related_name="warehouse_grants_given",
    )
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="warehouse", name="warehouse_grant_warehouse_company"),
            ScopedForeignKey(field="membership", name="warehouse_grant_member_company"),
            ScopedForeignKey(field="granted_by", name="warehouse_grant_actor_company"),
            models.UniqueConstraint(
                fields=["warehouse", "membership"],
                condition=Q(revoked_at__isnull=True),
                name="one_live_warehouse_grant",
            ),
        ]


class CustodyHandoff(CompanyRecord):
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    source_custody = models.ForeignKey("equipment.CustodyPeriod", on_delete=models.PROTECT)
    destination_membership = models.ForeignKey(
        "companies.CompanyMembership", null=True, on_delete=models.PROTECT
    )
    destination_warehouse = models.ForeignKey(
        "equipment.Warehouse", null=True, on_delete=models.PROTECT
    )
    tool_request = models.ForeignKey("equipment.ToolRequest", null=True, on_delete=models.PROTECT)
    proposed_by = models.ForeignKey(
        "companies.CompanyMembership", on_delete=models.PROTECT, related_name="handoffs_proposed"
    )
    request_key = models.UUIDField()
    status = models.CharField(max_length=16, default="pending")
    note = models.TextField(blank=True)
    proposed_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True)
    resolved_by = models.ForeignKey(
        "companies.CompanyMembership",
        null=True,
        on_delete=models.PROTECT,
        related_name="handoffs_resolved",
    )
    resolution_note = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="handoff_asset_company"),
            ScopedForeignKey(
                field="source_custody", scope=("company", "asset"), name="handoff_source_asset"
            ),
            ScopedForeignKey(
                field="destination_membership", name="handoff_destination_member_company"
            ),
            ScopedForeignKey(
                field="destination_warehouse", name="handoff_destination_warehouse_company"
            ),
            ScopedForeignKey(
                field="tool_request", scope=("company", "asset"), name="handoff_request_asset"
            ),
            ScopedForeignKey(field="proposed_by", name="handoff_proposer_company"),
            ScopedForeignKey(field="resolved_by", name="handoff_resolver_company"),
            models.CheckConstraint(
                condition=Q(
                    destination_membership__isnull=False, destination_warehouse__isnull=True
                )
                | Q(destination_membership__isnull=True, destination_warehouse__isnull=False),
                name="handoff_one_destination",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "accepted", "declined", "cancelled"]),
                name="handoff_status_valid",
            ),
            models.UniqueConstraint(
                fields=["asset"], condition=Q(status="pending"), name="one_pending_handoff"
            ),
            models.UniqueConstraint(
                fields=["proposed_by", "request_key"], name="handoff_retry_key"
            ),
        ]


class AssetServiceEvent(CompanyRecord):
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    performed_by = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    occurred_at = models.DateTimeField(auto_now_add=True)
    resulting_serviceability = models.CharField(max_length=20)
    note = models.TextField()

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="service_asset_company"),
            ScopedForeignKey(field="performed_by", name="service_actor_company"),
            models.CheckConstraint(
                condition=Q(
                    resulting_serviceability__in=["serviceable", "damaged", "out_of_service"]
                ),
                name="service_condition_valid",
            ),
        ]


class AssetLifecycleEvent(CompanyRecord):
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    actor = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    occurred_at = models.DateTimeField(auto_now_add=True)
    from_lifecycle = models.CharField(max_length=16)
    to_lifecycle = models.CharField(max_length=16)
    reason = models.TextField()

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="lifecycle_asset_company"),
            ScopedForeignKey(field="actor", name="lifecycle_actor_company"),
            models.CheckConstraint(
                condition=Q(from_lifecycle__in=["active", "retired", "disposed"])
                & Q(to_lifecycle__in=["active", "retired", "disposed"]),
                name="lifecycle_event_states_valid",
            ),
        ]


class ReconciliationCase(CompanyRecord):
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    kind = models.CharField(max_length=24)
    opened_by = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    narrative = models.TextField()
    opened_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True)
    resolved_by = models.ForeignKey(
        "companies.CompanyMembership",
        null=True,
        on_delete=models.PROTECT,
        related_name="reconciliations_resolved",
    )
    resolution_note = models.TextField(blank=True)
    corrected_custody = models.ForeignKey(
        "equipment.CustodyPeriod", null=True, on_delete=models.PROTECT
    )
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="reconciliation_asset_company"),
            ScopedForeignKey(field="opened_by", name="reconciliation_opener_company"),
            ScopedForeignKey(field="resolved_by", name="reconciliation_resolver_company"),
            ScopedForeignKey(
                field="corrected_custody",
                scope=("company", "asset"),
                name="reconciliation_custody_asset",
            ),
            models.CheckConstraint(
                condition=Q(kind__in=["custody_dispute", "missing_asset", "duplicate_asset"]),
                name="reconciliation_kind_valid",
            ),
        ]
