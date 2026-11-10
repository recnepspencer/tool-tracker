from types import SimpleNamespace
from uuid import uuid4

import pytest
from backend_platform.jobs import run_pending_jobs
from backend_platform.models import PlatformAuditEventRecord
from django.utils import timezone

from companies.models import Company
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response
from work.models import Job, JobAssignment, JobAssignmentPolicy


@pytest.fixture
def crew(db, password_hash):
    company = Company.objects.create(name="Job-only tests")
    worker = member_in(company, password_hash)
    admin = member_in(company, password_hash, "admin")
    job = Job.objects.create(company=company, name="Rough-in")
    policy = JobAssignmentPolicy.objects.create(
        company=company, self_join_mode="direct", self_leave_mode="approval_required"
    )
    return SimpleNamespace(
        company=company,
        worker=worker,
        admin=admin,
        client=login_client(worker.user),
        manager=login_client(admin.user),
        job=job,
        policy=policy,
        base=f"/api/companies/{company.pk}",
    )


def participate(ctx, **kwargs):
    return ctx.client.post(
        f"{ctx.base}/jobs/{ctx.job.pk}/participation",
        {"request_key": str(uuid4()), **kwargs},
        content_type="application/json",
    )


def assign(ctx, revision, reason="Staff the job"):
    return ctx.manager.post(
        f"{ctx.base}/jobs/{ctx.job.pk}/assignments",
        {
            "expected_revision": revision,
            "membership_id": str(ctx.worker.member.pk),
            "reason": reason,
        },
        content_type="application/json",
    )


def replace_assignment(ctx, assignment_id):
    """End the worker's assignment and put them back on the job as a new one."""
    ctx.job.refresh_from_db()
    ended = ctx.manager.post(
        f"{ctx.base}/assignments/{assignment_id}/end",
        {"expected_revision": ctx.job.revision, "note": "Moving crews around"},
        content_type="application/json",
    )
    assert ended.status_code == 200, ended.content
    ctx.job.refresh_from_db()
    replacement = assign(ctx, ctx.job.revision, reason="Back on this job")
    assert replacement.status_code == 200, replacement.content
    return replacement.json()


def directory_person(ctx):
    response = assert_response(
        ctx.client.get(f"{ctx.base}/directory"),
        "/api/companies/{company_id}/directory",
        method="get",
    )
    return next(
        person
        for person in response["items"]
        if person["membership_id"] == str(ctx.worker.member.pk)
    )


@pytest.mark.parametrize(
    "mode,status,assigned",
    [("direct", 201, True), ("approval_required", 201, False), ("disabled", 403, False)],
)
def test_join_policy_modes(crew, mode, status, assigned):
    crew.policy.self_join_mode = mode
    crew.policy.save()
    response = participate(crew, intent="join")
    assert response.status_code == status
    assert JobAssignment.objects.filter(membership=crew.worker.member).exists() == assigned
    if status == 201:
        result = assert_response(
            response, "/api/companies/{company_id}/jobs/{job_id}/participation", status=201
        )
        assert result["status"] == ("approved" if assigned else "pending")


def test_leave_approval_names_exact_assignment_and_does_not_end_replacement(crew):
    joined = participate(crew, intent="join").json()
    assert directory_person(crew)["jobs"] == [{"job_id": str(crew.job.pk), "name": "Rough-in"}]
    leave = participate(
        crew, intent="leave", assignment_id=joined["resulting_assignment_id"]
    ).json()
    assert JobAssignment.objects.get(pk=joined["resulting_assignment_id"]).ends_at is None
    # Assigning someone who is already on the job keeps their current assignment.
    crew.job.refresh_from_db()
    revision = crew.job.revision
    again = assign(crew, revision)
    assert again.status_code == 200 and again.json()["id"] == joined["resulting_assignment_id"]
    crew.job.refresh_from_db()
    assert crew.job.revision == revision
    replacement = replace_assignment(crew, joined["resulting_assignment_id"])
    decision = crew.manager.post(
        f"{crew.base}/job-participation-requests/{leave['id']}/approve",
        {"expected_revision": 1},
        content_type="application/json",
    )
    assert decision.status_code == 409
    assert JobAssignment.objects.get(pk=replacement["id"]).ends_at is None
    assert directory_person(crew)["jobs"] == [{"job_id": str(crew.job.pk), "name": "Rough-in"}]


