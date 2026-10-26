"""Revisioned company profile commands; membership and work remain independent."""

from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from backend_platform.api import conflict
from django.db import transaction

from .access import authorize_write
from .audit import record_company_event
from .models import Company
from .revisions import expect_revision


@transaction.atomic
def update_profile(identity, company_id, data):
    authorize_write(identity, company_id, "company.manage")
    company = Company.objects.select_for_update().get(pk=company_id)
    expect_revision(company, data.expected_revision)
    try:
        ZoneInfo(data.timezone)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        raise conflict("Unknown IANA timezone.", code="invalid_timezone") from exc
    company.name = data.name
    company.address = data.address
    company.timezone = data.timezone
    company.revision += 1
    company.save(update_fields=["name", "address", "timezone", "revision"])
    record_company_event(identity, company_id, "companies.company.updated", company)
    return company
