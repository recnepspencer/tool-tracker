from django.db import models
from django.db.models import Q

from companies.constraints import ScopedForeignKey

from .base import CompanyRecord


class Warehouse(CompanyRecord):
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta(CompanyRecord.Meta):
        db_table = "warehouses"
        constraints = [
            *CompanyRecord.Meta.constraints,
            models.UniqueConstraint(fields=["company", "code"], name="warehouse_code_unique"),
        ]


class ToolCategory(CompanyRecord):
    name = models.CharField(max_length=120)

    class Meta(CompanyRecord.Meta):
        db_table = "tool_categories"


class ToolModel(CompanyRecord):
    name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=120)
    model_number = models.CharField(max_length=120)
    category = models.ForeignKey(ToolCategory, on_delete=models.PROTECT)

    class Meta(CompanyRecord.Meta):
        db_table = "tool_models"
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="category", name="model_category_company"),
        ]


class ToolAsset(CompanyRecord):
    class Lifecycle(models.TextChoices):
        ACTIVE = "active"
        RETIRED = "retired"
        DISPOSED = "disposed"

    class Serviceability(models.TextChoices):
        SERVICEABLE = "serviceable"
        DAMAGED = "damaged"
        OUT_OF_SERVICE = "out_of_service"

    tool_model = models.ForeignKey(ToolModel, on_delete=models.PROTECT)
    asset_tag = models.CharField(max_length=64)
    serial_number = models.CharField(max_length=120, null=True, blank=True)
    origin_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="origin_assets"
    )
    responsible_warehouse = models.ForeignKey(
        Warehouse, on_delete=models.PROTECT, related_name="responsible_assets"
    )
    lifecycle = models.CharField(max_length=16, choices=Lifecycle, default=Lifecycle.ACTIVE)
    serviceability = models.CharField(
        max_length=20, choices=Serviceability, default=Serviceability.SERVICEABLE
    )
    revision = models.PositiveBigIntegerField(default=1)
    registered_by = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    registered_at = models.DateTimeField(auto_now_add=True)

    class Meta(CompanyRecord.Meta):
        db_table = "tool_assets"
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="tool_model", name="asset_model_company"),
            ScopedForeignKey(field="origin_warehouse", name="asset_origin_company"),
            ScopedForeignKey(field="responsible_warehouse", name="asset_warehouse_company"),
            ScopedForeignKey(field="registered_by", name="asset_registrar_company"),
            models.UniqueConstraint(fields=["company", "asset_tag"], name="asset_tag_unique"),
            models.CheckConstraint(
                condition=Q(lifecycle__in=["active", "retired", "disposed"]),
                name="asset_lifecycle_valid",
            ),
            models.CheckConstraint(
                condition=Q(serviceability__in=["serviceable", "damaged", "out_of_service"]),
                name="asset_serviceability_valid",
            ),
            models.CheckConstraint(condition=Q(revision__gte=1), name="asset_revision_positive"),
        ]
