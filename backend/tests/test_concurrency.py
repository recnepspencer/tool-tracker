from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, Event
from time import monotonic, sleep
from uuid import uuid4

import pytest
from backend_platform.models import PlatformJobRecord
from django.db import close_old_connections, connection, transaction
from django.test import Client
from django.utils import timezone
from test_tool_requests import post

from companies.models import CompanyMembership, Person
from equipment.models import CustodyPeriod, ToolAsset, ToolRequest


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("same_key", [True, False])
def test_concurrent_submissions_create_one_request(api_client, asset_url, same_key):
    keys = [uuid4(), uuid4()]
    if same_key:
        keys[1] = keys[0]
    barrier = Barrier(2)

    def submit(key):
        close_old_connections()
        try:
            client = Client(enforce_csrf_checks=True)
            client.cookies = api_client.cookies.copy()
            client.defaults.update(api_client.defaults)
            barrier.wait(timeout=10)
            return post(client, asset_url, key).status_code
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as executor:
        codes = list(executor.map(submit, keys))
    assert sorted(codes) == ([200, 201] if same_key else [201, 409])
    assert ToolRequest.objects.count() == 1
    assert PlatformJobRecord.objects.filter(name="platform.audit.record_event").count() == 1


@pytest.mark.django_db(transaction=True)
def test_waiting_request_rechecks_custody_after_asset_lock(api_client, asset_url, world):
    holder = CompanyMembership.objects.create(
        company=world.company, person=Person.objects.create(preferred_name="Receiving worker")
    )
    ready = Event()
    backend_pid = []

    def submit():
        close_old_connections()
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT pg_backend_pid()")
                backend_pid.append(cursor.fetchone()[0])
            ready.set()
            client = Client(enforce_csrf_checks=True)
            client.cookies = api_client.cookies.copy()
            client.defaults.update(api_client.defaults)
            return post(client, asset_url)
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=1) as executor:
        with transaction.atomic():
            asset = ToolAsset.objects.select_for_update().get(pk=world.assets[0].id)
            future = executor.submit(submit)
            assert ready.wait(10)
            deadline = monotonic() + 10
            while True:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT cardinality(pg_blocking_pids(%s))", [backend_pid[0]])
                    blocked = cursor.fetchone()[0] > 0
                if blocked:
                    break
                assert monotonic() < deadline, "Request never reached the locked asset"
                sleep(0.02)
            # The request is demonstrably waiting on the asset, not on a timer.
            boundary = timezone.now()
            CustodyPeriod.objects.filter(asset=asset, ends_at__isnull=True).update(ends_at=boundary)
            CustodyPeriod.objects.create(
                company=world.company, asset=asset, holder_membership=holder, starts_at=boundary
            )
        response = future.result(timeout=10)
    assert response.status_code == 409, response.content
    assert response.json()["code"] == "asset_not_at_warehouse"
    assert ToolRequest.objects.count() == 0
