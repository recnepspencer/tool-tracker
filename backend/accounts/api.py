import hashlib
import re
import secrets
from datetime import timedelta

from backend_platform.api import bad_request, conflict, define_http_endpoint, not_found
from cleanforce_identity.authentication.contracts import (
    PasswordLoginContract,
    PasswordResetCompleteContract,
    PasswordResetCompleteProjection,
    PasswordResetDispatchProjection,
    PasswordResetRequestContract,
)
from cleanforce_identity.authentication.facade import (
    complete_password_reset,
    end_browser_session,
    password_login,
    request_password_reset,
)
from cleanforce_identity.models import PlatformUser
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import HttpRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from ninja import Router, Schema
from pydantic import EmailStr, Field

from companies.models import MembershipInvitation
from config.api import SessionView, session_info
from config.contracts import CommandInput

from .mail import app_url, send_account_mail
from .models import SignupChallenge

router = Router(tags=["accounts"])


class SignupInput(CommandInput):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    invitation_token: str = Field(default="", max_length=200)


class VerifySignupInput(CommandInput):
    token: str = Field(min_length=20, max_length=200)
    password: str = Field(min_length=12, max_length=200)


class AccountMessage(Schema):
    message: str


class InvitationPreview(Schema):
    company_name: str
    email: str
    preferred_name: str
    role: str


@csrf_protect
def sign_in(request: HttpRequest, data: PasswordLoginContract):
    password_login(request, data)
    return session_info(request)


@csrf_protect
def sign_out(request: HttpRequest):
    end_browser_session(request)
    return {"message": "Signed out."}


@csrf_protect
def recovery(request: HttpRequest, data: PasswordResetRequestContract):
    return request_password_reset(data)


@csrf_protect
def reset_password(request: HttpRequest, data: PasswordResetCompleteContract):
    try:
        validate_password(data.password)
    except ValidationError as exc:
        raise bad_request(" ".join(exc.messages)) from exc
    return complete_password_reset(data)


@csrf_protect
def signup(request: HttpRequest, data: SignupInput):
    email = str(data.email).lower()
    # Verification proves mailbox ownership before any account or company access exists.
    with transaction.atomic():
        if not PlatformUser.objects.filter(email=email).exists():
            token = secrets.token_urlsafe(32)
            SignupChallenge.objects.create(
                token_digest=hashlib.sha256(token.encode()).hexdigest(),
                email=email,
                name=data.name.strip(),
                expires_at=timezone.now() + timedelta(hours=1),
            )
            query = {"token": token}
            if re.fullmatch(r"[\w-]{20,200}", data.invitation_token):
                query["invitation"] = data.invitation_token
            send_account_mail(
                email,
                "Verify your Nelson Electric account",
                f"Choose your password to finish creating your account:\n\n{app_url('verify-email', **query)}\n\nThis link expires in one hour. If you did not request this, ignore it.",
            )
    return {
        "message": "If this email can be registered, a verification link has been sent. Already registered? Sign in or reset your password."
    }


@csrf_protect
@transaction.atomic
def verify_signup(request: HttpRequest, data: VerifySignupInput):
    challenge = (
        SignupChallenge.objects.select_for_update()
        .filter(token_digest=hashlib.sha256(data.token.encode()).hexdigest())
        .first()
    )
    if challenge is None or challenge.consumed_at or challenge.expires_at <= timezone.now():
        raise bad_request(
            "This verification link is invalid, expired, or already used.",
            code="invalid_verification_link",
        )
    user = PlatformUser(email=challenge.email, full_name=challenge.name)
    try:
        validate_password(data.password, user)
    except ValidationError as exc:
        raise bad_request(" ".join(exc.messages)) from exc
    try:
        with transaction.atomic():
            user.set_password(data.password)
            user.save(force_insert=True)
    except IntegrityError as exc:
        raise conflict("This account already exists. Sign in or reset your password.") from exc
    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    password_login(request, PasswordLoginContract(email=challenge.email, password=data.password))
    return session_info(request)


def preview_invitation(request: HttpRequest, token: str):
    invite = (
        MembershipInvitation.objects.select_related("company")
        .filter(
            token_digest=hashlib.sha256(token.encode()).hexdigest(),
            accepted_at__isnull=True,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .first()
    )
    if invite is None:
        raise not_found("This invitation is expired, revoked, or already used. Ask for a new link.")
    return {
        "company_name": invite.company.name,
        "email": invite.email,
        "preferred_name": invite.preferred_name,
        "role": invite.role_code,
    }


define_http_endpoint(
    router, method="post", path="/auth/sign-in", endpoint=sign_in, response=SessionView
)
define_http_endpoint(
    router,
    method="post",
    path="/auth/recover",
    endpoint=recovery,
    response=PasswordResetDispatchProjection,
)
define_http_endpoint(
    router,
    method="post",
    path="/auth/reset",
    endpoint=reset_password,
    response=PasswordResetCompleteProjection,
)
define_http_endpoint(
    router, method="post", path="/auth/sign-out", endpoint=sign_out, response=AccountMessage
)
define_http_endpoint(
    router, method="post", path="/auth/signup", endpoint=signup, response=AccountMessage
)
define_http_endpoint(
    router, method="post", path="/auth/verify-signup", endpoint=verify_signup, response=SessionView
)
define_http_endpoint(
    router,
    method="get",
    path="/invitations/{token}/preview",
    endpoint=preview_invitation,
    response=InvitationPreview,
)
