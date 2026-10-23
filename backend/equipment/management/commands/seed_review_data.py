import os
from uuid import NAMESPACE_URL, uuid5

from cleanforce_identity.models import PlatformUser
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from companies.models import Company, CompanyMembership, CompanyRoleGrant, Person
from equipment.asset_creation import create_asset_at_warehouse
from equipment.models import ToolAsset, ToolCategory, ToolModel, Warehouse


def review_id(name):
    return uuid5(NAMESPACE_URL, f"nelson-electric/local-review/{name}")


class Command(BaseCommand):
    help = "Create local review data without resetting existing assets, custody, or requests."

    @transaction.atomic
    def handle(self, *args, **options):
        password = os.getenv("NELSON_REVIEW_PASSWORD")
        if not settings.DEBUG or not password:
            raise CommandError("Requires DEBUG=1 and NELSON_REVIEW_PASSWORD; local review only.")
        company, _ = Company.objects.get_or_create(
            id=review_id("company"), defaults={"name": "Nelson Electric review"}
        )
        user, created = PlatformUser.objects.get_or_create(email="reviewer@example.com")
        if created:
            user.set_password(password)
            user.save()
        person, _ = Person.objects.get_or_create(
            identity_user=user, defaults={"preferred_name": "Review employee"}
        )
        member, _ = CompanyMembership.objects.get_or_create(company=company, person=person)
        CompanyRoleGrant.objects.get_or_create(
            membership=member, role_code="field_member", revoked_at=None
        )
        warehouse, _ = Warehouse.objects.get_or_create(
            company=company, code="MAIN", defaults={"name": "Main warehouse"}
        )
        category, _ = ToolCategory.objects.get_or_create(
            id=review_id("category"), defaults={"company": company, "name": "Drills"}
        )
        model, _ = ToolModel.objects.get_or_create(
            id=review_id("drill-model"),
            defaults={
                "company": company,
                "category": category,
                "name": "M18 hammer drill",
                "manufacturer": "Milwaukee",
                "model_number": "2904-20",
            },
        )
        for tag in ("NE-001", "NE-002"):
            asset = ToolAsset.objects.filter(company=company, asset_tag=tag).first()
            if asset is None:
                asset = create_asset_at_warehouse(
                    company=company,
                    tool_model=model,
                    asset_tag=tag,
                    warehouse=warehouse,
                    registered_by=member,
                )
            self.stdout.write(f"{tag}: {asset.id}")
        self.stdout.write(f"Company: {company.id}")
        self.stdout.write("Login: reviewer@example.com (password from NELSON_REVIEW_PASSWORD)")
