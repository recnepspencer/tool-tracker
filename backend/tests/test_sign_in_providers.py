import base64
import json
import time
from io import BytesIO
from urllib.parse import parse_qs, urlparse

import pytest
from cleanforce_identity.models import PlatformUser
from django.contrib.auth.hashers import is_password_usable
from django.core import mail
from django.core.mail import EmailMessage

from accounts import mail_backends, providers
from accounts.models import ExternalLogin, SignupCode
from companies.models import CompanyRoleGrant, MembershipInvitation
from tests.conftest import login_client
from tests.test_browser_accounts import browser, new_company, post

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def configured(settings):
    settings.GOOGLE_CLIENT_ID = "google-client"
    settings.GOOGLE_CLIENT_SECRET = "google-secret"
    settings.MICROSOFT_CLIENT_ID = "microsoft-client"
    settings.MICROSOFT_CLIENT_SECRET = "microsoft-secret"


def id_token(**claims):
    def part(value):
        return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b"=").decode()

    return f"{part({'alg': 'RS256'})}.{part(claims)}.signature"


def answer(monkeypatch, sent=None, **claims):
    """Make the provider's token endpoint answer with an ID token holding these claims."""

    def urlopen(request, timeout):
        if sent is not None:
            sent.append(parse_qs(request.data.decode()))
        return BytesIO(json.dumps({"id_token": id_token(**claims)}).encode())

    monkeypatch.setattr(providers, "urlopen", urlopen)


def start(client, **body):
    response = post(client, "/api/auth/providers/start", {"provider": "google", **body})
    assert response.status_code == 200, response.content
    query = parse_qs(urlparse(response.json()["url"]).query)
    return query["state"][0], query["nonce"][0]


def google(nonce, email="new@example.com", **extra):
    return {
        "iss": "https://accounts.google.com",
        "aud": "google-client",
        "sub": "google-123",
        "exp": time.time() + 300,
        "nonce": nonce,
        "email": email,
        "email_verified": True,
        "name": "New Person",
        **extra,
    }


def finish(client, state, provider="google"):
    return client.get(f"/api/auth/providers/{provider}/callback", {"state": state, "code": "abc"})


def test_only_configured_providers_are_offered(settings):
    settings.MICROSOFT_CLIENT_SECRET = ""
    assert browser().get("/api/auth/providers").json() == {"providers": ["google"]}


def test_signup_code_creates_the_account_and_claims_the_code(monkeypatch):
    client = browser()
    company = new_company()
    state, nonce = start(client, return_to="/signup", **company)
    sent = []
    answer(monkeypatch, sent, **google(nonce))
    response = finish(client, state)
    assert response.status_code == 302 and response["Location"] == "/company-setup"
    assert sent[0]["code_verifier"] and sent[0]["client_secret"] == ["google-secret"]
    user = PlatformUser.objects.get(email="new@example.com")
    assert user.full_name == "New Person" and not is_password_usable(user.hashed_password)
    assert SignupCode.objects.get(claimed_by=user).company_name == "A real company"
    assert client.get("/api/me").status_code == 200
    # The same Google account signs straight back in later.
    client = browser()
    state, nonce = start(client)
    answer(monkeypatch, **google(nonce, email="changed@example.com"))
    assert finish(client, state)["Location"] == "/app"
    assert ExternalLogin.objects.get().user == user


def test_existing_account_is_matched_by_verified_email(world, monkeypatch):
    client = browser()
    state, nonce = start(client, next="/app/tools")
    answer(monkeypatch, **google(nonce, email="Worker@Example.com"))
    assert finish(client, state)["Location"] == "/app/tools"
    assert client.get("/api/me").status_code == 200


def test_invitation_needs_its_own_address(world, monkeypatch):
    CompanyRoleGrant.objects.create(membership=world.member, role_code="company_admin")
    token = post(
        login_client(world.user),
        f"/api/companies/{world.company.pk}/invitations",
        {"email": "invited@example.com", "preferred_name": "Invited", "role": "field_member"},
    ).json()["token"]
    client = browser()
    state, nonce = start(client, return_to="/signup", invitation_token=token)
    answer(monkeypatch, **google(nonce, email="someone@example.com", name=""))
    assert finish(client, state)["Location"] == f"/signup?sso=wrong_email&next=%2Finvite%2F{token}"
    state, nonce = start(client, return_to="/signup", invitation_token=token)
    answer(monkeypatch, **google(nonce, email="invited@example.com", name=""))
    assert finish(client, state)["Location"] == f"/invite/{token}"
    assert PlatformUser.objects.get(email="invited@example.com").full_name == "Invited"
    assert MembershipInvitation.objects.get(email="invited@example.com").accepted_at is None


