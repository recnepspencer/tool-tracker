import re
from datetime import timedelta
from io import BytesIO, StringIO
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid4

import pytest
from cleanforce_identity.models import PlatformUser
from django.core import mail
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import CommandError, call_command
from django.test import Client
from django.utils import timezone
from PIL import Image

from accounts.models import AuthenticationWindow, SignupChallenge, SignupCode
from accounts.signup_codes import issue_codes
from companies.access import set_role
from companies.models import Company, MembershipInvitation
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


def new_company(**extra):
    (code,) = issue_codes(1, days=30)
    return {"signup_code": code, "company_name": "A real company", **extra}


def signup(client, email="new@example.com", **body):
    response = post(client, "/api/auth/signup", {"email": email, "name": "New Person", **body})
    assert_response(response, "/api/auth/signup")
    link = re.search(r"https?://\S+", mail.outbox[-1].body).group()
    return parse_qs(urlparse(link).query)["token"][0]


def test_verified_signup_session_company_and_logout():
    client = browser()
    token = signup(client, **new_company())
    assert not PlatformUser.objects.filter(email="new@example.com").exists()
    assert client.get("/api/me").status_code == 401
    verified = post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD})
    identity = assert_response(verified, "/api/auth/verify-signup")
    assert identity["memberships"] == []
    csrf(client)
    pending = assert_response(client.get("/api/company-signup"), "/api/company-signup", "get")
    assert pending == {
        "name": "New Person",
        "pending": {"company_name": "A real company", "logo_id": None},
    }
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
    assert session["memberships"][0]["is_owner"]
    assert "people.manage" in session["memberships"][0]["capabilities"]
    assert company["owner_id"] == session["memberships"][0]["membership_id"]
    assert SignupCode.objects.get().company_id == UUID(company["id"])
    assert client.get("/api/company-signup").json()["pending"] is None
    replay = post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD})
    assert replay.status_code == 400
    assert replay.json()["code"] == "invalid_verification_link"
    assert_response(post(client, "/api/auth/sign-out", {}), "/api/auth/sign-out")
    assert client.get("/api/me").status_code == 401


def test_signup_expiry_duplicate_and_csrf(world):
    unsafe = Client(enforce_csrf_checks=True)
    assert (
        post(unsafe, "/api/auth/signup", {"email": "new@example.com", "name": "Person"}).status_code
        == 403
    )
    client = browser()
    token = signup(client, **new_company())
    SignupChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
    assert (
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}).status_code
        == 400
    )
    expected = post(
        client,
        "/api/auth/signup",
        {"email": "another@example.com", "name": "Person", **new_company()},
    ).json()
    count = len(mail.outbox)
    actual = post(
        client,
        "/api/auth/signup",
        {"email": world.user.email, "name": "Person", **new_company()},
    ).json()
    assert actual == expected
    assert len(mail.outbox) == count


