from unittest.mock import patch

import pytest
from django.db import OperationalError


@pytest.mark.django_db
def test_readiness_checks_the_real_database_without_a_session(client):
    response = client.get("/healthz")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response["Cache-Control"] == "no-store"
    assert client.post("/healthz").status_code == 405


def test_readiness_reports_database_failure_without_leaking_details(client):
    with patch("config.health.connection.cursor", side_effect=OperationalError("private-host")):
        response = client.get("/healthz")
    assert response.status_code == 503
    assert response.json() == {"status": "unavailable"}
