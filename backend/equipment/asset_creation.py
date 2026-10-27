"""Internal persistence operation; registration authorization belongs to its caller."""

from django.db import transaction
from django.utils import timezone

from equipment.models import CustodyPeriod, ToolAsset


@transaction.atomic
def create_asset_at_warehouse(*, company, tool_model, asset_tag, warehouse, registered_by):
    """Commit both initial records or neither; never repair existing custody implicitly."""
    asset = ToolAsset.objects.create(
        company=company,
        tool_model=tool_model,
        asset_tag=asset_tag,
        origin_warehouse=warehouse,
        responsible_warehouse=warehouse,
        registered_by=registered_by,
    )
    CustodyPeriod.objects.create(
        company=company, asset=asset, holder_warehouse=warehouse, starts_at=timezone.now()
    )
    return asset
