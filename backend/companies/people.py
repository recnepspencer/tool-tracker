import hashlib
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from backend_platform.api import conflict, forbidden, not_found
from cleanforce_identity.models import PlatformUser
from django.db import transaction
from django.utils import timezone

from .access import authorize_write, capabilities
from .audit import record_company_event
from .models import Company, CompanyMembership, CompanyRoleGrant, MembershipInvitation, Person
from .revisions import expect_revision


@transaction.atomic
def bootstrap_company(identity, data):
    PlatformUser.objects.select_for_update().get(pk=identity.user_id)
    prior = Company.objects.filter(setup_key=data.request_key).first()
    if prior:
        if prior.created_by_id != identity.user_id or (prior.name, prior.timezone) != (
            data.name,
            data.timezone,
        ):
            raise conflict("Setup key was used for different input.", code="request_key_reused")
        return prior
    try:
        ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise conflict("Unknown IANA timezone.", code="invalid_timezone") from exc
    company = Company.objects.create(
        name=data.name,
        timezone=data.timezone,
        setup_key=data.request_key,
        created_by_id=identity.user_id,
    )
    person, _ = Person.objects.get_or_create(
        identity_user_id=identity.user_id, defaults={"preferred_name": data.preferred_name}
    )
    member = CompanyMembership.objects.create(company=company, person=person)
    CompanyRoleGrant.objects.create(membership=member, role_code="company_admin")
    record_company_event(identity, company.pk, "companies.company.created", company)
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
    reference = MembershipInvitation.objects.filter(token_digest=digest).first()
    if reference is None:
        raise not_found("Invitation not found.")
    if (identity.email or "").casefold() != reference.email:
        raise forbidden("Sign in with the invited email address.", code="invitation_email_mismatch")
    prior_member = CompanyMembership.objects.filter(
        company_id=reference.company_id, person__identity_user_id=identity.user_id
    ).first()
    ids = [reference.invited_by_id] + ([prior_member.pk] if prior_member else [])
    list(CompanyMembership.objects.select_for_update().filter(pk__in=ids).order_by("id"))
    invite = MembershipInvitation.objects.select_for_update().get(pk=reference.pk)
    if invite.accepted_at:
        raise conflict("Invitation has already been used.", code="invitation_used")
    if invite.revoked_at or invite.expires_at <= timezone.now():
        raise conflict("Invitation is expired or revoked.", code="invitation_expired")
    inviter = CompanyMembership.objects.get(pk=invite.invited_by_id)
    if (
        inviter.access_state != "active"
        or inviter.ended_at
        or "people.manage" not in capabilities(inviter)
    ):
        raise forbidden(
            "Invitation issuer no longer has invitation authority.", code="inviter_unauthorized"
        )
    if prior_member:
        raise conflict(
            "Membership already exists; an administrator must update it.", code="membership_exists"
        )
    person, _ = Person.objects.get_or_create(
        identity_user_id=identity.user_id, defaults={"preferred_name": invite.preferred_name}
    )
    member = CompanyMembership.objects.create(company_id=invite.company_id, person=person)
    CompanyRoleGrant.objects.create(membership=member, role_code=invite.role_code)
    invite.accepted_at = timezone.now()
    invite.accepted_membership = member
    invite.save(update_fields=["accepted_at", "accepted_membership"])
    record_company_event(identity, invite.company_id, "companies.invitation.accepted", invite)
    return member


@transaction.atomic
def update_membership(identity, company_id, membership_id, data):
    actor = authorize_write(identity, company_id, "people.manage", related_members=[membership_id])
    Company.objects.select_for_update().get(pk=company_id)
    subject = CompanyMembership.objects.filter(pk=membership_id, company_id=company_id).first()
    if subject is None:
        raise not_found("Membership not found.")
    expect_revision(subject, data.expected_revision)
    is_admin = CompanyRoleGrant.objects.filter(
        membership=subject, role_code="company_admin", revoked_at__isnull=True
    ).exists()
    removing_admin = (
        data.access_state != "active" or data.end_membership or "company_admin" not in data.roles
    )
    if (
        is_admin
        and removing_admin
        and not CompanyRoleGrant.objects.filter(
            membership__company_id=company_id,
            membership__access_state="active",
            membership__ended_at__isnull=True,
            role_code="company_admin",
            revoked_at__isnull=True,
        )
        .exclude(membership=subject)
        .exists()
    ):
        raise conflict(
            "The company must retain an active administrator.", code="last_administrator"
        )
    now = timezone.now()
    CompanyRoleGrant.objects.filter(membership=subject, revoked_at__isnull=True).exclude(
        role_code__in=data.roles
    ).update(revoked_at=now)
    for role in sorted(set(data.roles)):
        CompanyRoleGrant.objects.get_or_create(membership=subject, role_code=role, revoked_at=None)
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
