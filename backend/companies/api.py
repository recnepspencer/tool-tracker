from datetime import datetime
from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import Query, Router, Schema
from pydantic import EmailStr, Field

from config.contracts import CommandInput, PageInput, RevisionInput, paginate

from . import people, profile
from .access import ROLE_CAPABILITIES, capabilities, require_member
from .models import Company, CompanyMembership, MembershipInvitation

router = Router(tags=["company and people"])
RoleCode = Literal["field_member", "company_admin", "equipment_manager", "dispatcher", "estimator"]


class CompanyInput(CommandInput):
    request_key: UUID
    name: str = Field(min_length=1, max_length=200)
    preferred_name: str = Field(min_length=1, max_length=120)
    timezone: str = Field(default="America/Denver", max_length=64)


class CompanyView(Schema):
    id: UUID
    name: str
    address: str
    timezone: str
    revision: int


class CompanyUpdate(RevisionInput):
    name: str = Field(min_length=1, max_length=200)
    address: str = Field(default="", max_length=2000)
    timezone: str = Field(min_length=1, max_length=64)


class MemberView(Schema):
    id: UUID
    person_id: UUID
    preferred_name: str
    title: str
    access_state: Literal["active", "suspended", "disabled"]
    ended_at: datetime | None
    revision: int
    roles: list[RoleCode]
    capabilities: list[str]


class MemberPage(Schema):
    items: list[MemberView]
    next_offset: int | None


class MembershipUpdate(RevisionInput):
    access_state: Literal["active", "suspended", "disabled"]
    roles: list[RoleCode] = Field(min_length=1, max_length=5)
    title: str = Field(default="", max_length=120)
    end_membership: bool = False
    reason: str = Field(min_length=1, max_length=2000)


class InvitationInput(CommandInput):
    email: EmailStr
    preferred_name: str = Field(min_length=1, max_length=120)
    role: RoleCode = "field_member"


class InvitationView(Schema):
    id: UUID
    email: str
    preferred_name: str
    role_code: RoleCode
    expires_at: datetime
    accepted_at: datetime | None
    revoked_at: datetime | None


class InvitationCreated(Schema):
    invitation: InvitationView
    token: str


class InvitationPage(Schema):
    items: list[InvitationView]
    next_offset: int | None


class InvitationAcceptance(CommandInput):
    token: str = Field(min_length=20, max_length=200)


class CapabilityView(Schema):
    role: RoleCode
    capabilities: list[str]


def member_view(member):
    return {
        "id": member.pk,
        "person_id": member.person_id,
        "preferred_name": member.person.preferred_name,
        "title": member.title,
        "access_state": member.access_state,
        "ended_at": member.ended_at,
        "revision": member.revision,
        "roles": list(
            member.companyrolegrant_set.filter(revoked_at__isnull=True).values_list(
                "role_code", flat=True
            )
        ),
        "capabilities": sorted(capabilities(member)),
    }


@csrf_protect
def company_create(request: HttpRequest, data: CompanyInput):
    return people.bootstrap_company(current_identity(request), data)


def company_read(request: HttpRequest, company_id: UUID):
    require_member(current_identity(request), company_id, "company.read")
    return Company.objects.get(pk=company_id)


@csrf_protect
def company_update(request: HttpRequest, company_id: UUID, data: CompanyUpdate):
    return profile.update_profile(current_identity(request), company_id, data)


def people_list(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    search: str = "",
    include_inactive: bool = False,
):
    require_member(current_identity(request), company_id, "company.read")
    query = CompanyMembership.objects.filter(company_id=company_id).select_related("person")
    if include_inactive:
        require_member(current_identity(request), company_id, "people.manage")
    else:
        query = query.filter(access_state="active", ended_at__isnull=True)
    if search:
        query = query.filter(person__preferred_name__icontains=search[:200])
    return paginate(
        query.order_by("person__preferred_name", "id"), page.limit, page.offset, member_view
    )


@csrf_protect
def member_update(
    request: HttpRequest, company_id: UUID, membership_id: UUID, data: MembershipUpdate
):
    return member_view(
        people.update_membership(current_identity(request), company_id, membership_id, data)
    )


@csrf_protect
def invitation_create(request: HttpRequest, company_id: UUID, data: InvitationInput):
    from django.db import transaction

    from accounts.mail import app_url, send_account_mail

    with transaction.atomic():
        result, token = people.create_invitation(current_identity(request), company_id, data)
        send_account_mail(
            result.email,
            f"Join {result.company.name}",
            f"You have been invited to {result.company.name}.\n\nAccept your invitation: {app_url(f'invite/{token}')}\n\nThis link expires in seven days.",
        )
    return {"invitation": InvitationView.model_validate(result), "token": token}


def invitations_list(request: HttpRequest, company_id: UUID, page: Query[PageInput]):
    require_member(current_identity(request), company_id, "people.manage")
    return paginate(
        MembershipInvitation.objects.filter(company_id=company_id).order_by("-expires_at", "id"),
        page.limit,
        page.offset,
    )


@csrf_protect
def invitation_revoke(request: HttpRequest, company_id: UUID, invitation_id: UUID):
    return people.revoke_invitation(current_identity(request), company_id, invitation_id)


@csrf_protect
def invitation_accept(request: HttpRequest, data: InvitationAcceptance):
    return member_view(people.accept_invitation(current_identity(request), data.token))


def permission_matrix(request: HttpRequest, company_id: UUID):
    require_member(current_identity(request), company_id, "company.read")
    return [
        {"role": role, "capabilities": sorted(caps)} for role, caps in ROLE_CAPABILITIES.items()
    ]


define_http_endpoint(
    router, method="post", path="/companies", endpoint=company_create, response=CompanyView
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}",
    endpoint=company_read,
    response=CompanyView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/update",
    endpoint=company_update,
    response=CompanyView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/people",
    endpoint=people_list,
    response=MemberPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/people/{membership_id}/update",
    endpoint=member_update,
    response=MemberView,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/invitations",
    endpoint=invitation_create,
    response=InvitationCreated,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/invitations",
    endpoint=invitations_list,
    response=InvitationPage,
)
define_http_endpoint(
    router,
    method="post",
    path="/companies/{company_id}/invitations/{invitation_id}/revoke",
    endpoint=invitation_revoke,
    response=InvitationView,
)
define_http_endpoint(
    router,
    method="post",
    path="/invitations/accept",
    endpoint=invitation_accept,
    response=MemberView,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/permissions",
    endpoint=permission_matrix,
    response=list[CapabilityView],
)
