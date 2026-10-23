from backend_platform.api import forbidden

from .models import CompanyMembership, CompanyRoleGrant

ROLE_CAPABILITIES = {
    "field_member": frozenset({"tools.read", "tools.request"}),
    "company_admin": frozenset({"tools.read", "tools.request"}),
    "equipment_manager": frozenset({"tools.read", "tools.request"}),
    "estimator": frozenset(),
}


def require_member(identity, company_id, capability, *, lock=False):
    members = CompanyMembership.objects.all()
    if lock:
        members = members.select_for_update(of=("self",))
    member = members.filter(
        company_id=company_id, person__identity_user_id=identity.user_id
    ).first()
    if member is None or member.access_state != "active" or member.ended_at is not None:
        raise forbidden("Active company membership is required.", code="membership_required")
    roles = CompanyRoleGrant.objects.filter(membership=member, revoked_at__isnull=True).values_list(
        "role_code", flat=True
    )
    if not any(capability in ROLE_CAPABILITIES.get(role, ()) for role in roles):
        raise forbidden("This operation is not permitted.", code="capability_required")
    return member
