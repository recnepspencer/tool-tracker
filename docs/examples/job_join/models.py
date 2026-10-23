"""Reduced schema for the join-job example, not the complete production schema.

Use this directory as an installed Django app named `job_join` in a consumer.
Production migrations must also enforce company consistency and interval
exclusion as described in DATABASE_PROPOSAL.md.
"""

from uuid import uuid4

from django.db import models
from django.db.models import F, Q


class Entity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)

    class Meta:
        abstract = True


class Company(Entity):
    name = models.CharField(max_length=200)


class Person(Entity):
    identity_user = models.OneToOneField(
        "cleanforce_identity.PlatformUser",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    preferred_name = models.CharField(max_length=200)


class CompanyMembership(Entity):
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    person = models.ForeignKey(Person, on_delete=models.PROTECT)
    access_state = models.CharField(max_length=16, default="active")
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "person"], name="join_member_company_person"
            ),
            models.CheckConstraint(
                condition=Q(access_state__in=["active", "suspended", "disabled"]),
                name="join_member_access_state",
            ),
        ]


class CompanyRoleGrant(Entity):
    membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT)
    role_code = models.CharField(max_length=40)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "role_code"],
                condition=Q(revoked_at__isnull=True),
                name="join_one_live_role_grant",
            )
        ]


class JobAssignmentPolicy(models.Model):
    class Mode(models.TextChoices):
        DIRECT = "direct"
        APPROVAL = "approval_required"
        DISABLED = "disabled"

    company = models.OneToOneField(
        Company, primary_key=True, on_delete=models.PROTECT
    )
    self_join_mode = models.CharField(
        max_length=24, choices=Mode.choices, default=Mode.APPROVAL
    )
    self_leave_mode = models.CharField(
        max_length=24, choices=Mode.choices, default=Mode.APPROVAL
    )
    revision = models.PositiveBigIntegerField(default=1)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=Q(self_join_mode__in=[
                    "direct", "approval_required", "disabled"
                ]),
                name="join_policy_valid_join_mode",
            ),
            models.CheckConstraint(
                condition=Q(self_leave_mode__in=[
                    "direct", "approval_required", "disabled"
                ]),
                name="join_policy_valid_leave_mode",
            ),
        ]


class Job(Entity):
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    number = models.CharField(max_length=40)
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, default="planned")
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["company", "number"], name="join_job_company_number"
            ),
            models.CheckConstraint(
                condition=Q(status__in=[
                    "planned", "active", "on_hold", "completed", "cancelled"
                ]),
                name="join_job_valid_status",
            ),
        ]


class JobAssignment(Entity):
    job = models.ForeignKey(Job, on_delete=models.PROTECT)
    membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT)
    responsibility_code = models.CharField(max_length=30, default="crew")
    starts_at = models.DateTimeField()
    ends_at = models.DateTimeField(null=True, blank=True)
    assigned_by = models.ForeignKey(
        CompanyMembership, related_name="assignments_made", on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["job", "membership"],
                condition=Q(ends_at__isnull=True),
                name="join_one_open_assignment",
            ),
            models.CheckConstraint(
                condition=Q(ends_at__isnull=True) | Q(ends_at__gt=F("starts_at")),
                name="join_assignment_positive_interval",
            ),
        ]


class JobParticipationRequest(Entity):
    """This example implements join requests only; full schema also has leave."""

    job = models.ForeignKey(Job, on_delete=models.PROTECT)
    membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT)
    request_key = models.UUIDField()
    status = models.CharField(max_length=16)
    policy_revision = models.PositiveBigIntegerField()
    requested_at = models.DateTimeField()
    decided_at = models.DateTimeField(null=True, blank=True)
    decided_by = models.ForeignKey(
        CompanyMembership,
        null=True,
        blank=True,
        related_name="participation_decisions",
        on_delete=models.PROTECT,
    )
    assignment = models.ForeignKey(
        JobAssignment, null=True, blank=True, on_delete=models.PROTECT
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "request_key"], name="join_request_retry_key"
            ),
            models.UniqueConstraint(
                fields=["job", "membership"],
                condition=Q(status="pending"),
                name="join_one_pending_request",
            ),
            models.CheckConstraint(
                condition=Q(status__in=["pending", "approved", "rejected", "withdrawn"]),
                name="join_request_valid_status",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="approved", assignment__isnull=False)
                    | (~Q(status="approved") & Q(assignment__isnull=True))
                ),
                name="join_approval_has_assignment",
            ),
            models.CheckConstraint(
                condition=(
                    Q(status="pending", decided_at__isnull=True, decided_by__isnull=True)
                    | (~Q(status="pending") & Q(
                        decided_at__isnull=False, decided_by__isnull=False
                    ))
                ),
                name="join_terminal_request_has_decision",
            ),
        ]
