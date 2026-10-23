"""Consumer assertions read the checked contract, never implementation schemas."""

import json
from functools import lru_cache
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


@lru_cache
def contract():
    return json.loads(
        (Path(__file__).resolve().parents[1] / "contracts/openapi.json").read_text(encoding="utf-8")
    )


def assert_response(response, path, method="post", status=200):
    assert response.status_code == status, response.content
    document = contract()
    schema = document["paths"][path][method]["responses"][str(status)]["content"][
        "application/json"
    ]["schema"]
    body = response.json()
    Draft202012Validator(
        {**schema, "components": document["components"]}, format_checker=FormatChecker()
    ).validate(body)
    return body
