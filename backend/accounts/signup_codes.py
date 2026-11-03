"""Single-use company signup codes: issued from the command line, claimed by a verified account."""

import hashlib
import re
import secrets
from datetime import timedelta
from uuid import uuid4

from backend_platform.api import bad_request
from django.utils import timezone

from .models import SignupCode

# No 0/O, 1/I/L or U, so a code read aloud or retyped from paper survives.
ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789"


def code_digest(code):
    return hashlib.sha256(re.sub(r"[^A-Z0-9]", "", code.upper()).encode()).hexdigest()


def issue_codes(count, *, days, label=""):
    codes = []
    expires_at = timezone.now() + timedelta(days=days)
    for _ in range(count):
        raw = "".join(secrets.choice(ALPHABET) for _ in range(12))
        code = f"{raw[:4]}-{raw[4:8]}-{raw[8:]}"
        SignupCode.objects.create(
            id=uuid4(), code_digest=code_digest(code), label=label, expires_at=expires_at
        )
        codes.append(code)
    return codes


def available_code(code):
    """Lock an unclaimed, unexpired code, or explain why it cannot be used."""
    found = (
        SignupCode.objects.select_for_update()
        .filter(
            code_digest=code_digest(code),
            revoked_at__isnull=True,
            claimed_by__isnull=True,
            expires_at__gt=timezone.now(),
        )
        .first()
    )
    if found is None:
        raise bad_request(
            "This signup code is invalid, expired, or already used.", code="invalid_signup_code"
        )
    return found


def claimed_code(user_id):
    """The code this account claimed but has not yet used to set up a company."""
    return (
        SignupCode.objects.select_for_update()
        .filter(claimed_by_id=user_id, company__isnull=True, revoked_at__isnull=True)
        .order_by("claimed_at")
        .first()
    )


def claim(code, user_id, *, company_name="", logo=None):
    code.claimed_by_id = user_id
    code.claimed_at = timezone.now()
    code.company_name = company_name
    code.logo = logo
    code.save(update_fields=["claimed_by", "claimed_at", "company_name", "logo"])
    return code
