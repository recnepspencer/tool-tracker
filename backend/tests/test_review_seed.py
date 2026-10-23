from io import StringIO

import pytest
from cleanforce_identity.models import PlatformUser
from django.core.management import call_command
from django.core.management.base import CommandError
from django.utils import timezone

from companies.models import CompanyMembership, CompanyRoleGrant
from equipment.models import (
    AssetIncident,
    CustodyHandoff,
    CustodyPeriod,
    ToolAsset,
    ToolRegistrationPolicy,
    ToolRequest,
)
from review_seed.scenarios import seed_review_scenarios
from tests.conftest import PASSWORD, login_client
from work.models import JobAssignment, JobAssignmentPolicy, JobParticipationRequest

pytestmark = pytest.mark.django_db


def test_seed_scenarios_are_coherent_and_reruns_preserve_user_changes():
    result = seed_review_scenarios(PASSWORD)
    assets, members = result["assets"], result["members"]
    assert assets["NE-001"].pk != assets["NE-002"].pk
    assert assets["NE-001"].tool_model_id == assets["NE-002"].tool_model_id
    assert set(
        AssetIncident.objects.filter(asset=assets["NE-005"]).values_list("kind", flat=True)
    ) == {"missing", "damage"}
    assert (
        CustodyPeriod.objects.get(asset=assets["NE-005"], ends_at__isnull=True).holder_membership
        == members["reviewer"]
    )
    for handoff in CustodyHandoff.objects.filter(status="pending"):
        assert handoff.source_custody.asset_id == handoff.asset_id
        assert handoff.source_custody.ends_at is None
    assert ToolRequest.objects.get(asset=assets["NE-010"]).status == "approved"
    assert CustodyPeriod.objects.get(asset=assets["NE-010"]).holder_warehouse is not None
    assert (
        JobAssignment.objects.filter(membership=members["reviewer"], ends_at__isnull=True).count()
        == 2
    )
    assert JobParticipationRequest.objects.get(status="pending").intent == "leave"
    assert CompanyMembership.objects.filter(access_state="suspended").count() == 1
    client = login_client(members["apprentice"].person.identity_user)
    handoff = CustodyHandoff.objects.get(asset=assets["NE-006"])
    assert (
        client.post(
            f"/api/companies/{result['company'].pk}/handoffs/{handoff.pk}/decline",
            {"expected_revision": 1},
            content_type="application/json",
        ).status_code
        == 200
    )
    assets["NE-002"].serial_number = "USER-EDITED"
    assets["NE-002"].save()
    ToolRegistrationPolicy.objects.update(employee_tool_creation_enabled=False)
    JobAssignmentPolicy.objects.update(self_join_mode="disabled")
    CompanyRoleGrant.objects.filter(membership=members["manager"]).update(revoked_at=timezone.now())
    models = [
        ToolAsset,
        CustodyPeriod,
        CustodyHandoff,
        ToolRequest,
        AssetIncident,
        CompanyMembership,
        CompanyRoleGrant,
        JobAssignment,
        JobParticipationRequest,
        ToolRegistrationPolicy,
        JobAssignmentPolicy,
        PlatformUser,
    ]
    before = {model: list(model.objects.order_by("pk").values()) for model in models}
    repeated = seed_review_scenarios("must-not-reset-existing-passwords")
    assert repeated["company"].pk == result["company"].pk
    assert {model: list(model.objects.order_by("pk").values()) for model in models} == before
    call_command("check_database_schema", stdout=StringIO())


def test_seed_command_is_explicitly_local_only(settings, monkeypatch):
    monkeypatch.setenv("NELSON_REVIEW_PASSWORD", "test")
    settings.DEBUG = False
    with pytest.raises(CommandError, match="local review only"):
        call_command("seed_review_data")
    settings.DEBUG = True
    monkeypatch.delenv("NELSON_REVIEW_PASSWORD")
    with pytest.raises(CommandError):
        call_command("seed_review_data")
    assert not ToolAsset.objects.exists()