@pytest.mark.parametrize(
    ("claims", "reason"),
    [
        ({}, "no_account"),
        ({"email_verified": False}, "unverified_email"),
        ({"aud": "someone-else"}, "failed"),
        ({"iss": "https://evil.example"}, "failed"),
        ({"exp": time.time() - 3600}, "failed"),
        ({"nonce": "replayed"}, "failed"),
    ],
)
def test_untrusted_or_unknown_answers_sign_no_one_in(monkeypatch, claims, reason):
    client = browser()
    state, nonce = start(client)
    answer(monkeypatch, **{**google(nonce), **claims})
    assert finish(client, state)["Location"] == f"/login?sso={reason}"
    assert client.get("/api/me").status_code == 401
    assert not PlatformUser.objects.exists()


def test_state_must_match_and_is_single_use(world, monkeypatch):
    client = browser()
    state, nonce = start(client)
    answer(monkeypatch, **google(nonce, email="worker@example.com"))
    assert finish(client, "forged")["Location"] == "/login?sso=failed"
    # The attempt was spent on the forged answer.
    assert finish(client, state)["Location"] == "/login?sso=failed"
    assert client.get("/api/me").status_code == 401


def test_existing_account_cannot_take_a_signup_code(world, monkeypatch):
    client = browser()
    state, nonce = start(client, return_to="/signup", **new_company())
    answer(monkeypatch, **google(nonce, email="worker@example.com"))
    assert finish(client, state)["Location"] == "/signup?sso=account_exists&as=company"
    assert not SignupCode.objects.filter(claimed_by__isnull=False).exists()


def test_start_checks_the_code_before_leaving(monkeypatch):
    client = browser()
    response = post(
        client,
        "/api/auth/providers/start",
        {"provider": "google", "signup_code": "NOPE-NOPE-NOPE", "company_name": "X"},
    )
    assert response.status_code == 400 and response.json()["code"] == "invalid_signup_code"


def test_microsoft_work_email_needs_a_verified_domain(monkeypatch):
    claims = {"tid": "work-tenant", "email": "boss@company.example"}
    microsoft = providers.PROVIDERS["microsoft"]
    assert microsoft.verified_email(claims) == ""
    assert microsoft.verified_email({**claims, "xms_edov": True}) == "boss@company.example"
    personal = {"tid": providers.MICROSOFT_CONSUMER_TENANT, "email": "me@outlook.com"}
    assert microsoft.verified_email(personal) == "me@outlook.com"
    assert microsoft.issuers({"tid": "work-tenant"}) == {
        "https://login.microsoftonline.com/work-tenant/v2.0"
    }


def test_brevo_sends_real_addresses_and_relays_test_ones(settings, monkeypatch):
    settings.BREVO_API_KEY = "brevo-key"
    requests = []

    def urlopen(request, timeout):
        requests.append(request)
        return BytesIO(b"{}")

    relayed = []
    monkeypatch.setattr(mail_backends, "urlopen", urlopen)
    monkeypatch.setattr(
        mail_backends.SmtpBackend, "send_messages", lambda self, messages: relayed.extend(messages)
    )
    backend = mail_backends.BrevoEmailBackend()
    real = EmailMessage("Hi", "Body", "Tool Tracker <noreply@tool-tracker.app>", ["a@gmail.com"])
    test = EmailMessage("Hi", "Body", "noreply@tool-tracker.app", ["b@example.com", "c@x.test"])
    backend.send_messages([real, test])
    assert relayed == [test]
    (request,) = requests
    assert request.get_header("Api-key") == "brevo-key"
    assert json.loads(request.data) == {
        "sender": {"email": "noreply@tool-tracker.app", "name": "Tool Tracker"},
        "to": [{"email": "a@gmail.com"}],
        "subject": "Hi",
        "textContent": "Body",
    }
    assert not mail.outbox
