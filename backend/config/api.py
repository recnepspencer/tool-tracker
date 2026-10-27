from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.middleware.csrf import get_token
from ninja import Router, Schema

from companies.access import capabilities
from companies.models import CompanyMembership
from equipment.models import WarehouseRoleGrant

router = Router(tags=["session"])


class CsrfToken(Schema):
    csrf_token: str


class MembershipView(Schema):
    company_id: UUID
    company_name: str
    membership_id: UUID
    preferred_name: str
    capabilities: list[str]
    managed_warehouse_ids: list[UUID]


class SessionView(Schema):
    user_id: UUID
    email: str
    memberships: list[MembershipView]


def csrf_token(request: HttpRequest):
    return {"csrf_token": get_token(request)}


def session_info(request: HttpRequest):
    identity = current_identity(request)
    memberships = (
        CompanyMembership.objects.filter(
            person__identity_user_id=identity.user_id, access_state="active", ended_at__isnull=True
        )
        .select_related("company", "person")
        .order_by("company_id")
    )
    return {
        "user_id": identity.user_id,
        "email": identity.email,
        "memberships": [
            {
                "company_id": member.company_id,
                "company_name": member.company.name,
                "membership_id": member.id,
                "preferred_name": member.person.preferred_name,
                "capabilities": sorted(capabilities(member)),
                "managed_warehouse_ids": list(
                    WarehouseRoleGrant.objects.filter(
                        membership=member, revoked_at__isnull=True
                    ).values_list("warehouse_id", flat=True)
                )
                if "tools.transfer" in capabilities(member)
                else [],
            }
            for member in memberships
        ],
    }


define_http_endpoint(
    router, method="get", path="/auth/csrf", endpoint=csrf_token, response=CsrfToken
)
define_http_endpoint(router, method="get", path="/me", endpoint=session_info, response=SessionView)
