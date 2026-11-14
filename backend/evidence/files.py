import hashlib
from datetime import timedelta
from io import BytesIO
from pathlib import Path
from uuid import uuid4

from backend_platform.api import conflict, forbidden, not_found
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from companies.access import require_member

from .models import StoredFile

MAX_BYTES = 8 * 1024 * 1024
# Field crews browse lists over weak cellular signal; lists and sheets request a
# downscaled WebP rendition instead of the camera original.
PHOTO_SIZES = {"thumb": 320, "display": 1280}


def upload_photo(identity, company_id, upload, purpose):
    member = require_member(identity, company_id, "files.upload")
    if purpose == "registration":
        # Purpose authorization belongs to equipment; bytes and file identity belong here.
        from equipment.registration import registration_allowed

        registration_allowed(member)
    if upload.size > MAX_BYTES:
        raise conflict("Photo exceeds 8 MiB.", code="file_too_large")
    content = upload.read(MAX_BYTES + 1)
    if len(content) > MAX_BYTES:
        raise conflict("Photo exceeds 8 MiB.", code="file_too_large")
    try:
        with Image.open(BytesIO(content)) as image:
            if (
                image.format not in {"JPEG", "PNG", "WEBP"}
                or image.width * image.height > 25_000_000
            ):
                raise ValueError("Unsupported image")
            content_type = Image.MIME[image.format]
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise conflict("Upload a valid JPEG, PNG, or WebP photo.", code="invalid_photo") from exc
    key = default_storage.save(f"{company_id}/{uuid4().hex}", ContentFile(content))
    try:
        return StoredFile.objects.create(
            company_id=company_id,
            storage_key=key,
            original_name=Path(upload.name.replace("\\", "/")).name[:200],
            content_type=content_type,
            byte_count=len(content),
            sha256=hashlib.sha256(content).hexdigest(),
            purpose=purpose,
            uploaded_by=member,
            expires_at=timezone.now() + timedelta(hours=24),
        )
    except Exception:
        default_storage.delete(key)
        raise


def claim_file(member, file_id, purpose):
    record = (
        StoredFile.objects.select_for_update()
        .filter(pk=file_id, company_id=member.company_id, uploaded_by=member, purpose=purpose)
        .first()
    )
    if record is None:
        raise not_found("Staged photo not found.")
    if record.attached_at is not None or record.expires_at <= timezone.now():
        raise conflict("Photo has expired or was already attached.", code="photo_not_staged")
    record.attached_at = timezone.now()
    record.save(update_fields=["attached_at"])
    return record


def read_file(identity, company_id, file_id, size="original"):
    member = require_member(identity, company_id, "tools.read")
    record = StoredFile.objects.filter(company_id=company_id, pk=file_id).first()
    if record is None:
        raise not_found("Photo not found.")
    if record.attached_at is None and record.uploaded_by_id != member.pk:
        raise forbidden("Staged photos are private to their uploader.")
    if record.attached_at is None and record.expires_at <= timezone.now():
        raise not_found("Photo expired.")
    # Staged photos may still be removed by cleanup, so only attached evidence
    # keeps stored renditions; staged previews return the original.
    if size in PHOTO_SIZES and record.attached_at is not None:
        key = rendition(record, size)
        if key:
            return record, "image/webp", default_storage.open(key, "rb")
    return record, record.content_type, default_storage.open(record.storage_key, "rb")


def rendition(record, size):
    """Return the storage key of a downscaled WebP copy, creating it on first request."""
    key = f"{record.storage_key}.{size}.webp"
    if default_storage.exists(key):
        return key
    edge = PHOTO_SIZES[size]
    try:
        with default_storage.open(record.storage_key, "rb") as source, Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            image.thumbnail((edge, edge))
            if image.mode not in {"RGB", "RGBA"}:
                image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
            output = BytesIO()
            image.save(output, format="WEBP", quality=78, method=4)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return None
    saved = default_storage.save(key, ContentFile(output.getvalue()))
    if saved != key:
        # A concurrent request stored the same rendition first.
        default_storage.delete(saved)
    return key