def test_admin_assignment_bypasses_disabled_self_service_and_archive_preserves_history(crew):
    crew.policy.self_join_mode = "disabled"
    crew.policy.save()
    assigned = assign(crew, 1)
    assert_response(assigned, "/api/companies/{company_id}/jobs/{job_id}/assignments")
    crew.job.refresh_from_db()
    archived = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/update",
        {
            "expected_revision": crew.job.revision,
            "name": "Renamed job",
            "archived": True,
        },
        content_type="application/json",
    )
    assert_response(archived, "/api/companies/{company_id}/jobs/{job_id}/update")
    assert JobAssignment.objects.get(pk=assigned.json()["id"]).ends_at is not None
    assert directory_person(crew)["jobs"] == []
    assert crew.client.get(f"{crew.base}/directory?job_id={crew.job.pk}").json()["items"] == []
    assert str(crew.worker.member.pk) in {
        person["membership_id"]
        for person in crew.client.get(f"{crew.base}/directory?unassigned=true").json()["items"]
    }
    restored = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/update",
        {
            "expected_revision": archived.json()["revision"],
            "name": "Renamed job",
            "archived": False,
        },
        content_type="application/json",
    )
    assert restored.status_code == 200
    assert not JobAssignment.objects.filter(job=crew.job, ends_at__isnull=True).exists()
    assert directory_person(crew)["jobs"] == []


def test_worker_cannot_self_assign_or_change_policy(crew):
    assert (
        crew.client.post(
            f"{crew.base}/jobs/{crew.job.pk}/assignments",
            {
                "expected_revision": 1,
                "membership_id": str(crew.worker.member.pk),
                "reason": "self assign",
            },
            content_type="application/json",
        ).status_code
        == 403
    )
    assert (
        crew.client.post(
            f"{crew.base}/job-participation-policy",
            {"expected_revision": 1, "self_join_mode": "direct", "self_leave_mode": "direct"},
            content_type="application/json",
        ).status_code
        == 403
    )


def test_participation_retry_is_bound_to_payload_and_allows_multiple_jobs(crew):
    key = str(uuid4())
    body = {"request_key": key, "intent": "join"}
    path = f"{crew.base}/jobs/{crew.job.pk}/participation"
    first = crew.client.post(path, body, content_type="application/json")
    repeat = crew.client.post(path, body, content_type="application/json")
    assert first.status_code == 201 and repeat.status_code == 200
    assert first.json() == repeat.json()
    assert (
        crew.client.post(
            path, {**body, "reason": "different"}, content_type="application/json"
        ).status_code
        == 409
    )
    another = Job.objects.create(company=crew.company, name="Second job")
    crew.job = another
    assert participate(crew, intent="join").status_code == 201
    assert (
        JobAssignment.objects.filter(membership=crew.worker.member, ends_at__isnull=True).count()
        == 2
    )


@pytest.mark.parametrize(
    "mode,expected", [("direct", "approved"), ("approval_required", "pending"), ("disabled", None)]
)
def test_leave_policy_is_independent_from_join_policy(crew, mode, expected):
    joined = participate(crew, intent="join").json()
    crew.policy.self_join_mode = "disabled"
    crew.policy.self_leave_mode = mode
    crew.policy.save()
    result = participate(crew, intent="leave", assignment_id=joined["resulting_assignment_id"])
    assert result.status_code == (201 if expected else 403)
    if expected:
        assert result.json()["status"] == expected
    assignment = JobAssignment.objects.get(pk=joined["resulting_assignment_id"])
    assert (assignment.ends_at is not None) == (mode == "direct")


