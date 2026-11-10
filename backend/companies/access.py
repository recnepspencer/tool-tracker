from backend_platform.api import forbidden
from django.utils import timezone

from .models import CompanyMembership, CompanyRoleGrant

FIELD_CAPABILITIES = frozenset(
    {
        "company.read",
        "tools.read",
        "tools.request",
        "tools.register",
        "tools.transfer",
        "tools.report",
        "jobs.read",
        "jobs.participate",
        "files.upload",
    }
)
EQUIPMENT_CAPABILITIES = FIELD_CAPABILITIES | {
    "tools.manage",
    "tools.manage_registration_policy",
    "catalog.manage",
    "warehouses.manage",
    "activity.read",
    "reconciliation.manage",
}
WORK_CAPABILITIES = frozenset(
    {"company.read", "jobs.read", "jobs.assign", "jobs.manage", "jobs.manage_policy"}
)
# Each role can do everything the one before it can.
ROLE_CAPABILITIES = {
    "foreman": FIELD_CAPABILITIES,
    "manager": EQUIPMENT_CAPABILITIES | WORK_CAPABILITIES,
    "admin": EQUIPMENT_CAPABILITIES | WORK_CAPABILITIES | {"people.manage", "company.manage"},
}


def capabilities(member):
    roles = CompanyRoleGrant.objects.filter(membership=member, revoked_at__isnull=True).values_list(
        "role_code", flat=True
    )
    return frozenset(cap for role in roles for cap in ROLE_CAPABILITIES.get(role, ()))


def require_member(identity, company_id, capability, *, lock=False):
    members = CompanyMembership.objects.all()
    if lock:
        members = members.select_for_update(of=("self",))
    member = members.filter(
        company_id=company_id, person__identity_user_id=identity.user_id
    ).first()
    if member is None or member.access_state != "active" or member.ended_at is not None:
        raise forbidden("Active company membership is required.", code="membership_required")
    if capability not in capabilities(member):
        raise forbidden("This operation is not permitted.", code="capability_required")
    return member


def authorize_write(identity, company_id, capability, *, related_members=()):
    """Lock participating memberships in UUID order before domain aggregate locks."""
    actor = require_member(identity, company_id, capability)
    ids = {actor.pk, *related_members} - {None}
    list(
        CompanyMembership.objects.select_for_update()
        .filter(company_id=company_id, pk__in=ids)
        .order_by("id")
    )
    return require_member(identity, company_id, capability)


def role_of(member):
    grant = CompanyRoleGrant.objects.filter(membership=member, revoked_at__isnull=True).first()
    return grant.role_code if grant else "foreman"


def set_role(member, role):
    """Give the member this role, ending whatever role they held before."""
    live = CompanyRoleGrant.objects.filter(membership=member, revoked_at__isnull=True)
    live.exclude(role_code=role).update(revoked_at=timezone.now())
    CompanyRoleGrant.objects.get_or_create(membership=member, role_code=role, revoked_at=None)
