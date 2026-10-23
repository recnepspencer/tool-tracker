from uuid import uuid4

from cleanforce_identity.models import PlatformUser
from conftest import login_client
from django.db import transaction
from test_tool_requests import post

from companies.models import CompanyMembership, CompanyRoleGrant, Person
from equipment.models import ToolRequest


def test_cross_company_paths_and_foreign_asset_are_denied(api_client, world, asset_url):
    prefix = f"/api/companies/{world.other_company.id}"
    assert api_client.get(f"{prefix}/tools").status_code == 403
    assert post(api_client, f"{prefix}/tools/{world.assets[0].id}/requests").status_code == 403
    # Even with memberships in both companies, an asset cannot cross the path scope.
    member = CompanyMembership.objects.create(company=world.other_company, person=world.person)
    CompanyRoleGrant.objects.create(membership=member, role_code="field_member")
    assert post(api_client, f"{prefix}/tools/{world.assets[0].id}/requests").status_code == 404
    assert api_client.get(f"{prefix}/tools").json()["items"] == []
    assert ToolRequest.objects.count() == 0


def test_competing_requests_are_independent_and_private(
    api_client, world, asset_url, password_hash
):
    first = post(api_client, asset_url).json()
    with transaction.atomic():
        user = PlatformUser.objects.create(
            email="second@example.com", hashed_password=password_hash
        )
        person = Person.objects.create(identity_user=user, preferred_name="Second worker")
        member = CompanyMembership.objects.create(company=world.company, person=person)
        CompanyRoleGrant.objects.create(membership=member, role_code="field_member")
    other_client = login_client(user)
    second = post(other_client, asset_url)
    assert second.status_code == 201
    assert second.json()["id"] != first["id"]
    assert second.json()["asset_id"] == first["asset_id"]
    url = f"/api/companies/{world.company.id}/tool-requests/{first['id']}"
    assert other_client.get(url).status_code == 404
    assert ToolRequest.objects.count() == 2


def test_unknown_asset_does_not_leak_details(api_client, world):
    url = f"/api/companies/{world.company.id}/tools/{uuid4()}/requests"
    response = post(api_client, url)
    assert response.status_code == 404
    assert response.json()["code"] == "not_found"


def test_current_session_exposes_only_active_company_memberships(api_client, world):
    data = api_client.get("/api/me").json()
    assert data["user_id"] == str(world.user.id)
    assert data["memberships"] == [
        {
            "company_id": str(world.company.id),
            "company_name": world.company.name,
            "membership_id": str(world.member.id),
        }
    ]
