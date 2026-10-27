from backend_platform.api import conflict


def expect_revision(record, expected):
    if record.revision != expected:
        raise conflict(
            "The record changed. Refresh before retrying.",
            code="stale_revision",
            detail={"revision": record.revision},
        )
