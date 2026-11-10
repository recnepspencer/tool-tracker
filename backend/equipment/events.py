"""Immutable display context captured from the locked asset at command time."""


def asset_event_metadata(asset, **details):
    return {
        "asset_id": str(asset.pk),
        "tool_name": asset.tool_model.name,
        "warehouse_id": str(asset.responsible_warehouse_id),
        **details,
    }
