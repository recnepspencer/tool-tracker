"""Optional information about a physical unit, independent of model and custody."""

from backend_platform.api import conflict

ASSET_DETAIL_FIELDS = (
    "serial_number",
    "acquisition_date",
    "acquisition_cost",
    "acquisition_currency",
    "notes",
)


def assign_asset_details(asset, data):
    for field, value in data.model_dump(
        include=set(ASSET_DETAIL_FIELDS), exclude_unset=True
    ).items():
        setattr(asset, field, value)
    if asset.acquisition_cost is None:
        asset.acquisition_currency = ""
    elif not asset.acquisition_currency:
        raise conflict(
            "Enter a currency with the purchase price.", code="acquisition_currency_required"
        )