@pytest.mark.parametrize("role", ["admin", "manager", "foreman"])
def test_each_role_can_join_and_leave_jobs_itself(crew, password_hash, role):
    actor = member_in(crew.company, password_hash, role)
    client = login_client(actor.user)
    crew.policy.self_leave_mode = "direct"
    crew.policy.save()
    response = client.post(
        f"{crew.base}/jobs/{crew.job.pk}/participation",
        {"request_key": str(uuid4()), "intent": "join"},
        content_type="application/json",
    )
    assert response.status_code == 201
    joined = response.json()
    response = client.post(
        f"{crew.base}/jobs/{crew.job.pk}/participation",
        {
            "request_key": str(uuid4()),
            "intent": "leave",
            "assignment_id": joined["resulting_assignment_id"],
        },
        content_type="application/json",
    )
    assert response.status_code == 201 and response.json()["status"] == "approved"
    assert not JobAssignment.objects.filter(membership=actor.member, ends_at__isnull=True).exists()


def test_participation_projection_preserves_decision_and_names_when_subject_leaves(crew):
    crew.worker.person.preferred_name = "Former crew lead"
    crew.worker.person.save()
    crew.admin.person.preferred_name = "Project coordinator"
    crew.admin.person.save()
    joined = participate(crew, intent="join").json()
    leave = participate(
        crew, intent="leave", assignment_id=joined["resulting_assignment_id"]
    ).json()
    decision = crew.manager.post(
        f"{crew.base}/job-participation-requests/{leave['id']}/reject",
        {"expected_revision": 1, "note": "Complete the warehouse handover first"},
        content_type="application/json",
    )
    assert decision.status_code == 200
    assert decision.json()["decision_note"] == "Complete the warehouse handover first"
    ended = crew.manager.post(
        f"{crew.base}/people/{crew.worker.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "role": "foreman",
            "end_membership": True,
            "reason": "Employment ended",
        },
        content_type="application/json",
    )
    assert ended.status_code == 200
    history = crew.manager.get(f"{crew.base}/assignments?current=false").json()["items"][0]
    assert history["member_name"] == "Former crew lead"
    assert history["assigned_by_name"] == "Former crew lead"
    assert history["ended_by_name"] == "Project coordinator"
    assert history["end_reason"] == "Employment ended"
    requests = crew.manager.get(f"{crew.base}/job-participation-requests?pending=false").json()[
        "items"
    ]
    rejected = next(item for item in requests if item["id"] == leave["id"])
    assert rejected["member_name"] == "Former crew lead"
    assert rejected["job_name"] == "Rough-in"
    assert rejected["decided_by_name"] == "Project coordinator"
    assert rejected["decision_note"] == "Complete the warehouse handover first"


def test_pending_participation_exposes_the_same_stale_assignment_denial_as_approval(crew):
    joined = participate(crew, intent="join").json()
    leave = participate(
        crew, intent="leave", assignment_id=joined["resulting_assignment_id"]
    ).json()
    replacement = replace_assignment(crew, joined["resulting_assignment_id"])
    listed = crew.manager.get(f"{crew.base}/job-participation-requests").json()["items"][0]
    assert "no longer current" in listed["approval_blocked_reason"]
    rejected = crew.manager.post(
        f"{crew.base}/job-participation-requests/{leave['id']}/approve",
        {"expected_revision": 1},
        content_type="application/json",
    )
    assert rejected.status_code == 409 and rejected.json()["code"] == "stale_assignment"
    assert JobAssignment.objects.get(pk=replacement["id"]).ends_at is None
    assert directory_person(crew)["jobs"] == [{"job_id": str(crew.job.pk), "name": "Rough-in"}]


def test_offboarding_rejects_pending_join_with_a_durable_reason(crew):
    crew.policy.self_join_mode = "approval_required"
    crew.policy.save()
    pending = participate(crew, intent="join").json()
    result = crew.manager.post(
        f"{crew.base}/people/{crew.worker.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "role": "foreman",
            "end_membership": True,
            "reason": "Employment ended before joining",
        },
        content_type="application/json",
    )
    assert result.status_code == 200
    history = crew.manager.get(f"{crew.base}/job-participation-requests?pending=false").json()[
        "items"
    ]
    assert history[0]["id"] == pending["id"] and history[0]["status"] == "rejected"
    assert history[0]["decision_note"] == "Employment ended before joining"
    assert not JobAssignment.objects.filter(membership=crew.worker.member).exists()


