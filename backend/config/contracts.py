from ninja import Schema
from pydantic import ConfigDict, Field


class CommandInput(Schema):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RevisionInput(CommandInput):
    expected_revision: int = Field(ge=1)


class PageInput(Schema):
    limit: int = Field(default=50, ge=1, le=100)
    offset: int = Field(default=0, ge=0)


def paginate(query, limit, offset, project=lambda row: row):
    rows = list(query[offset : offset + limit + 1])
    return {
        "items": [project(row) for row in rows[:limit]],
        "next_offset": offset + limit if len(rows) > limit else None,
    }