def test_invitation_email_signup_accept_and_replay(world):
    set_role(world.member, "admin")
    admin = login_client(world.user)
    url = f"/api/companies/{world.company.pk}/invitations"
    created = assert_response(
        post(
            admin,
            url,
            {"email": "invitee@example.com", "preferred_name": "Invitee", "role": "foreman"},
        ),
        "/api/companies/{company_id}/invitations",
    )
    assert f"/invite/{created['token']}" in mail.outbox[-1].body
    wrong = post(admin, "/api/invitations/accept", {"token": created["token"]})
    assert wrong.status_code == 403
    client = browser()
    preview = client.get(f"/api/invitations/{created['token']}/preview")
    assert_response(preview, "/api/invitations/{token}/preview", method="get")
    sent = len(mail.outbox)
    body = {"token": created["token"], "name": "Corrected Name", "password": PASSWORD}
    # Email is authoritative on the server, including for a tampered form.
    assert (
        post(
            client, "/api/auth/invitation-signup", {**body, "email": "other@example.com"}
        ).status_code
        == 400
    )
    assert (
        post(
            client, "/api/auth/invitation-signup", {**body, "password": "123456789012"}
        ).status_code
        == 400
    )
    assert not PlatformUser.objects.filter(email="invitee@example.com").exists()
    joined = assert_response(
        post(client, "/api/auth/invitation-signup", body), "/api/auth/invitation-signup"
    )
    assert len(mail.outbox) == sent
    assert not SignupChallenge.objects.exists()
    assert joined["email"] == "invitee@example.com"
    assert "tools.request" in joined["memberships"][0]["capabilities"]
    invite = MembershipInvitation.objects.get(pk=created["invitation"]["id"])
    assert invite.accepted_membership.person.preferred_name == "Corrected Name"
    assert PlatformUser.objects.get(email="invitee@example.com").full_name == "Corrected Name"
    csrf(client)
    assert post(client, "/api/auth/invitation-signup", body).json()["code"] == "invalid_invitation"
    assert post(client, "/api/invitations/accept", {"token": created["token"]}).status_code == 409
    assert client.get(f"/api/invitations/{created['token']}/preview").status_code == 404
    assert client.get("/api/me").status_code == 200


@pytest.mark.parametrize("state", ["revoked", "expired", "unknown", "existing"])
def test_invitation_signup_rejects_unusable_links_and_existing_accounts(world, state):
    set_role(world.member, "admin")
    email = world.user.email if state == "existing" else "invitee@example.com"
    created = post(
        login_client(world.user),
        f"/api/companies/{world.company.pk}/invitations",
        {"email": email, "preferred_name": "Invitee", "role": "foreman"},
    ).json()
    if state == "revoked":
        MembershipInvitation.objects.update(revoked_at=timezone.now())
    if state == "expired":
        MembershipInvitation.objects.update(expires_at=timezone.now())
    token = "unknown-token-that-is-long-enough" if state == "unknown" else created["token"]
    body = {"token": token, "name": "Invitee", "password": PASSWORD + "changed"}
    assert (
        post(Client(enforce_csrf_checks=True), "/api/auth/invitation-signup", body).status_code
        == 403
    )
    client = browser()
    response = post(client, "/api/auth/invitation-signup", body)
    assert response.status_code == (409 if state == "existing" else 400)
    assert client.get("/api/me").status_code == 401
    assert not PlatformUser.objects.filter(email="invitee@example.com").exists()
    assert MembershipInvitation.objects.get().accepted_at is None
    world.user.refresh_from_db()
    assert world.user.check_password(PASSWORD)


def test_invitee_can_ask_for_their_link_again(world):
    set_role(world.member, "admin")
    admin = login_client(world.user)
    created = post(
        admin,
        f"/api/companies/{world.company.pk}/invitations",
        {"email": "invitee@example.com", "preferred_name": "Invitee", "role": "foreman"},
    ).json()
    client = browser()
    sent = len(mail.outbox)
    unknown = assert_response(
        post(client, "/api/auth/invitation-links", {"email": "nobody@example.com"}),
        "/api/auth/invitation-links",
    )
    assert len(mail.outbox) == sent
    found = assert_response(
        post(client, "/api/auth/invitation-links", {"email": "Invitee@Example.com"}),
        "/api/auth/invitation-links",
    )
    # The answer never reveals whether an invitation exists.
    assert found == unknown
    assert mail.outbox[-1].to == ["invitee@example.com"]
    token = re.search(r"/invite/([\w-]+)", mail.outbox[-1].body).group(1)
    assert client.get(f"/api/invitations/{token}/preview").status_code == 200
    assert client.get(f"/api/invitations/{created['token']}/preview").status_code == 404
    MembershipInvitation.objects.update(revoked_at=timezone.now())
    post(client, "/api/auth/invitation-links", {"email": "invitee@example.com"})
    assert len(mail.outbox) == sent + 1


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


