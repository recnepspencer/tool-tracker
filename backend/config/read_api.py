"""Cross-domain read projections. These endpoints never own domain mutations."""

from datetime import datetime
from uuid import UUID

from backend_platform.api import define_http_endpoint
from backend_platform.models import PlatformAuditEventRecord
from cleanforce_identity.users.facade import current_identity
from django.db.models import Q
from django.http import HttpRequest
from ninja import Query, Router, Schema

from companies.access import capabilities, require_member
from companies.models import CompanyMembership
from equipment.models import AssetIncident, CustodyHandoff, CustodyPeriod, ToolAsset, ToolRequest
from work.models import JobAssignment

from .contracts import PageInput, paginate

router = Router(tags=["reporting"])


class ActivityView(Schema):
    id: UUID
    event_key: str
    occurred_at: datetime
    actor_user_id: UUID | None
    effective_user_id: UUID | None
    subject_domain: str
    subject_entity_type: str
    subject_entity_id: str
    metadata: dict[str, str | int | float | bool | None]


class ActivityPage(Schema):
    items: list[ActivityView]
    next_offset: int | None


class CompanySummary(Schema):
    active_people: int
    active_assets: int
    missing_assets: int
    damaged_assets: int
    pending_requests: int
    pending_handoffs: int


class DirectoryJob(Schema):
    job_id: UUID
    number: str
    name: str
    responsibility: str


class DirectoryTool(Schema):
    asset_id: UUID
    asset_tag: str
    name: str
    serviceability: str
    missing: bool


class DirectoryPerson(Schema):
    membership_id: UUID
    name: str
    jobs: list[DirectoryJob]
    tools: list[DirectoryTool]


class DirectoryPage(Schema):
    items: list[DirectoryPerson]
    next_offset: int | None


def activity(request: HttpRequest, company_id: UUID, page: Query[PageInput]):
    identity = current_identity(request)
    member = require_member(identity, company_id, "company.read")
    query = PlatformAuditEventRecord.objects.filter(metadata__company_id=str(company_id))
    if "activity.read" not in capabilities(member):
        query = query.filter(effective_user_id=identity.user_id)
    return paginate(query.order_by("-occurred_at", "id"), page.limit, page.offset)


def summary(request: HttpRequest, company_id: UUID):
    require_member(current_identity(request), company_id, "activity.read")
    return {
        "active_people": CompanyMembership.objects.filter(
            company_id=company_id, access_state="active", ended_at__isnull=True
        ).count(),
        "active_assets": ToolAsset.objects.filter(
            company_id=company_id, lifecycle="active"
        ).count(),
        "missing_assets": AssetIncident.objects.filter(
            company_id=company_id, kind="missing", resolved_at__isnull=True
        ).count(),
        "damaged_assets": ToolAsset.objects.filter(
            company_id=company_id, serviceability="damaged", lifecycle="active"
        ).count(),
        "pending_requests": ToolRequest.objects.filter(
            company_id=company_id, status="pending"
        ).count(),
        "pending_handoffs": CustodyHandoff.objects.filter(
            company_id=company_id, status="pending"
        ).count(),
    }


def directory(
    request: HttpRequest,
    company_id: UUID,
    page: Query[PageInput],
    job_id: UUID | None = None,
    unassigned: bool = False,
    search: str = "",
):
    require_member(current_identity(request), company_id, "jobs.read")
    query = CompanyMembership.objects.filter(
        company_id=company_id, access_state="active", ended_at__isnull=True
    ).select_related("person")
    assignments = JobAssignment.objects.filter(company_id=company_id, ends_at__isnull=True)
    if job_id:
        query = query.filter(pk__in=assignments.filter(job_id=job_id).values("membership_id"))
    if unassigned:
        query = query.exclude(pk__in=assignments.values("membership_id"))
    if search:
        text = search[:200]
        job_members = assignments.filter(
            Q(job__name__icontains=text) | Q(job__number__icontains=text)
        ).values("membership_id")
        tool_members = (
            CustodyPeriod.objects.filter(company_id=company_id, ends_at__isnull=True)
            .filter(
                Q(asset__asset_tag__icontains=text)
                | Q(asset__serial_number__icontains=text)
                | Q(asset__tool_model__name__icontains=text)
                | Q(asset__tool_model__manufacturer__icontains=text)
                | Q(asset__tool_model__model_number__icontains=text)
            )
            .values("holder_membership_id")
        )
        query = query.filter(
            Q(person__preferred_name__icontains=text)
            | Q(pk__in=job_members)
            | Q(pk__in=tool_members)
        )
    rows = list(
        query.order_by("person__preferred_name", "id")[page.offset : page.offset + page.limit + 1]
    )
    people = {
        row.pk: {
            "membership_id": row.pk,
            "name": row.person.preferred_name,
            "jobs": [],
            "tools": [],
        }
        for row in rows[: page.limit]
    }
    for assignment in assignments.filter(membership_id__in=people).select_related("job"):
        people[assignment.membership_id]["jobs"].append(
            {
                "job_id": assignment.job_id,
                "number": assignment.job.number,
                "name": assignment.job.name,
                "responsibility": assignment.responsibility,
            }
        )
    missing = set(
        AssetIncident.objects.filter(
            company_id=company_id, kind="missing", resolved_at__isnull=True
        ).values_list("asset_id", flat=True)
    )
    for custody in CustodyPeriod.objects.filter(
        company_id=company_id, holder_membership_id__in=people, ends_at__isnull=True
    ).select_related("asset__tool_model"):
        people[custody.holder_membership_id]["tools"].append(
            {
                "asset_id": custody.asset_id,
                "asset_tag": custody.asset.asset_tag,
                "name": custody.asset.tool_model.name,
                "serviceability": custody.asset.serviceability,
                "missing": custody.asset_id in missing,
            }
        )
    return {
        "items": list(people.values()),
        "next_offset": page.offset + page.limit if len(rows) > page.limit else None,
    }


define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/activity",
    endpoint=activity,
    response=ActivityPage,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/summary",
    endpoint=summary,
    response=CompanySummary,
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/directory",
    endpoint=directory,
    response=DirectoryPage,
)
