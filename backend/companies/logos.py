"""Company logo bytes: validated raster images that stay pending until a company adopts them."""

from datetime import timedelta
from io import BytesIO
from uuid import uuid4

from backend_platform.api import conflict, not_found
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db.models import Q
from django.utils import timezone
from PIL import Image, UnidentifiedImageError

from .models import CompanyLogo, CompanyMembership

MAX_LOGO_BYTES = 2 * 1024 * 1024
PENDING_LOGO_LIFETIME = timedelta(days=2)


def store_logo(upload, uploaded_by_id):
    # Raster formats only: an uploaded SVG could carry script into every page showing it.
    content = upload.read(MAX_LOGO_BYTES + 1)
    if len(content) > MAX_LOGO_BYTES:
        raise conflict("Logo exceeds 2 MiB.", code="logo_too_large")
    try:
        with Image.open(BytesIO(content)) as image:
            if (
                image.format not in {"JPEG", "PNG", "WEBP"}
                or image.width * image.height > 16_000_000
            ):
                raise ValueError("Unsupported image")
            content_type = Image.MIME[image.format]
            image.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as exc:
        raise conflict("Upload a JPEG, PNG, or WebP logo.", code="invalid_logo") from exc
    key = default_storage.save(f"logos/{uuid4().hex}", ContentFile(content))
    try:
        return CompanyLogo.objects.create(
            storage_key=key,
            content_type=content_type,
            byte_count=len(content),
            uploaded_by_id=uploaded_by_id,
            expires_at=timezone.now() + PENDING_LOGO_LIFETIME,
        )
    except Exception:
        default_storage.delete(key)
        raise


def pending_logo(logo_id, uploaded_by_id):
    """A logo still waiting to be adopted, uploaded by this account (None for signup forms)."""
    logo = (
        CompanyLogo.objects.select_for_update()
        .filter(pk=logo_id, uploaded_by_id=uploaded_by_id, expires_at__gt=timezone.now())
        .first()
    )
    if logo is None:
        raise conflict(
            "This logo upload has expired. Upload the logo again.", code="logo_unavailable"
        )
    return logo


def adopt(logo):
    logo.expires_at = None
    logo.save(update_fields=["expires_at"])
    return logo


def release(logo):
    """Let cleanup remove a logo nothing needs any more."""
    if logo is not None:
        logo.expires_at = timezone.now()
        logo.save(update_fields=["expires_at"])


def read_logo(user_id, logo_id):
    from accounts.models import SignupCode

    logo = CompanyLogo.objects.filter(pk=logo_id).first()
    readable = (
        logo is not None
        and user_id is not None
        and (
            logo.uploaded_by_id == user_id
            or SignupCode.objects.filter(logo=logo, claimed_by_id=user_id).exists()
            or CompanyMembership.objects.filter(
                Q(company__logo=logo),
                person__identity_user_id=user_id,
                access_state="active",
                ended_at__isnull=True,
            ).exists()
        )
    )
    if not readable:
        raise not_found("Logo not found.")
    return logo, default_storage.open(logo.storage_key, "rb")


def delete_expired_logos():
    expired = list(CompanyLogo.objects.filter(expires_at__lt=timezone.now()))
    for logo in expired:
        default_storage.delete(logo.storage_key)
        logo.delete()
    return len(expired)
