"""Immutable display context captured from the locked asset at command time."""


def asset_event_metadata(asset, **details):
    return {
        "asset_id": str(asset.pk),
        "asset_tag": asset.asset_tag,
        "warehouse_id": str(asset.responsible_warehouse_id),
        **details,
    }
