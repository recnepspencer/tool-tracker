from django.contrib.postgres.constraints import ExclusionConstraint
from django.contrib.postgres.fields import DateTimeRangeField, RangeOperators
from django.db import models
from django.db.models import F, Func, Q, Value

from companies.base import CompanyRecord
from companies.constraints import ScopedForeignKey


class Job(CompanyRecord):
    name = models.CharField(max_length=200)
    archived_at = models.DateTimeField(null=True)
    revision = models.PositiveIntegerField(default=1)


class JobAssignmentPolicy(models.Model):
    company = models.OneToOneField("companies.Company", primary_key=True, on_delete=models.PROTECT)
    self_join_mode = models.CharField(max_length=20, default="disabled")
    self_leave_mode = models.CharField(max_length=20, default="disabled")
    revision = models.PositiveIntegerField(default=1)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(self_join_mode__in=["direct", "approval_required", "disabled"])
                & Q(self_leave_mode__in=["direct", "approval_required", "disabled"]),
                name="job_policy_modes_valid",
            )
        ]


class JobAssignment(CompanyRecord):
    job = models.ForeignKey(Job, on_delete=models.PROTECT)
    membership = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True)
    assigned_by = models.ForeignKey(
        "companies.CompanyMembership", on_delete=models.PROTECT, related_name="assignments_given"
    )
    ended_by = models.ForeignKey(
        "companies.CompanyMembership",
        null=True,
        on_delete=models.PROTECT,
        related_name="assignments_ended",
    )
    end_reason = models.TextField(blank=True)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="job", name="assignment_job_company"),
            ScopedForeignKey(field="membership", name="assignment_member_company"),
            ScopedForeignKey(field="assigned_by", name="assignment_actor_company"),
            ScopedForeignKey(field="ended_by", name="assignment_ender_company"),
            models.UniqueConstraint(
                fields=["company", "job", "membership", "id"], name="assignment_subject_identity"
            ),
            models.UniqueConstraint(
                fields=["job", "membership"],
                condition=Q(ends_at__isnull=True),
                name="one_open_job_assignment",
            ),
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(ends_at__gt=F("starts_at")),
                name="assignment_positive_interval",
            ),
            ExclusionConstraint(
                name="assignment_no_overlap",
                expressions=[
                    ("job", RangeOperators.EQUAL),
                    ("membership", RangeOperators.EQUAL),
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


class JobParticipationRequest(CompanyRecord):
    job = models.ForeignKey(Job, on_delete=models.PROTECT)
    membership = models.ForeignKey("companies.CompanyMembership", on_delete=models.PROTECT)
    intent = models.CharField(max_length=8)
    request_key = models.UUIDField()
    target_assignment = models.ForeignKey(JobAssignment, null=True, on_delete=models.PROTECT)
    resulting_assignment = models.ForeignKey(
        JobAssignment, null=True, on_delete=models.PROTECT, related_name="participation_results"
    )
    status = models.CharField(max_length=16, default="pending")
    policy_revision = models.PositiveIntegerField()
    requested_at = models.DateTimeField(auto_now_add=True)
    decided_at = models.DateTimeField(null=True)
    decided_by = models.ForeignKey(
        "companies.CompanyMembership",
        null=True,
        on_delete=models.PROTECT,
        related_name="participation_decisions",
    )
    reason = models.TextField(blank=True)
    decision_note = models.TextField(blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="job", name="participation_job_company"),
            ScopedForeignKey(field="membership", name="participation_member_company"),
            ScopedForeignKey(field="decided_by", name="participation_decider_company"),
            ScopedForeignKey(
                field="target_assignment",
                scope=("company", "job", "membership"),
                name="participation_target_subject",
            ),
            ScopedForeignKey(
                field="resulting_assignment",
                scope=("company", "job", "membership"),
                name="participation_result_subject",
            ),
            models.CheckConstraint(
                condition=Q(intent__in=["join", "leave"]), name="participation_intent_valid"
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "approved", "rejected", "withdrawn"]),
                name="participation_status_valid",
            ),
            models.UniqueConstraint(
                fields=["membership", "request_key"], name="participation_retry_key"
            ),
            models.UniqueConstraint(
                fields=["job", "membership", "intent"],
                condition=Q(status="pending"),
                name="one_pending_participation",
            ),
        ]
