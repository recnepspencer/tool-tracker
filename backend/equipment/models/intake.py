from django.db import models
from django.db.models import Q

from companies.base import CompanyRecord
from companies.constraints import ScopedForeignKey


class EquipmentSubmission(CompanyRecord):
    reporter = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    description = models.CharField(max_length=500)
    location = models.CharField(max_length=500, blank=True)
    in_my_possession = models.BooleanField(default=True)
    notes = models.TextField(blank=True)
    suggested_type = models.ForeignKey("equipment.ToolModel", null=True, on_delete=models.PROTECT)
    photo = models.ForeignKey("evidence.StoredFile", null=True, on_delete=models.PROTECT)
    request_key = models.UUIDField()
    fingerprint = models.CharField(max_length=64)
    status = models.CharField(max_length=24, default="pending")
    asset = models.ForeignKey("equipment.ToolAsset", null=True, on_delete=models.PROTECT)
    discussion = models.JSONField(default=list)
    revision = models.PositiveIntegerField(default=1)
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["reporter", "request_key"], name="submission_retry_unique"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "clarification", "registered", "linked"]),
                name="submission_status_valid",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "clarification"], asset__isnull=True)
                | Q(status__in=["registered", "linked"], asset__isnull=False),
                name="submission_resolution_valid",
            ),
            ScopedForeignKey(field="reporter", name="submission_reporter_company"),
            ScopedForeignKey(field="suggested_type", name="submission_type_company"),
            ScopedForeignKey(field="photo", name="submission_photo_company"),
            ScopedForeignKey(field="asset", name="submission_asset_company"),
        ]
