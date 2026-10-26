from uuid import uuid4

from django.db import models
from django.db.models import Q

from .constraints import ScopedForeignKey


class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    name = models.CharField(max_length=200)
    address = models.CharField(max_length=2000, blank=True)
    timezone = models.CharField(max_length=64, default="America/Denver")
    revision = models.PositiveIntegerField(default=1)
    setup_key = models.UUIDField(null=True, unique=True)
    created_by = models.ForeignKey(
        "cleanforce_identity.PlatformUser", null=True, on_delete=models.PROTECT
    )


class Person(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    identity_user = models.OneToOneField(
        "cleanforce_identity.PlatformUser", on_delete=models.PROTECT, null=True, blank=True
    )
    preferred_name = models.CharField(max_length=200)


class CompanyMembership(models.Model):
    class Access(models.TextChoices):
        ACTIVE = "active"
        SUSPENDED = "suspended"
        DISABLED = "disabled"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    person = models.ForeignKey(Person, on_delete=models.PROTECT)
    access_state = models.CharField(max_length=16, choices=Access, default=Access.ACTIVE)
    ended_at = models.DateTimeField(null=True, blank=True)
    title = models.CharField(max_length=120, blank=True)
    revision = models.PositiveIntegerField(default=1)

    class Meta:
        db_table = "company_memberships"
        constraints = [
            models.UniqueConstraint(fields=["company", "person"], name="membership_person_unique"),
            models.UniqueConstraint(fields=["company", "id"], name="membership_company_identity"),
            models.CheckConstraint(
                condition=Q(access_state__in=["active", "suspended", "disabled"]),
                name="membership_access_valid",
            ),
        ]


class CompanyRoleGrant(models.Model):
    class Role(models.TextChoices):
        FIELD_MEMBER = "field_member"
        COMPANY_ADMIN = "company_admin"
        EQUIPMENT_MANAGER = "equipment_manager"
        DISPATCHER = "dispatcher"
        ESTIMATOR = "estimator"

    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    membership = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT)
    role_code = models.CharField(max_length=32, choices=Role)
    granted_at = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "role_code"],
                condition=Q(revoked_at__isnull=True),
                name="one_live_company_role",
            ),
            models.CheckConstraint(
                condition=Q(
                    role_code__in=[
                        "field_member",
                        "company_admin",
                        "equipment_manager",
                        "dispatcher",
                        "estimator",
                    ]
                ),
                name="company_role_valid",
            ),
        ]


class MembershipInvitation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    company = models.ForeignKey(Company, on_delete=models.PROTECT)
    email = models.EmailField()
    preferred_name = models.CharField(max_length=120)
    role_code = models.CharField(max_length=32, choices=CompanyRoleGrant.Role)
    token_digest = models.CharField(max_length=64, unique=True)
    invited_by = models.ForeignKey(CompanyMembership, on_delete=models.PROTECT)
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True)
    revoked_at = models.DateTimeField(null=True)
    accepted_membership = models.ForeignKey(
        CompanyMembership, null=True, on_delete=models.PROTECT, related_name="accepted_invitations"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["company", "id"], name="invitation_company_identity"),
            ScopedForeignKey(field="invited_by", name="invitation_inviter_company"),
            ScopedForeignKey(field="accepted_membership", name="invitation_member_company"),
            models.CheckConstraint(
                condition=Q(
                    role_code__in=[
                        "field_member",
                        "company_admin",
                        "equipment_manager",
                        "dispatcher",
                        "estimator",
                    ]
                ),
                name="invitation_role_valid",
            ),
        ]
