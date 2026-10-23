from types import SimpleNamespace

import pytest
from cleanforce_identity.models import PlatformUser
from django.utils import timezone

from companies.models import Company, CompanyMembership, CompanyRoleGrant, MembershipInvitation
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response


@pytest.fixture
def people(db, password_hash):
    company = Company.objects.create(name="People-only tests")
    admin = member_in(company, password_hash, "company_admin", email="admin@example.com")
    worker = member_in(company, password_hash, email="worker@example.com")
    return SimpleNamespace(
        company=company,
        admin=admin,
        worker=worker,
        manager=login_client(admin.user),
        client=login_client(worker.user),
        base=f"/api/companies/{company.pk}",
    )


def test_last_admin_and_unauthorized_role_changes_are_rejected(people):
    ctx = people
    body = {
        "expected_revision": 1,
        "access_state": "suspended",
        "roles": ["field_member"],
        "reason": "Change access",
    }
    assert (
        ctx.manager.post(
            f"{ctx.base}/people/{ctx.admin.member.pk}/update", body, content_type="application/json"
        ).status_code
        == 409
    )
    assert (
        ctx.client.post(
            f"{ctx.base}/people/{ctx.admin.member.pk}/update", body, content_type="application/json"
        ).status_code
        == 403
    )
    ctx.admin.member.refresh_from_db()
    assert ctx.admin.member.access_state == "active"
    assert CompanyRoleGrant.objects.filter(
        membership=ctx.admin.member, role_code="company_admin", revoked_at__isnull=True
    ).exists()


def test_revocation_changes_access_on_existing_session(people):
    ctx = people
    result = ctx.manager.post(
        f"{ctx.base}/people/{ctx.worker.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "suspended",
            "roles": ["field_member"],
            "reason": "Suspend access",
        },
        content_type="application/json",
    )
    assert_response(result, "/api/companies/{company_id}/people/{membership_id}/update")
    assert ctx.client.get(f"{ctx.base}/people").status_code == 403
    assert (
        ctx.manager.post(
            f"{ctx.base}/people/{ctx.worker.member.pk}/update",
            {
                "expected_revision": 1,
                "access_state": "active",
                "roles": ["field_member"],
                "reason": "stale update",
            },
            content_type="application/json",
        ).status_code
        == 409
    )


def test_invitation_is_email_bound_single_use_and_never_stores_raw_token(people, password_hash):
    ctx = people
    response = ctx.manager.post(
        f"{ctx.base}/invitations",
        {"email": "invited@example.com", "preferred_name": "New worker", "role": "field_member"},
        content_type="application/json",
    )
    invite = assert_response(response, "/api/companies/{company_id}/invitations")
    stored = MembershipInvitation.objects.get(pk=invite["invitation"]["id"])
    assert stored.token_digest != invite["token"]
    assert (
        ctx.client.post(
            "/api/invitations/accept", {"token": invite["token"]}, content_type="application/json"
        ).status_code
        == 403
    )
    user = PlatformUser.objects.create(email="invited@example.com", hashed_password=password_hash)
    client = login_client(user)
    accepted = client.post(
        "/api/invitations/accept", {"token": invite["token"]}, content_type="application/json"
    )
    member = assert_response(accepted, "/api/invitations/accept")
    assert member["roles"] == ["field_member"]
    assert (
        client.post(
            "/api/invitations/accept", {"token": invite["token"]}, content_type="application/json"
        ).status_code
        == 409
    )
    assert CompanyMembership.objects.filter(person__identity_user=user).count() == 1
    assert "token_digest" not in str(ctx.manager.get(f"{ctx.base}/invitations").json())


def test_revoked_invitation_cannot_grant_membership(people, password_hash):
    ctx = people
    invite = ctx.manager.post(
        f"{ctx.base}/invitations",
        {"email": "new@example.com", "preferred_name": "New", "role": "company_admin"},
        content_type="application/json",
    ).json()
    response = ctx.manager.post(f"{ctx.base}/invitations/{invite['invitation']['id']}/revoke")
    assert response.status_code == 200
    user = PlatformUser.objects.create(email="new@example.com", hashed_password=password_hash)
    assert (
        login_client(user)
        .post(
            "/api/invitations/accept", {"token": invite["token"]}, content_type="application/json"
        )
        .status_code
        == 409
    )
    assert not CompanyMembership.objects.filter(person__identity_user=user).exists()


def test_foreign_membership_cannot_be_changed(people, password_hash):
    foreign = member_in(Company.objects.create(name="Other"), password_hash)
    response = people.manager.post(
        f"{people.base}/people/{foreign.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "roles": ["field_member"],
            "reason": "Wrong tenant",
        },
        content_type="application/json",
    )
    assert response.status_code == 404
    foreign.member.refresh_from_db()
    assert foreign.member.access_state == "active"


def test_employment_end_closes_jobs_but_retains_tool_accountability(world, password_hash):
    from equipment.models import CustodyPeriod
    from work.models import Job, JobAssignment, Project

    admin = member_in(world.company, password_hash, "company_admin")
    project = Project.objects.create(company=world.company, number="P1", name="Project")
    job = Job.objects.create(company=world.company, project=project, number="J1", name="Job")
    assignment = JobAssignment.objects.create(
        company=world.company,
        job=job,
        membership=world.member,
        assigned_by=admin.member,
        starts_at=timezone.now(),
    )
    custody = CustodyPeriod.objects.get(asset=world.assets[0])
    custody.holder_warehouse = None
    custody.holder_membership = world.member
    custody.save()
    response = login_client(admin.user).post(
        f"/api/companies/{world.company.pk}/people/{world.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "roles": ["field_member"],
            "end_membership": True,
            "reason": "Employment ended",
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    assignment.refresh_from_db()
    custody.refresh_from_db()
    assert assignment.ends_at is not None
    assert custody.ends_at is None and custody.holder_membership == world.member
