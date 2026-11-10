from django.db import migrations, models
from django.db.models import Q
from django.utils import timezone

NEW_ROLE = {
    "company_admin": "admin",
    "equipment_manager": "manager",
    "dispatcher": "manager",
    "estimator": "foreman",
    "field_member": "foreman",
}
RANK = {"admin": 0, "manager": 1, "foreman": 2}
CHOICES = [("admin", "Admin"), ("manager", "Manager"), ("foreman", "Foreman")]


def three_roles(apps, schema_editor):
    Grant = apps.get_model("companies", "CompanyRoleGrant")
    Invitation = apps.get_model("companies", "MembershipInvitation")
    for old, new in NEW_ROLE.items():
        Grant.objects.filter(role_code=old).update(role_code=new)
        Invitation.objects.filter(role_code=old).update(role_code=new)
    # Someone who held several roles keeps the one that can do the most.
    now = timezone.now()
    live = {}
    for grant in Grant.objects.filter(revoked_at__isnull=True).order_by("granted_at", "id"):
        kept = live.get(grant.membership_id)
        if kept is None:
            live[grant.membership_id] = grant
        elif RANK[grant.role_code] < RANK[kept.role_code]:
            Grant.objects.filter(pk=kept.pk).update(revoked_at=now)
            live[grant.membership_id] = grant
        else:
            Grant.objects.filter(pk=grant.pk).update(revoked_at=now)
    # Fire the deferred integrity triggers now; PostgreSQL refuses to build the
    # unique index below while they are still pending in this transaction.
    schema_editor.execute("SET CONSTRAINTS ALL IMMEDIATE")


class Migration(migrations.Migration):
    dependencies = [
        ("companies", "0004_company_logo_and_owner"),
    ]

    operations = [
        migrations.RemoveConstraint(model_name="companyrolegrant", name="company_role_valid"),
        migrations.RemoveConstraint(model_name="companyrolegrant", name="one_live_company_role"),
        migrations.RemoveConstraint(
            model_name="membershipinvitation", name="invitation_role_valid"
        ),
        migrations.RunPython(three_roles, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="companyrolegrant",
            name="role_code",
            field=models.CharField(choices=CHOICES, max_length=32),
        ),
        migrations.AlterField(
            model_name="membershipinvitation",
            name="role_code",
            field=models.CharField(choices=CHOICES, max_length=32),
        ),
        migrations.AddConstraint(
            model_name="companyrolegrant",
            constraint=models.UniqueConstraint(
                condition=Q(revoked_at__isnull=True),
                fields=("membership",),
                name="one_live_company_role",
            ),
        ),
        migrations.AddConstraint(
            model_name="companyrolegrant",
            constraint=models.CheckConstraint(
                condition=Q(role_code__in=["admin", "manager", "foreman"]),
                name="company_role_valid",
            ),
        ),
        migrations.AddConstraint(
            model_name="membershipinvitation",
            constraint=models.CheckConstraint(
                condition=Q(role_code__in=["admin", "manager", "foreman"]),
                name="invitation_role_valid",
            ),
        ),
    ]
