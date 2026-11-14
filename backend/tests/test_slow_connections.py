"""Responses stay small and revalidatable for crews on weak cellular signal."""

from io import BytesIO

import pytest
from django.core.files.storage import default_storage
from PIL import Image

from evidence.models import StoredFile
from tests.test_registration_and_evidence import payload, registration  # noqa: F401


def camera_photo(width=3000, height=2000):
    stream = BytesIO()
    Image.effect_noise((width, height), 64).convert("RGB").save(stream, format="JPEG", quality=95)
    from django.core.files.uploadedfile import SimpleUploadedFile

    return SimpleUploadedFile("camera.jpg", stream.getvalue(), content_type="image/jpeg")


def attached_photo(ctx):
    uploaded = ctx.manager.post(
        f"{ctx.base}/files", {"file": camera_photo(), "purpose": "registration"}
    ).json()
    created = ctx.manager.post(
        f"{ctx.base}/tools",
        payload(ctx, photo_id=uploaded["id"]),
        content_type="application/json",
    )
    assert created.status_code == 201
    return uploaded


def body(response):
    return b"".join(response.streaming_content)


def test_photo_renditions_are_small_webp_and_cached_privately(registration):  # noqa: F811
    ctx = registration
    uploaded = attached_photo(ctx)
    url = f"{ctx.base}/files/{uploaded['id']}"
    original = ctx.manager.get(url)
    assert original["Content-Type"] == "image/jpeg"
    original_bytes = body(original)
    for size, edge in {"thumb": 320, "display": 1280}.items():
        response = ctx.manager.get(url, {"size": size})
        assert response.status_code == 200
        assert response["Content-Type"] == "image/webp"
        assert response["Cache-Control"] == "private, max-age=31536000, immutable"
        content = body(response)
        assert len(content) < len(original_bytes)
        with Image.open(BytesIO(content)) as image:
            assert image.format == "WEBP"
            assert max(image.size) == edge
    record = StoredFile.objects.get(pk=uploaded["id"])
    assert default_storage.exists(f"{record.storage_key}.thumb.webp")
    # A second request reuses the stored rendition.
    again = ctx.manager.get(url, {"size": "thumb"})
    assert again["Content-Type"] == "image/webp"
    assert ctx.manager.get(url, {"size": "huge"}).status_code == 400


def test_staged_photos_are_neither_cached_nor_given_renditions(registration):  # noqa: F811
    ctx = registration
    staged = ctx.manager.post(
        f"{ctx.base}/files", {"file": camera_photo(400, 300), "purpose": "incident"}
    ).json()
    response = ctx.manager.get(f"{ctx.base}/files/{staged['id']}", {"size": "thumb"})
    assert response.status_code == 200
    assert response["Content-Type"] == "image/jpeg"
    assert "no-store" in response["Cache-Control"]
    record = StoredFile.objects.get(pk=staged["id"])
    assert not default_storage.exists(f"{record.storage_key}.thumb.webp")


def test_photo_renditions_still_require_membership(registration, world):  # noqa: F811
    ctx = registration
    uploaded = attached_photo(ctx)
    other = f"/api/companies/{world.other_company.pk}/files/{uploaded['id']}"
    assert ctx.manager.get(other, {"size": "thumb"}).status_code in {403, 404}


@pytest.mark.django_db
def test_unchanged_company_reads_revalidate_with_304(api_client, world):
    url = f"/api/companies/{world.company.pk}/tools"
    first = api_client.get(url)
    assert first.status_code == 200
    assert first["Cache-Control"] == "private, no-cache"
    assert "Cookie" in first["Vary"]
    etag = first["ETag"]
    unchanged = api_client.get(url, HTTP_IF_NONE_MATCH=etag)
    assert unchanged.status_code == 304
    assert unchanged.content == b""
    # nginx weakens ETags when it compresses; weak validators still match.
    assert api_client.get(url, HTTP_IF_NONE_MATCH=f"W/{etag}").status_code == 304
    world.assets[0].notes = "Changed"
    world.assets[0].save(update_fields=["notes"])
    changed = api_client.get(url, HTTP_IF_NONE_MATCH=etag)
    assert changed.status_code == 200
    assert changed["ETag"] != etag


@pytest.mark.django_db
def test_account_responses_and_writes_stay_uncacheable(api_client, world):
    assert api_client.get("/api/auth/csrf")["Cache-Control"] == "no-store"
    assert api_client.get("/api/me")["Cache-Control"] == "no-store"
    assert "ETag" not in api_client.get("/api/me")
    missing = api_client.get(f"/api/companies/{world.company.pk}/tools/{world.company.pk}")
    assert missing["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_sign_out_clears_the_browser_cache(api_client):
    response = api_client.post("/api/auth/sign-out")
    assert response.status_code == 200
    assert response["Clear-Site-Data"] == '"cache"'


@pytest.mark.django_db
def test_tool_lists_accept_large_pages(api_client, world):
    url = f"/api/companies/{world.company.pk}/tools"
    assert api_client.get(url, {"limit": 500}).status_code == 200
    assert api_client.get(url, {"limit": 501}).status_code == 400
