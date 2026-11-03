import hashlib
import re
import secrets
from datetime import timedelta
from uuid import UUID

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
from cleanforce_identity.sessions.errors import (
    IdentityAuthenticationRequiredError,
    InvalidAuthenticatedSessionError,
)
from cleanforce_identity.users.errors import InactiveIdentityRecordError
from cleanforce_identity.users.facade import current_identity
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import FileResponse, HttpRequest
from django.utils import timezone
from django.views.decorators.csrf import csrf_protect
from ninja import File, Form, Router, Schema
from ninja.files import UploadedFile
from pydantic import EmailStr, Field

from companies.logos import adopt, pending_logo, read_logo, store_logo
from companies.models import MembershipInvitation
from config.api import SessionView, session_info
from config.contracts import CommandInput

from .mail import app_url, send_account_mail
from .models import SignupChallenge, SignupCode
from .signup_codes import available_code, claim, claimed_code

router = Router(tags=["accounts"])


class SignupInput(CommandInput):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    invitation_token: str = Field(default="", max_length=200)
    # A new company needs a signup code; people joining through an invitation do not.
    signup_code: str = Field(default="", max_length=40)
    company_name: str = Field(default="", max_length=200)
    logo_id: UUID | None = None


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
    owner: bool


class LogoView(Schema):
    id: UUID
    content_type: str
    byte_count: int


class PendingCompanyView(Schema):
    company_name: str
    logo_id: UUID | None


class CompanySignupView(Schema):
    name: str
    pending: PendingCompanyView | None


def live_invitation(token):
    return (
        MembershipInvitation.objects.select_related("company")
        .filter(
            token_digest=hashlib.sha256(token.encode()).hexdigest(),
            accepted_at__isnull=True,
            revoked_at__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .first()
    )


def signed_in_user_id(request):
    try:
        return current_identity(request).user_id
    except (
        IdentityAuthenticationRequiredError,
        InvalidAuthenticatedSessionError,
        InactiveIdentityRecordError,
    ):
        return None


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
    code = logo = None
    company_name = data.company_name.strip()
    # Verification proves mailbox ownership before any account or company access exists.
    with transaction.atomic():
        if data.invitation_token:
            invitation = live_invitation(data.invitation_token)
            if invitation is None:
                raise bad_request(
                    "This invitation is expired, revoked, or already used. Ask for a new link.",
                    code="invalid_invitation",
                )
            if invitation.email.casefold() != email.casefold():
                raise bad_request(
                    "Use the email address this invitation was sent to.",
                    code="invitation_email_mismatch",
                )
        else:
            if not data.signup_code.strip():
                raise bad_request(
                    "Enter the signup code you were given.", code="signup_code_required"
                )
            code = available_code(data.signup_code)
            if not company_name:
                raise bad_request("Enter your company name.", code="company_name_required")
            if data.logo_id:
                logo = pending_logo(data.logo_id, None)
        if not PlatformUser.objects.filter(email=email).exists():
            token = secrets.token_urlsafe(32)
            SignupChallenge.objects.create(
                token_digest=hashlib.sha256(token.encode()).hexdigest(),
                email=email,
                name=data.name.strip(),
                expires_at=timezone.now() + timedelta(hours=1),
                signup_code=code,
                company_name=company_name if code else "",
                logo=logo,
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
    code = None
    if challenge.signup_code_id:
        # Several pending signups may name one code; the first verified account claims it.
        code = SignupCode.objects.select_for_update().get(pk=challenge.signup_code_id)
        if code.claimed_by_id or code.revoked_at or code.expires_at <= timezone.now():
            raise bad_request(
                "This signup code was used, revoked, or expired before you verified your email. Ask for a new code.",
                code="invalid_signup_code",
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
    if code:
        claim(code, user.pk, company_name=challenge.company_name, logo=challenge.logo)
        if challenge.logo:
            adopt(challenge.logo)
    password_login(request, PasswordLoginContract(email=challenge.email, password=data.password))
    return session_info(request)


def preview_invitation(request: HttpRequest, token: str):
    invite = live_invitation(token)
    if invite is None:
        raise not_found("This invitation is expired, revoked, or already used. Ask for a new link.")
    return {
        "company_name": invite.company.name,
        "email": invite.email,
        "preferred_name": invite.preferred_name,
        "role": invite.role_code,
        "owner": invite.grants_ownership,
    }


@csrf_protect
@transaction.atomic
def upload_logo(request: HttpRequest, file: File[UploadedFile], signup_code: Form[str] = ""):
    user_id = signed_in_user_id(request)
    # Before an account exists, only a usable signup code may store bytes.
    if user_id is None:
        available_code(signup_code[:40])
    return store_logo(file, user_id)


def download_logo(request: HttpRequest, logo_id: UUID):
    logo, stream = read_logo(current_identity(request).user_id, logo_id)
    response = FileResponse(stream, content_type=logo.content_type)
    response["X-Content-Type-Options"] = "nosniff"
    response["Content-Security-Policy"] = "default-src 'none'; sandbox"
    return response


def company_signup(request: HttpRequest):
    user_id = current_identity(request).user_id
    with transaction.atomic():
        code = claimed_code(user_id)
    pending = code and {"company_name": code.company_name, "logo_id": code.logo_id}
    return {"name": PlatformUser.objects.get(pk=user_id).full_name or "", "pending": pending}


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
    router, method="post", path="/auth/logos", endpoint=upload_logo, response=LogoView
)
define_http_endpoint(
    router, method="get", path="/logos/{logo_id}", endpoint=download_logo, response=bytes
)
define_http_endpoint(
    router,
    method="get",
    path="/company-signup",
    endpoint=company_signup,
    response=CompanySignupView,
)
define_http_endpoint(
    router,
    method="get",
    path="/invitations/{token}/preview",
    endpoint=preview_invitation,
    response=InvitationPreview,
)
