from django.db import models
from django.db.models import Q

from companies.constraints import ScopedForeignKey

from .base import CompanyRecord


class ToolRequest(CompanyRecord):
    """A request names one physical asset; it does not reserve or move that asset."""

    class Status(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"
        WITHDRAWN = "withdrawn"
        FULFILLED = "fulfilled"

    requester = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    asset = models.ForeignKey("equipment.ToolAsset", on_delete=models.PROTECT)
    source_custody = models.ForeignKey("equipment.CustodyPeriod", on_delete=models.PROTECT)
    request_key = models.UUIDField()
    note = models.TextField(blank=True)
    status = models.CharField(max_length=16, choices=Status, default=Status.PENDING)
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True)
    decided_by = models.ForeignKey(
        "companies.CompanyMembership",
        null=True,
        on_delete=models.PROTECT,
        related_name="tool_requests_decided",
    )
    decision_note = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        db_table = "tool_requests"
        constraints = [
            *CompanyRecord.Meta.constraints,
            models.UniqueConstraint(
                fields=["company", "asset", "id"], name="request_asset_identity"
            ),
            ScopedForeignKey(field="decided_by", name="request_decider_company"),
            ScopedForeignKey(field="asset", name="request_asset_company"),
            ScopedForeignKey(field="requester", name="request_member_company"),
            ScopedForeignKey(
                field="source_custody", scope=("company", "asset"), name="request_source_same_asset"
            ),
            models.UniqueConstraint(fields=["requester", "request_key"], name="request_retry_key"),
            models.UniqueConstraint(
                fields=["requester", "asset"],
                condition=Q(status__in=["pending", "approved"]),
                name="one_open_request_per_requester_asset",
            ),
            models.CheckConstraint(
                condition=Q(
                    status__in=["pending", "approved", "rejected", "withdrawn", "fulfilled"]
                ),
                name="request_status_valid",
            ),
        ]
        indexes = [
            models.Index(
                fields=["company", "requester", "requested_at"], name="requests_by_requester_time"
            )
        ]
