from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.db import models
from django.db.models import F, Func, Q, Value

from companies.constraints import ScopedForeignKey

from .base import CompanyRecord


class CustodyPeriod(CompanyRecord):
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    holder_membership = models.ForeignKey(
        "companies.CompanyMembership", on_delete=models.PROTECT, null=True, blank=True
    )
    holder_warehouse = models.ForeignKey(
        "equipment.Warehouse", on_delete=models.PROTECT, null=True, blank=True
    )
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)

    class Meta(CompanyRecord.Meta):
        db_table = "custody_periods"
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="custody_asset_company"),
            ScopedForeignKey(field="holder_membership", name="custody_member_company"),
            ScopedForeignKey(field="holder_warehouse", name="custody_warehouse_company"),
            models.UniqueConstraint(
                fields=["company", "asset", "id"], name="custody_asset_identity"
            ),
            models.CheckConstraint(
                condition=(
                    Q(holder_membership__isnull=False, holder_warehouse__isnull=True)
                    | Q(holder_membership__isnull=True, holder_warehouse__isnull=False)
                ),
                name="custody_exactly_one_holder",
            ),
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(ends_at__gt=F("starts_at")),
                name="custody_positive_interval",
            ),
            models.UniqueConstraint(
                fields=["asset"], condition=Q(ends_at__isnull=True), name="one_open_custody"
            ),
            ExclusionConstraint(
                name="custody_no_overlapping_intervals",
                expressions=[
                    ("asset", RangeOperators.EQUAL),
                    (
                        Func(
                            F("starts_at"),
                            F("ends_at"),
                            Value("[)"),
                            function="TSTZRANGE",
                            output_field=DateTimeRangeField(),
                        ),
                        RangeOperators.OVERLAPS,
                    ),
                ],
            ),
        ]
        indexes = [
            models.Index(
                fields=["company", "holder_membership"],
                name="custody_person_open",
                condition=Q(ends_at__isnull=True),
            ),
            models.Index(
                fields=["company", "holder_warehouse"],
                name="custody_warehouse_open",
                condition=Q(ends_at__isnull=True),
            ),
        ]


class AssetIncident(CompanyRecord):
    class Kind(models.TextChoices):
        DAMAGE = "damage"
        MISSING = "missing"

    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    kind = models.CharField(max_length=16, choices=Kind)
    reported_by = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    reported_at = models.DateTimeField(auto_now_add=True)
    description = models.TextField()
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta(CompanyRecord.Meta):
        db_table = "asset_incidents"
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="asset", name="incident_asset_company"),
            ScopedForeignKey(field="reported_by", name="incident_reporter_company"),
            models.CheckConstraint(
                condition=Q(kind__in=["damage", "missing"]), name="incident_kind_valid"
            ),
            models.UniqueConstraint(
                fields=["asset", "kind"],
                condition=Q(resolved_at__isnull=True),
                name="one_open_incident_kind",
            ),
        ]
