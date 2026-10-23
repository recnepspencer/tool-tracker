from datetime import timedelta
from uuid import uuid4

import pytest
from django.db import IntegrityError, transaction
from django.utils import timezone

from equipment.asset_creation import create_asset_at_warehouse
from equipment.models import CustodyPeriod, ToolAsset, ToolRequest, Warehouse


def constraint_name(error):
    return error.value.__cause__.diag.constraint_name


def test_asset_cannot_reference_another_company_warehouse(world):
    foreign = Warehouse.objects.create(company=world.other_company, code="OTHER", name="Other")
    with pytest.raises(IntegrityError) as error, transaction.atomic():
        ToolAsset.objects.filter(pk=world.assets[0].id).update(responsible_warehouse=foreign)
    assert constraint_name(error) == "asset_warehouse_company"


def test_request_source_must_belong_to_the_same_asset(world):
    source = CustodyPeriod.objects.get(asset=world.assets[1])
    with pytest.raises(IntegrityError) as error, transaction.atomic():
        ToolRequest.objects.create(
            company=world.company,
            requester=world.member,
            asset=world.assets[0],
            source_custody=source,
            request_key=uuid4(),
        )
    assert constraint_name(error) == "request_source_same_asset"


def test_custody_requires_exactly_one_holder(world):
    with pytest.raises(IntegrityError) as error, transaction.atomic():
        CustodyPeriod.objects.filter(asset=world.assets[0]).update(holder_membership=world.member)
    assert constraint_name(error) == "custody_exactly_one_holder"


def test_closed_custody_periods_cannot_overlap_current_custody(world):
    with pytest.raises(IntegrityError) as error, transaction.atomic():
        CustodyPeriod.objects.create(
            company=world.company,
            asset=world.assets[0],
            holder_warehouse=world.warehouse,
            starts_at=timezone.now() - timedelta(minutes=30),
            ends_at=timezone.now(),
        )
    assert constraint_name(error) == "custody_no_overlapping_intervals"


@pytest.mark.django_db(transaction=True)
def test_asset_creation_rolls_back_if_initial_custody_fails(world, monkeypatch):
    def fail_custody(*args, **kwargs):
        raise IntegrityError("initial custody failed")

    monkeypatch.setattr(CustodyPeriod.objects, "create", fail_custody)
    with pytest.raises(IntegrityError, match="initial custody failed"):
        create_asset_at_warehouse(
            company=world.company,
            tool_model=world.model,
            asset_tag="ORPHAN",
            warehouse=world.warehouse,
            registered_by=world.member,
        )
    assert not ToolAsset.objects.filter(asset_tag="ORPHAN").exists()


@pytest.mark.django_db(transaction=True)
def test_custody_change_is_atomic_and_preserves_history(world):
    asset = world.assets[0]
    previous = CustodyPeriod.objects.get(asset=asset)
    boundary = timezone.now()
    with transaction.atomic():
        previous.ends_at = boundary
        previous.save(update_fields=["ends_at"])
        current = CustodyPeriod.objects.create(
            company=world.company, asset=asset, holder_membership=world.member, starts_at=boundary
        )
    assert CustodyPeriod.objects.filter(asset=asset).count() == 2
    assert CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True).pk == current.pk
