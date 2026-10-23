from datetime import timedelta
from types import SimpleNamespace

import pytest
from cleanforce_identity.models import PlatformUser
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.test import Client
from django.utils import timezone

from companies.models import Company, CompanyMembership, CompanyRoleGrant, Person
from equipment.models import CustodyPeriod, ToolAsset, ToolCategory, ToolModel, Warehouse

PASSWORD = "test-only-password-not-a-production-credential"


@pytest.fixture(scope="session")
def password_hash():
    return make_password(PASSWORD)


@pytest.fixture
def world(db, password_hash):
    with transaction.atomic():
        company = Company.objects.create(name="Nelson Electric")
        other_company = Company.objects.create(name="Other company")
        user = PlatformUser.objects.create(
            email="worker@example.com", hashed_password=password_hash
        )
        person = Person.objects.create(identity_user=user, preferred_name="Ray")
        member = CompanyMembership.objects.create(company=company, person=person)
        grant = CompanyRoleGrant.objects.create(membership=member, role_code="field_member")
        warehouse = Warehouse.objects.create(company=company, code="MAIN", name="Main warehouse")
        category = ToolCategory.objects.create(company=company, name="Drills")
        model = ToolModel.objects.create(
            company=company,
            category=category,
            name="Hammer drill",
            manufacturer="Milwaukee",
            model_number="2904-20",
        )
        assets = []
        for tag in ("NE-001", "NE-002"):
            asset = ToolAsset.objects.create(
                company=company,
                tool_model=model,
                asset_tag=tag,
                registered_by=member,
                origin_warehouse=warehouse,
                responsible_warehouse=warehouse,
            )
            CustodyPeriod.objects.create(
                company=company,
                asset=asset,
                holder_warehouse=warehouse,
                starts_at=timezone.now() - timedelta(hours=1),
            )
            assets.append(asset)
    return SimpleNamespace(
        company=company,
        other_company=other_company,
        user=user,
        person=person,
        member=member,
        grant=grant,
        warehouse=warehouse,
        model=model,
        assets=assets,
    )


def login_client(user):
    client = Client(enforce_csrf_checks=True)
    token = client.get("/api/auth/csrf").json()["csrf_token"]
    response = client.post(
        "/api/auth/password-login",
        {"email": user.email, "password": PASSWORD},
        content_type="application/json",
        HTTP_X_CSRFTOKEN=token,
    )
    assert response.status_code == 302, response.content
    # Login may rotate the CSRF secret. Read a fresh token for subsequent writes.
    token = client.get("/api/auth/csrf").json()["csrf_token"]
    client.defaults["HTTP_X_CSRFTOKEN"] = token
    return client


@pytest.fixture
def api_client(world):
    return login_client(world.user)


@pytest.fixture
def asset_url(world):
    return f"/api/companies/{world.company.id}/tools/{world.assets[0].id}/requests"