def test_jobs_are_told_apart_by_name(crew):
    def post(path, body):
        return crew.manager.post(f"{crew.base}{path}", body, content_type="application/json")

    taken = post("/jobs", {"name": " ROUGH-in "})
    assert taken.status_code == 409 and taken.json()["code"] == "job_name_exists"
    panel = post("/jobs", {"name": "Panel swap"}).json()
    update = f"/jobs/{panel['id']}/update"
    renamed = post(update, {"expected_revision": panel["revision"], "name": "rough-in"})
    assert renamed.status_code == 409 and renamed.json()["code"] == "job_name_exists"
    kept = post(update, {"expected_revision": panel["revision"], "name": "Panel swap"})
    assert kept.status_code == 200 and "code" not in kept.json()
    names = [item["name"] for item in crew.manager.get(f"{crew.base}/jobs").json()["items"]]
    assert names == ["Panel swap", "Rough-in"]


def set_members(ctx, revision, people, note=""):
    return ctx.manager.post(
        f"{ctx.base}/jobs/{ctx.job.pk}/members",
        {
            "expected_revision": revision,
            "membership_ids": [str(person.member.pk) for person in people],
            "note": note,
        },
        content_type="application/json",
    )


def test_managers_set_everyone_on_a_job_in_one_save(crew, password_hash):
    second = member_in(crew.company, password_hash, name="Second foreman")
    third = member_in(crew.company, password_hash, name="Third foreman")
    added = assert_response(
        set_members(crew, 1, [crew.worker, second]),
        "/api/companies/{company_id}/jobs/{job_id}/members",
    )
    assert added["job"]["revision"] == 2
    assert {item["membership_id"] for item in added["assignments"]} == {
        str(crew.worker.member.pk),
        str(second.member.pk),
    }
    first_assignment = JobAssignment.objects.get(membership=crew.worker.member, ends_at=None)

    # One save adds and removes; whoever stays keeps the same assignment.
    swapped = set_members(crew, 2, [crew.worker, third], note="Crew swap").json()
    assert swapped["job"]["revision"] == 3
    assert {item["membership_id"] for item in swapped["assignments"]} == {
        str(crew.worker.member.pk),
        str(third.member.pk),
    }
    assert (
        JobAssignment.objects.get(membership=crew.worker.member, ends_at=None) == first_assignment
    )
    ended = JobAssignment.objects.get(membership=second.member)
    assert ended.ends_at is not None and ended.end_reason == "Crew swap"
    # Audit events are written by the background job that drains the outbox.
    run_pending_jobs(limit=100)
    events = PlatformAuditEventRecord.objects.filter(
        event_key__in=["work.assignment.created", "work.assignment.ended"]
    )
    assert sorted(events.values_list("event_key", flat=True)) == [
        "work.assignment.created",
        "work.assignment.created",
        "work.assignment.created",
        "work.assignment.ended",
    ]

    # A retry of a save that already landed succeeds without another revision.
    retried = set_members(crew, 2, [crew.worker, third], note="Crew swap")
    assert retried.status_code == 200 and retried.json()["job"]["revision"] == 3
    # A stale save that would still change something is refused as a whole.
    stale = set_members(crew, 2, [])
    assert stale.status_code == 409
    assert JobAssignment.objects.filter(job=crew.job, ends_at=None).count() == 2

    cleared = set_members(crew, 3, []).json()
    assert cleared["assignments"] == [] and cleared["job"]["revision"] == 4


def test_setting_job_members_is_for_managers_and_active_people_only(crew, password_hash):
    outsider_company = Company.objects.create(name="Other company")
    outsider = member_in(outsider_company, password_hash)
    refused = set_members(crew, 1, [crew.worker, outsider])
    assert refused.status_code == 404
    assert not JobAssignment.objects.filter(job=crew.job).exists()
    worker_attempt = crew.client.post(
        f"{crew.base}/jobs/{crew.job.pk}/members",
        {"expected_revision": 1, "membership_ids": [str(crew.worker.member.pk)]},
        content_type="application/json",
    )
    assert worker_attempt.status_code == 403
    crew.job.archived_at = timezone.now()
    crew.job.save()
    archived = set_members(crew, 1, [crew.worker])
    assert archived.status_code == 409 and archived.json()["code"] == "job_not_joinable"
