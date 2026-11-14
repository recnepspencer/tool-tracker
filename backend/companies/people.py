import hashlib
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from backend_platform.api import bad_request, conflict, forbidden, not_found
from cleanforce_identity.models import PlatformUser
from django.db import transaction
from django.utils import timezone

from .access import authorize_write, set_role
from .audit import record_company_event
from .logos import adopt, pending_logo, release
from .models import Company, CompanyMembership, CompanyRoleGrant, MembershipInvitation, Person
from .revisions import expect_revision


@transaction.atomic
def bootstrap_company(identity, data):
    """Create a company from a signup code. Returns the company and, when someone else will
    own it, the owner invitation and its token."""
    from accounts.signup_codes import available_code, claimed_code

    PlatformUser.objects.select_for_update().get(pk=identity.user_id)
    prior = Company.objects.filter(setup_key=data.request_key).first()
    if prior:
        if prior.created_by_id != identity.user_id or (prior.name, prior.timezone) != (
            data.name,
            data.timezone,
        ):
            raise conflict("Setup key was used for different input.", code="request_key_reused")
        return prior, None, None
    try:
        ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise conflict("Unknown IANA timezone.", code="invalid_timezone") from exc
    code = claimed_code(identity.user_id)
    if code is None:
        if not data.signup_code.strip():
            raise bad_request("Enter the signup code you were given.", code="signup_code_required")
        code = available_code(data.signup_code)
    owner_email = str(data.owner_email or "").casefold()
    someone_else = bool(owner_email) and owner_email != (identity.email or "").casefold()
    if someone_else and not data.owner_name.strip():
        raise bad_request("Enter the owner's name.", code="owner_name_required")
    logo = None
    if data.logo_id:
        logo = (
            code.logo
            if code.logo_id == data.logo_id
            else pending_logo(data.logo_id, identity.user_id)
        )
    elif code.logo:
        release(code.logo)
    company = Company.objects.create(
        name=data.name,
        timezone=data.timezone,
        setup_key=data.request_key,
        created_by_id=identity.user_id,
        logo=logo and adopt(logo),
    )
    person, _ = Person.objects.get_or_create(
        identity_user_id=identity.user_id, defaults={"preferred_name": data.preferred_name}
    )
    member = CompanyMembership.objects.create(company=company, person=person)
    CompanyRoleGrant.objects.create(membership=member, role_code="admin")
    # The creator holds ownership until a named owner accepts their invitation.
    company.owner = member
    company.save(update_fields=["owner"])
    code.claimed_by_id = code.claimed_by_id or identity.user_id
    code.claimed_at = code.claimed_at or timezone.now()
    code.company = company
    code.save(update_fields=["claimed_by", "claimed_at", "company"])
    record_company_event(identity, company.pk, "companies.company.created", company)
    if data.starter_catalog:
        from equipment.models import ToolCategory, ToolModel
        from equipment.starter_catalog import add_starter_catalog

        add_starter_catalog(company.pk, ToolCategory, ToolModel)
    invitation = token = None
    if someone_else:
        token = secrets.token_urlsafe(32)
        invitation = MembershipInvitation.objects.create(
            company=company,
            email=owner_email,
            preferred_name=data.owner_name.strip(),
            role_code="admin",
            grants_ownership=True,
            token_digest=hashlib.sha256(token.encode()).hexdigest(),
            invited_by=member,
            expires_at=timezone.now() + timedelta(days=7),
        )
        record_company_event(identity, company.pk, "companies.invitation.created", invitation)
    return company, invitation, token


@transaction.atomic
def transfer_ownership(identity, company_id, membership_id):
    actor = authorize_write(identity, company_id, "company.read", related_members=[membership_id])
    company = Company.objects.select_for_update().get(pk=company_id)
    if company.owner_id != actor.pk:
        raise forbidden("Only the owner can hand over ownership.", code="owner_required")
    subject = CompanyMembership.objects.filter(
        pk=membership_id, company_id=company_id, access_state="active", ended_at__isnull=True
    ).first()
    if subject is None:
        raise not_found("Active membership not found.")
    # Ownership always comes with administration, so the new owner can run the company.
    set_role(subject, "admin")
    company.owner = subject
    company.save(update_fields=["owner"])
    # A handover settles ownership; an older owner invitation must not take it back.
    MembershipInvitation.objects.filter(
        company_id=company_id,
        grants_ownership=True,
        accepted_at__isnull=True,
        revoked_at__isnull=True,
    ).update(revoked_at=timezone.now())
    record_company_event(
        identity,
        company_id,
        "companies.ownership.transferred",
        company,
        metadata={"from_membership_id": str(actor.pk), "to_membership_id": str(subject.pk)},
    )
    return company


@transaction.atomic
def set_company_logo(identity, company_id, logo_id):
    authorize_write(identity, company_id, "company.manage")
    company = Company.objects.select_for_update().get(pk=company_id)
    if logo_id == company.logo_id:
        return company
    logo = logo_id and adopt(pending_logo(logo_id, identity.user_id))
    release(company.logo)
    company.logo = logo or None
    company.save(update_fields=["logo"])
    record_company_event(identity, company_id, "companies.company.logo_changed", company)
    return company


