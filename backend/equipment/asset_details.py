"""Optional information about a physical unit, independent of model and custody."""

ASSET_DETAIL_FIELDS = (
    "serial_number",
    "acquisition_date",
    "acquisition_cost",
    "notes",
)


def assign_asset_details(asset, data):
    for field, value in data.model_dump(
        include=set(ASSET_DETAIL_FIELDS), exclude_unset=True
    ).items():
        setattr(asset, field, value)
