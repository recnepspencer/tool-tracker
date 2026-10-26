from types import SimpleNamespace
from uuid import uuid4

import pytest

from companies.models import Company
from tests.conftest import login_client
from tests.factories import member_in
from tests.http_contract import assert_response
from work.models import Job, JobAssignment, JobAssignmentPolicy, Project


@pytest.fixture
def crew(db, password_hash):
    company = Company.objects.create(name="Job-only tests")
    worker = member_in(company, password_hash)
    admin = member_in(company, password_hash, "company_admin")
    project = Project.objects.create(company=company, number="P1", name="Campus")
    job = Job.objects.create(company=company, project=project, number="J1", name="Rough-in")
    policy = JobAssignmentPolicy.objects.create(
        company=company, self_join_mode="direct", self_leave_mode="approval_required"
    )
    return SimpleNamespace(
        company=company,
        worker=worker,
        admin=admin,
        client=login_client(worker.user),
        manager=login_client(admin.user),
        project=project,
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
    leave = participate(
        crew, intent="leave", assignment_id=joined["resulting_assignment_id"]
    ).json()
    assert JobAssignment.objects.get(pk=joined["resulting_assignment_id"]).ends_at is None
    crew.job.refresh_from_db()
    replacement = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/assignments",
        {
            "expected_revision": crew.job.revision,
            "membership_id": str(crew.worker.member.pk),
            "responsibility": "foreman",
            "reason": "Promoted on this job",
        },
        content_type="application/json",
    )
    assert replacement.status_code == 200
    decision = crew.manager.post(
        f"{crew.base}/job-participation-requests/{leave['id']}/approve",
        {"expected_revision": 1},
        content_type="application/json",
    )
    assert decision.status_code == 409
    assert JobAssignment.objects.get(pk=replacement.json()["id"]).ends_at is None


def test_admin_assignment_bypasses_disabled_self_service_and_archive_preserves_history(crew):
    crew.policy.self_join_mode = "disabled"
    crew.policy.save()
    assigned = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/assignments",
        {
            "expected_revision": 1,
            "membership_id": str(crew.worker.member.pk),
            "responsibility": "crew",
            "reason": "Staff the job",
        },
        content_type="application/json",
    )
    assert_response(assigned, "/api/companies/{company_id}/jobs/{job_id}/assignments")
    crew.job.refresh_from_db()
    archived = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/update",
        {
            "expected_revision": crew.job.revision,
            "name": "Renamed job",
            "status": "active",
            "archived": True,
        },
        content_type="application/json",
    )
    assert_response(archived, "/api/companies/{company_id}/jobs/{job_id}/update")
    assert JobAssignment.objects.get(pk=assigned.json()["id"]).ends_at is not None
    restored = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/update",
        {
            "expected_revision": archived.json()["revision"],
            "name": "Renamed job",
            "status": "active",
            "archived": False,
        },
        content_type="application/json",
    )
    assert restored.status_code == 200
    assert not JobAssignment.objects.filter(job=crew.job, ends_at__isnull=True).exists()


def test_worker_cannot_self_promote_or_change_policy(crew):
    assert (
        crew.client.post(
            f"{crew.base}/jobs/{crew.job.pk}/assignments",
            {
                "expected_revision": 1,
                "membership_id": str(crew.worker.member.pk),
                "responsibility": "foreman",
                "reason": "self promote",
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
    assert participate(crew, intent="join", responsibility="foreman").status_code == 400


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
    another = Job.objects.create(
        company=crew.company, project=crew.project, number="J2", name="Same name is allowed"
    )
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


@pytest.mark.parametrize(
    "role", ["company_admin", "equipment_manager", "field_member", "dispatcher", "estimator"]
)
def test_each_role_self_participates_only_with_field_capability(crew, password_hash, role):
    actor = member_in(crew.company, password_hash, role)
    client = login_client(actor.user)
    allowed = role in {"company_admin", "equipment_manager", "field_member"}
    crew.policy.self_leave_mode = "direct"
    crew.policy.save()
    response = client.post(
        f"{crew.base}/jobs/{crew.job.pk}/participation",
        {"request_key": str(uuid4()), "intent": "join"},
        content_type="application/json",
    )
    assert response.status_code == (201 if allowed else 403)
    if allowed:
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
            "roles": ["field_member"],
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
    assert rejected["job_name"] == "Rough-in" and rejected["job_number"] == "J1"
    assert rejected["decided_by_name"] == "Project coordinator"
    assert rejected["decision_note"] == "Complete the warehouse handover first"


def test_pending_participation_exposes_the_same_stale_assignment_denial_as_approval(crew):
    joined = participate(crew, intent="join").json()
    leave = participate(
        crew, intent="leave", assignment_id=joined["resulting_assignment_id"]
    ).json()
    crew.job.refresh_from_db()
    replacement = crew.manager.post(
        f"{crew.base}/jobs/{crew.job.pk}/assignments",
        {
            "expected_revision": crew.job.revision,
            "membership_id": str(crew.worker.member.pk),
            "responsibility": "supervisor",
            "reason": "Changed responsibility",
        },
        content_type="application/json",
    ).json()
    listed = crew.manager.get(f"{crew.base}/job-participation-requests").json()["items"][0]
    assert "no longer current" in listed["approval_blocked_reason"]
    rejected = crew.manager.post(
        f"{crew.base}/job-participation-requests/{leave['id']}/approve",
        {"expected_revision": 1},
        content_type="application/json",
    )
    assert rejected.status_code == 409 and rejected.json()["code"] == "stale_assignment"
    assert JobAssignment.objects.get(pk=replacement["id"]).ends_at is None


def test_offboarding_rejects_pending_join_with_a_durable_reason(crew):
    crew.policy.self_join_mode = "approval_required"
    crew.policy.save()
    pending = participate(crew, intent="join").json()
    result = crew.manager.post(
        f"{crew.base}/people/{crew.worker.member.pk}/update",
        {
            "expected_revision": 1,
            "access_state": "disabled",
            "roles": ["field_member"],
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
