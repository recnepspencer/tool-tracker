from django.db import models
from django.db.models import Q

from companies.base import CompanyRecord
from companies.constraints import ScopedForeignKey


class StoredFile(CompanyRecord):
    storage_key = models.CharField(max_length=300, unique=True)
    original_name = models.CharField(max_length=200)
    content_type = models.CharField(max_length=80)
    byte_count = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    purpose = models.CharField(max_length=24)
    uploaded_by = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attached_at = models.DateTimeField(null=True)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="uploaded_by", name="file_uploader_company"),
            models.CheckConstraint(
                condition=Q(
                    purpose__in=["registration", "incident", "handoff", "reconciliation", "service"]
                ),
                name="file_purpose_valid",
            ),
        ]
