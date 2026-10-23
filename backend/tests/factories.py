from types import SimpleNamespace
from uuid import uuid4

from cleanforce_identity.models import PlatformUser

from companies.models import CompanyMembership, CompanyRoleGrant, Person


def member_in(company, password_hash, role="field_member", *, email=None, name="Employee"):
    user = PlatformUser.objects.create(
        email=email or f"{uuid4().hex}@example.com", hashed_password=password_hash
    )
    person = Person.objects.create(identity_user=user, preferred_name=name)
    member = CompanyMembership.objects.create(company=company, person=person)
    CompanyRoleGrant.objects.create(membership=member, role_code=role)
    return SimpleNamespace(user=user, member=member, person=person)
