from django.db import models
from django.db.models import Q

from companies.constraints import ScopedForeignKey

from .base import CompanyRecord


class Warehouse(CompanyRecord):
    code = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    archived_at = models.DateTimeField(null=True, blank=True)
    address = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        db_table = "warehouses"
        constraints = [
            *CompanyRecord.Meta.constraints,
            models.UniqueConstraint(fields=["company", "code"], name="warehouse_code_unique"),
        ]


class ToolCategory(CompanyRecord):
    name = models.CharField(max_length=120)
    archived_at = models.DateTimeField(null=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        db_table = "tool_categories"


class ToolModel(CompanyRecord):
    name = models.CharField(max_length=200)
    manufacturer = models.CharField(max_length=120)
    model_number = models.CharField(max_length=120)
    category = models.ForeignKey(ToolCategory, on_delete=models.PROTECT)
    archived_at = models.DateTimeField(null=True)
    revision = models.PositiveIntegerField(default=1)

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
    acquisition_date = models.DateField(null=True, blank=True)
    acquisition_cost = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    acquisition_currency = models.CharField(max_length=3, blank=True, default="")
    notes = models.TextField(blank=True, default="")
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
    registration_key = models.UUIDField(null=True)
    registration_fingerprint = models.CharField(max_length=64, blank=True)
    registration_photo = models.ForeignKey(
        "evidence.StoredFile", null=True, on_delete=models.PROTECT
    )

    class Meta(CompanyRecord.Meta):
        db_table = "tool_assets"
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="registration_photo", name="asset_photo_company"),
            models.UniqueConstraint(
                fields=["registered_by", "registration_key"], name="asset_registration_retry_key"
            ),
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
            models.CheckConstraint(
                condition=Q(acquisition_cost__isnull=True, acquisition_currency="")
                | Q(
                    acquisition_cost__isnull=False,
                    acquisition_cost__gte=0,
                    acquisition_currency__regex=r"^[A-Z]{3}$",
                ),
                name="asset_acquisition_money_valid",
            ),
        ]