@transaction.atomic
def create_invitation(identity, company_id, data):
    member = authorize_write(identity, company_id, "people.manage")
    token = secrets.token_urlsafe(32)
    result = MembershipInvitation.objects.create(
        company_id=company_id,
        email=str(data.email).casefold(),
        preferred_name=data.preferred_name,
        role_code=data.role,
        token_digest=hashlib.sha256(token.encode()).hexdigest(),
        invited_by=member,
        expires_at=timezone.now() + timedelta(days=7),
    )
    record_company_event(identity, company_id, "companies.invitation.created", result)
    return result, token


@transaction.atomic
def revoke_invitation(identity, company_id, invitation_id):
    authorize_write(identity, company_id, "people.manage")
    result = (
        MembershipInvitation.objects.select_for_update()
        .filter(pk=invitation_id, company_id=company_id)
        .first()
    )
    if result is None:
        raise not_found("Invitation not found.")
    if result.accepted_at:
        raise conflict(
            "Accepted invitations cannot be revoked; manage the membership instead.",
            code="invitation_accepted",
        )
    if result.revoked_at is None:
        result.revoked_at = timezone.now()
        result.save(update_fields=["revoked_at"])
        record_company_event(identity, company_id, "companies.invitation.revoked", result)
    return result


@transaction.atomic
def accept_invitation(identity, token):
    PlatformUser.objects.select_for_update().get(pk=identity.user_id)
    digest = hashlib.sha256(token.encode()).hexdigest()
    invite = MembershipInvitation.objects.select_for_update().filter(token_digest=digest).first()
    if invite is None:
        raise not_found("Invitation not found.")
    if (identity.email or "").casefold() != invite.email:
        raise forbidden("Sign in with the invited email address.", code="invitation_email_mismatch")
    if invite.accepted_at:
        raise conflict("Invitation has already been used.", code="invitation_used")
    if invite.revoked_at or invite.expires_at <= timezone.now():
        raise conflict("Invitation is expired or revoked.", code="invitation_expired")
    # Authority was checked when sending; invited_by records provenance, not a
    # continuing dependency on the sender's employment or role.
    if CompanyMembership.objects.filter(
        company_id=invite.company_id, person__identity_user_id=identity.user_id
    ).exists():
        raise conflict(
            "Membership already exists; an administrator must update it.", code="membership_exists"
        )
    person, _ = Person.objects.get_or_create(
        identity_user_id=identity.user_id, defaults={"preferred_name": invite.preferred_name}
    )
    member = CompanyMembership.objects.create(company_id=invite.company_id, person=person)
    CompanyRoleGrant.objects.create(membership=member, role_code=invite.role_code)
    if invite.grants_ownership:
        company = Company.objects.select_for_update().get(pk=invite.company_id)
        company.owner = member
        company.save(update_fields=["owner"])
    invite.accepted_at = timezone.now()
    invite.accepted_membership = member
    invite.save(update_fields=["accepted_at", "accepted_membership"])
    record_company_event(identity, invite.company_id, "companies.invitation.accepted", invite)
    return member


@transaction.atomic
def update_membership(identity, company_id, membership_id, data):
    actor = authorize_write(identity, company_id, "people.manage", related_members=[membership_id])
    company = Company.objects.select_for_update().get(pk=company_id)
    subject = CompanyMembership.objects.filter(pk=membership_id, company_id=company_id).first()
    if subject is None:
        raise not_found("Membership not found.")
    expect_revision(subject, data.expected_revision)
    is_admin = CompanyRoleGrant.objects.filter(
        membership=subject, role_code="admin", revoked_at__isnull=True
    ).exists()
    removing_admin = data.access_state != "active" or data.end_membership or data.role != "admin"
    if company.owner_id == subject.pk and removing_admin:
        raise conflict(
            "Transfer ownership before changing the owner's access or administrator role.",
            code="owner_protected",
        )
    if (
        is_admin
        and removing_admin
        and not CompanyRoleGrant.objects.filter(
            membership__company_id=company_id,
            membership__access_state="active",
            membership__ended_at__isnull=True,
            role_code="admin",
            revoked_at__isnull=True,
        )
        .exclude(membership=subject)
        .exists()
    ):
        raise conflict(
            "The company must retain an active administrator.", code="last_administrator"
        )
    now = timezone.now()
    set_role(subject, data.role)
    subject.access_state = data.access_state
    subject.title = data.title
    subject.ended_at = (subject.ended_at or now) if data.end_membership else None
    subject.revision += 1
    subject.save()
    if data.end_membership:
        from work.offboarding import close_membership_participation

        close_membership_participation(subject, actor, data.reason)
    record_company_event(
        identity,
        company_id,
        "companies.membership.updated",
        subject,
        metadata={
            "access_state": data.access_state,
            "ended": data.end_membership,
            "reason": data.reason,
        },
    )
    return subject
