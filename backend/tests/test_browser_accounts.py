import re
from datetime import timedelta
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from cleanforce_identity.models import PlatformUser
from django.core import mail
from django.test import Client
from django.utils import timezone

from accounts.models import AuthenticationWindow, SignupChallenge
from companies.models import CompanyRoleGrant, MembershipInvitation
from tests.conftest import PASSWORD, login_client
from tests.http_contract import assert_response

pytestmark = pytest.mark.django_db


def browser():
    client = Client(enforce_csrf_checks=True)
    csrf(client)
    return client


def csrf(client):
    client.defaults["HTTP_X_CSRFTOKEN"] = client.get("/api/auth/csrf").json()["csrf_token"]


def post(client, path, body):
    return client.post(path, body, content_type="application/json")


def signup(client, email="new@example.com"):
    response = post(client, "/api/auth/signup", {"email": email, "name": "New Person"})
    assert_response(response, "/api/auth/signup")
    link = re.search(r"https?://\S+", mail.outbox[-1].body).group()
    return parse_qs(urlparse(link).query)["token"][0]


def test_verified_signup_session_company_and_logout():
    client = browser()
    token = signup(client)
    assert not PlatformUser.objects.filter(email="new@example.com").exists()
    assert client.get("/api/me").status_code == 401
    verified = post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD})
    identity = assert_response(verified, "/api/auth/verify-signup")
    assert identity["memberships"] == []
    csrf(client)
    company = assert_response(
        post(
            client,
            "/api/companies",
            {
                "request_key": str(uuid4()),
                "name": "A real company",
                "preferred_name": "New Person",
            },
        ),
        "/api/companies",
    )
    session = assert_response(client.get("/api/me"), "/api/me", method="get")
    assert session["memberships"][0]["company_id"] == company["id"]
    assert "people.manage" in session["memberships"][0]["capabilities"]
    assert (
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}).status_code
        == 400
    )
    assert_response(post(client, "/api/auth/sign-out", {}), "/api/auth/sign-out")
    assert client.get("/api/me").status_code == 401


def test_signup_expiry_duplicate_and_csrf(world):
    unsafe = Client(enforce_csrf_checks=True)
    assert (
        post(unsafe, "/api/auth/signup", {"email": "new@example.com", "name": "Person"}).status_code
        == 403
    )
    client = browser()
    token = signup(client)
    SignupChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert (
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}).status_code
        == 400
    )
    expected = post(
        client, "/api/auth/signup", {"email": "another@example.com", "name": "Person"}
    ).json()
    count = len(mail.outbox)
    actual = post(client, "/api/auth/signup", {"email": world.user.email, "name": "Person"}).json()
    assert actual == expected
    assert len(mail.outbox) == count


def test_invitation_email_signup_accept_and_replay(world):
    CompanyRoleGrant.objects.create(membership=world.member, role_code="company_admin")
    admin = login_client(world.user)
    url = f"/api/companies/{world.company.pk}/invitations"
    created = assert_response(
        post(
            admin,
            url,
            {"email": "invitee@example.com", "preferred_name": "Invitee", "role": "field_member"},
        ),
        "/api/companies/{company_id}/invitations",
    )
    assert f"/invite/{created['token']}" in mail.outbox[-1].body
    wrong = post(admin, "/api/invitations/accept", {"token": created["token"]})
    assert wrong.status_code == 403
    client = browser()
    preview = client.get(f"/api/invitations/{created['token']}/preview")
    assert_response(preview, "/api/invitations/{token}/preview", method="get")
    token = signup(client, "invitee@example.com")
    assert (
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}).status_code
        == 200
    )
    csrf(client)
    accepted = assert_response(
        post(client, "/api/invitations/accept", {"token": created["token"]}),
        "/api/invitations/accept",
    )
    assert accepted["roles"] == ["field_member"]
    assert post(client, "/api/invitations/accept", {"token": created["token"]}).status_code == 409
    assert client.get(f"/api/invitations/{created['token']}/preview").status_code == 404


def test_reset_real_email_single_use_and_session_revocation(world):
    existing = login_client(world.user)
    client = browser()
    known = post(client, "/api/auth/recover", {"email": world.user.email})
    assert_response(known, "/api/auth/recover")
    link = re.search(r"https?://\S+", mail.outbox[-1].body).group()
    params = {k: v[0] for k, v in parse_qs(urlparse(link).query).items()}
    unknown = post(client, "/api/auth/recover", {"email": "unknown@example.com"})
    assert known.json() == unknown.json()
    assert len(mail.outbox) == 1
    new_password = "new-long-test-password-for-reset"
    assert post(client, "/api/auth/reset", {**params, "password": "12345678"}).status_code == 400
    assert (
        post(
            client, "/api/auth/password-reset-complete", {**params, "password": "12345678"}
        ).status_code
        == 400
    )
    assert_response(
        post(client, "/api/auth/reset", {**params, "password": new_password}), "/api/auth/reset"
    )
    assert existing.get("/api/me").status_code == 401
    assert (
        post(
            client, "/api/auth/sign-in", {"email": world.user.email, "password": PASSWORD}
        ).status_code
        == 401
    )
    assert_response(
        post(client, "/api/auth/sign-in", {"email": world.user.email, "password": new_password}),
        "/api/auth/sign-in",
    )
    csrf(client)
    assert (
        post(
            client, "/api/auth/reset", {**params, "password": "another-long-test-password"}
        ).status_code
        >= 400
    )
    world.user.refresh_from_db()
    assert world.user.check_password(new_password)


def test_invitation_mail_failure_rolls_back(world, monkeypatch):
    CompanyRoleGrant.objects.create(membership=world.member, role_code="company_admin")
    client = login_client(world.user)

    def fail(*args, **kwargs):
        raise OSError("mail server unavailable")

    monkeypatch.setattr("accounts.mail.send_mail", fail)
    response = post(
        client,
        f"/api/companies/{world.company.pk}/invitations",
        {"email": "invitee@example.com", "preferred_name": "Invitee"},
    )
    assert response.status_code == 503
    assert not MembershipInvitation.objects.exists()


def test_shared_throttle_denies_before_password_verification(world):
    client = browser()
    assert (
        post(
            client, "/api/auth/sign-in", {"email": world.user.email, "password": "wrong"}
        ).status_code
        == 401
    )
    AuthenticationWindow.objects.update(attempts=100)
    denied = post(client, "/api/auth/sign-in", {"email": world.user.email, "password": PASSWORD})
    assert denied.status_code == 429
    assert denied["Retry-After"] == "900"
    assert client.get("/api/me").status_code == 401
