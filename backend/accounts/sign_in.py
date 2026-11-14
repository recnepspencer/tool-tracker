"""Google and Microsoft sign-in: starting the round trip and finishing it."""

import re
import secrets
from typing import Literal
from urllib.parse import urlencode
from uuid import UUID

from backend_platform.api import ApiClientError, bad_request, define_http_endpoint
from cleanforce_identity.models import PlatformUser
from cleanforce_identity.sessions.contracts import AuthenticatedSessionState, ExternalIdentityClaims
from cleanforce_identity.sessions.facade import persist_authenticated_session
from django.db import IntegrityError, transaction
from django.http import HttpRequest, HttpResponseRedirect
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Schema
from pydantic import Field

from companies.logos import adopt, pending_logo
from config.contracts import CommandInput

from .models import ExternalLogin
from .providers import PROVIDERS, ProviderError, configured_providers, new_attempt
from .signup_codes import available_code, claim

router = Router(tags=["accounts"])
SESSION_KEY = "nelson_sign_in_attempt"
# The same pages the account screens may send someone on to after signing in.
NEXT_PAGE = re.compile(r"/(invite/[\w-]+|app(/[\w-]+)*|company-setup)")


class ProviderList(Schema):
    providers: list[str]


class ProviderStartInput(CommandInput):
    provider: Literal["google", "microsoft"]
    # Where to explain a failure: the screen the person started from.
    return_to: Literal["/login", "/signup"] = "/login"
    next: str = Field(default="", max_length=300)
    invitation_token: str = Field(default="", max_length=200)
    signup_code: str = Field(default="", max_length=40)
    company_name: str = Field(default="", max_length=200)
    logo_id: UUID | None = None


class ProviderRedirect(Schema):
    url: str


def providers(request: HttpRequest):
    return {"providers": configured_providers()}


@csrf_protect
def start(request: HttpRequest, data: ProviderStartInput):
    from .api import live_invitation

    provider = PROVIDERS[data.provider]
    if not provider.configured:
        raise bad_request("This sign-in option is not set up.", code="provider_unavailable")
    company_name = data.company_name.strip()
    # Check what can be checked now, so a bad code or link fails before the round trip.
    with transaction.atomic():
        if data.invitation_token and live_invitation(data.invitation_token) is None:
            raise bad_request(
                "This invitation is expired, revoked, or already used. Ask for a new link.",
                code="invalid_invitation",
            )
        if data.signup_code:
            available_code(data.signup_code)
            if not company_name:
                raise bad_request("Enter your company name.", code="company_name_required")
            if data.logo_id:
                pending_logo(data.logo_id, None)
    attempt = new_attempt(data.provider)
    request.session[SESSION_KEY] = {
        **attempt,
        "return_to": data.return_to,
        "next": data.next if NEXT_PAGE.fullmatch(data.next) else "",
        "invitation_token": data.invitation_token,
        "signup_code": data.signup_code,
        "company_name": company_name,
        "logo_id": str(data.logo_id) if data.logo_id else "",
    }
    url = provider.authorize(
        state=attempt["state"], nonce=attempt["nonce"], verifier=attempt["verifier"]
    )
    return {"url": url}


def account_for(attempt, provider, claims, email):
    """The person these provider claims sign in as, creating them when the attempt allows it."""
    from .api import live_invitation

    link = (
        ExternalLogin.objects.select_related("user")
        .filter(provider=provider.name, subject=claims["sub"])
        .first()
    )
    user = link.user if link else PlatformUser.objects.filter(email=email).first()
    if user is not None:
        if attempt["signup_code"]:
            raise ProviderError("account_exists")
        if not user.is_active:
            raise ProviderError("no_account")
    else:
        invitation = code = logo = None
        if attempt["invitation_token"]:
            invitation = live_invitation(attempt["invitation_token"])
            if invitation is None:
                raise ProviderError("invalid_invitation")
            if invitation.email.casefold() != email:
                raise ProviderError("wrong_email")
        elif attempt["signup_code"]:
            try:
                code = available_code(attempt["signup_code"])
                if attempt["logo_id"]:
                    logo = pending_logo(UUID(attempt["logo_id"]), None)
            except ApiClientError as exc:
                raise ProviderError(
                    "invalid_signup_code" if code is None else "logo_unavailable"
                ) from exc
        else:
            # Only an invitation or a signup code creates an account.
            raise ProviderError("no_account")
        name = str(claims.get("name") or (invitation and invitation.preferred_name) or "")
        user = PlatformUser(email=email, full_name=name.strip()[:120])
        # No password: this person signs in through the provider, or sets one by resetting it.
        user.set_password(None)
        try:
            with transaction.atomic():
                user.save(force_insert=True)
        except IntegrityError as exc:
            raise ProviderError("failed") from exc
        if code:
            claim(code, user.pk, company_name=attempt["company_name"], logo=logo)
            if logo:
                adopt(logo)
    ExternalLogin.objects.get_or_create(
        provider=provider.name, subject=claims["sub"], defaults={"user": user}
    )
    return user


@never_cache
def callback(request: HttpRequest, provider: str):
    attempt = request.session.pop(SESSION_KEY, None)
    if not attempt or attempt["provider"] != provider:
        return HttpResponseRedirect("/login?" + urlencode({"sso": "failed"}))

    def back(code):
        query = {"sso": code}
        if attempt["invitation_token"]:
            query["next"] = f"/invite/{attempt['invitation_token']}"
        elif attempt["signup_code"]:
            query["as"] = "company"
        return HttpResponseRedirect(f"{attempt['return_to']}?{urlencode(query)}")

    if request.GET.get("error"):
        return back("cancelled")
    if not secrets.compare_digest(request.GET.get("state", ""), attempt["state"]):
        return back("failed")
    chosen = PROVIDERS[provider]
    try:
        claims = chosen.claims(
            code=request.GET.get("code", ""), verifier=attempt["verifier"], nonce=attempt["nonce"]
        )
        email = chosen.verified_email(claims)
        if not email:
            raise ProviderError("unverified_email")
        with transaction.atomic():
            user = account_for(attempt, chosen, claims, email)
    except ProviderError as exc:
        return back(exc.code)
    persist_authenticated_session(
        request,
        AuthenticatedSessionState(
            claims=ExternalIdentityClaims(sub=str(user.id), email=user.email, name=user.full_name)
        ),
    )
    # The same revocation marker password sign-in leaves: a password reset ends this session.
    request.session["nelson_credentials"] = [str(user.pk), str(user.password_reset_version)]
    if attempt["invitation_token"]:
        return HttpResponseRedirect(f"/invite/{attempt['invitation_token']}")
    if attempt["signup_code"]:
        return HttpResponseRedirect("/company-setup")
    return HttpResponseRedirect(attempt["next"] or "/app")


define_http_endpoint(
    router, method="get", path="/auth/providers", endpoint=providers, response=ProviderList
)
define_http_endpoint(
    router, method="post", path="/auth/providers/start", endpoint=start, response=ProviderRedirect
)