def test_signed_in_password_change_requires_current_password_and_revokes_other_sessions(world):
    client = login_client(world.user)
    other = login_client(world.user)
    new_password = "new-long-settings-password"
    path = "/api/auth/change-password"
    body = {"current_password": PASSWORD, "password": new_password}
    assert post(Client(enforce_csrf_checks=True), path, body).status_code == 403
    assert post(browser(), path, body).status_code == 401
    assert post(client, path, {**body, "current_password": "wrong"}).status_code == 400
    assert post(client, path, {**body, "password": "123456789012"}).status_code == 400
    assert other.get("/api/me").status_code == 200
    post(client, "/api/auth/recover", {"email": world.user.email})
    link = re.search(r"https?://\S+", mail.outbox[-1].body).group()
    params = {k: v[0] for k, v in parse_qs(urlparse(link).query).items()}
    sent = len(mail.outbox)
    assert_response(post(client, path, body), path)
    assert len(mail.outbox) == sent
    assert client.get("/api/me").status_code == 200
    assert other.get("/api/me").status_code == 401
    assert post(browser(), "/api/auth/reset", {**params, "password": PASSWORD}).status_code >= 400
    world.user.refresh_from_db()
    assert world.user.check_password(new_password)
    assert not world.user.check_password(PASSWORD)
    assert (
        post(
            browser(), "/api/auth/sign-in", {"email": world.user.email, "password": new_password}
        ).status_code
        == 200
    )


def test_invitation_mail_failure_rolls_back(world, monkeypatch):
    set_role(world.member, "admin")
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


def png():
    content = BytesIO()
    Image.new("RGB", (4, 4), "orange").save(content, "PNG")
    return SimpleUploadedFile("logo.png", content.getvalue(), content_type="image/png")


def verified(client, email="new@example.com", **body):
    token = signup(client, email, **body)
    assert_response(
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}),
        "/api/auth/verify-signup",
    )
    csrf(client)


def test_signup_requires_a_live_single_use_code():
    client = browser()
    body = {"email": "new@example.com", "name": "New Person", "company_name": "Co"}
    assert post(client, "/api/auth/signup", body).json()["code"] == "signup_code_required"
    bad = post(client, "/api/auth/signup", {**body, "signup_code": "AAAA-BBBB-CCCC"})
    assert bad.json()["code"] == "invalid_signup_code"
    (code,) = issue_codes(1, days=30)
    no_name = post(client, "/api/auth/signup", {**body, "company_name": "", "signup_code": code})
    assert no_name.json()["code"] == "company_name_required"
    first = signup(client, "first@example.com", signup_code=code.lower(), company_name="One")
    second = signup(client, "second@example.com", signup_code=code, company_name="Two")
    assert_response(
        post(client, "/api/auth/verify-signup", {"token": first, "password": PASSWORD}),
        "/api/auth/verify-signup",
    )
    other = browser()
    late = post(other, "/api/auth/verify-signup", {"token": second, "password": PASSWORD})
    assert late.json()["code"] == "invalid_signup_code"
    assert not PlatformUser.objects.filter(email="second@example.com").exists()
    assert post(other, "/api/auth/signup", {**body, "signup_code": code}).status_code == 400
    (expired,) = issue_codes(1, days=1)
    SignupCode.objects.filter(claimed_by__isnull=True).update(expires_at=timezone.now())
    assert (
        post(other, "/api/auth/signup", {**body, "signup_code": expired}).json()["code"]
        == "invalid_signup_code"
    )


def test_operator_can_name_a_code_once():
    out = StringIO()
    call_command("signup_codes", "create", "--code", "hepworth", "--label", "Hepworth", stdout=out)
    assert "hepworth" not in out.getvalue().lower()
    with pytest.raises(CommandError, match="already been issued"):
        call_command("signup_codes", "create", "--code", "HEP-WORTH")
    with pytest.raises(CommandError, match="6 to 40"):
        call_command("signup_codes", "create", "--code", "abc")
    client = browser()
    token = signup(client, signup_code="Hepworth", company_name="Hepworth Electric")
    assert_response(
        post(client, "/api/auth/verify-signup", {"token": token, "password": PASSWORD}),
        "/api/auth/verify-signup",
    )
    assert SignupCode.objects.get(label="Hepworth").claimed_by.email == "new@example.com"


def test_signup_logo_carries_into_the_company():
    client = browser()
    (code,) = issue_codes(1, days=30)
    assert client.post("/api/auth/logos", {"file": png()}).status_code == 400
    uploaded = client.post("/api/auth/logos", {"file": png(), "signup_code": code})
    logo = assert_response(uploaded, "/api/auth/logos")
    text = SimpleUploadedFile("logo.svg", b"<svg/>", content_type="image/svg+xml")
    rejected = client.post("/api/auth/logos", {"file": text, "signup_code": code})
    assert rejected.json()["code"] == "invalid_logo"
    verified(client, signup_code=code, company_name="Logo Co", logo_id=logo["id"])
    assert client.get(f"/api/logos/{logo['id']}")["Content-Type"] == "image/png"
    company = post(
        client,
        "/api/companies",
        {
            "request_key": str(uuid4()),
            "name": "Logo Co",
            "preferred_name": "New Person",
            "logo_id": logo["id"],
        },
    ).json()
    assert company["logo_id"] == logo["id"]
    assert Company.objects.get().logo.expires_at is None
    assert browser().get(f"/api/logos/{logo['id']}").status_code == 401
    session = assert_response(client.get("/api/me"), "/api/me", method="get")
    assert session["memberships"][0]["company_logo_id"] == logo["id"]


def test_company_setup_without_claim_needs_a_code(world):
    client = login_client(world.user)
    body = {"request_key": str(uuid4()), "name": "Second", "preferred_name": "Pat"}
    assert post(client, "/api/companies", body).json()["code"] == "signup_code_required"
    (code,) = issue_codes(1, days=30)
    company = assert_response(
        post(client, "/api/companies", {**body, "signup_code": code}), "/api/companies"
    )
    assert post(client, "/api/companies", {**body, "signup_code": code}).json() == company
    other = {**body, "request_key": str(uuid4())}
    assert post(client, "/api/companies", {**other, "signup_code": code}).status_code == 400


def test_named_owner_accepts_ownership_and_owner_is_protected():
    founder = browser()
    verified(founder, **new_company())
    company = assert_response(
        post(
            founder,
            "/api/companies",
            {
                "request_key": str(uuid4()),
                "name": "A real company",
                "preferred_name": "New Person",
                "owner_email": "Boss@Example.com",
                "owner_name": "Boss",
            },
        ),
        "/api/companies",
    )
    assert mail.outbox[-1].subject == "Take ownership of A real company"
    token = re.search(r"/invite/([\w-]+)", mail.outbox[-1].body).group(1)
    preview = founder.get(f"/api/invitations/{token}/preview").json()
    assert preview["owner"] and preview["role"] == "admin"
    boss = browser()
    verified(boss, "boss@example.com", invitation_token=token)
    accepted = assert_response(
        post(boss, "/api/invitations/accept", {"token": token}), "/api/invitations/accept"
    )
    assert accepted["is_owner"]
    assert str(Company.objects.get(pk=company["id"]).owner_id) == accepted["id"]
    people = founder.get(f"/api/companies/{company['id']}/people").json()["items"]
    me = next(member for member in people if not member["is_owner"])
    demote = post(
        founder,
        f"/api/companies/{company['id']}/people/{accepted['id']}/update",
        {
            "expected_revision": accepted["revision"],
            "access_state": "active",
            "role": "foreman",
            "reason": "Testing",
        },
    )
    assert demote.json()["code"] == "owner_protected"
    url = f"/api/companies/{company['id']}/ownership"
    assert post(founder, url, {"membership_id": me["id"]}).status_code == 403
    handed = post(boss, url, {"membership_id": me["id"]})
    assert assert_response(handed, "/api/companies/{company_id}/ownership")["owner_id"] == me["id"]
