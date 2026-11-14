"""Shared database throttling and credential revocation for browser sessions."""

import hashlib
import json
from datetime import timedelta

from cleanforce_identity.models import PlatformUser
from cleanforce_identity.users.facade import current_actor_identity
from django.conf import settings
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.utils.cache import get_conditional_response, patch_vary_headers, set_response_etag

from .models import AuthenticationWindow


class BrowserSecurityMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith("/api/"):
            return self.get_response(request)
        credentials = request.session.get("nelson_credentials")
        if credentials:
            valid = PlatformUser.objects.filter(
                pk=credentials[0], password_reset_version=credentials[1], is_active=True
            ).exists()
            if not valid:
                request.session.flush()
        if (
            request.method == "POST"
            and request.path.startswith("/api/auth/")
            and request.path not in {"/api/auth/sign-out", "/api/auth/logout"}
        ):
            # Only an explicitly trusted ingress may supply the real client address.
            now = timezone.now()
            bucket = int(now.timestamp()) // 900
            address = request.META.get("REMOTE_ADDR", "")
            if address in settings.NELSON_TRUSTED_PROXY_IPS:
                address = request.META.get("HTTP_X_REAL_IP", address)
            key = hashlib.sha256(f"{address}:{bucket}".encode()).hexdigest()
            with transaction.atomic():
                window, _ = AuthenticationWindow.objects.select_for_update().get_or_create(
                    key=key, defaults={"expires_at": now + timedelta(minutes=15)}
                )
                window.attempts += 1
                window.save(update_fields=["attempts"])
                denied = window.attempts > 100
            if denied:
                return JsonResponse(
                    {"message": "Too many account requests. Try again in 15 minutes."},
                    status=429,
                    headers={"Retry-After": "900", "Cache-Control": "no-store"},
                )
            # The pinned platform exposes its own legacy recovery route as well.
            # Apply the application's password policy there, too.
            if request.path == "/api/auth/password-reset-complete":
                try:
                    body = json.loads(request.body)
                    if isinstance(body, dict) and isinstance(body.get("password"), str):
                        validate_password(body["password"])
                except ValidationError as exc:
                    return JsonResponse({"message": " ".join(exc.messages)}, status=400)
                except (ValueError, UnicodeError):
                    pass  # The declared endpoint owns malformed-input errors.
        response = self.get_response(request)
        if (
            request.method == "POST"
            and request.path
            in {
                "/api/auth/password-login",
                "/api/auth/sign-in",
                "/api/auth/verify-signup",
                "/api/auth/invitation-signup",
                "/api/auth/change-password",
            }
            and response.status_code < 400
        ):
            identity = current_actor_identity(request)
            user = PlatformUser.objects.get(pk=identity.user_id)
            request.session["nelson_credentials"] = [str(user.pk), str(user.password_reset_version)]
        if (
            request.method == "POST"
            and response.status_code < 400
            and request.path in SESSION_CHANGES
        ):
            # Drop private HTTP-cached records and photos from a shared device.
            response["Clear-Site-Data"] = '"cache"'
        response["Referrer-Policy"] = "no-referrer"
        return cache_policy(request, response)


# Signing in or out changes whose private data this browser may hold.
SESSION_CHANGES = {
    "/api/auth/password-login",
    "/api/auth/sign-in",
    "/api/auth/verify-signup",
    "/api/auth/invitation-signup",
    "/api/auth/sign-out",
    "/api/auth/logout",
}


def cache_policy(request, response):
    """Let weak connections revalidate company reads instead of downloading them again.

    Successful company reads are stored privately and always revalidated: an
    unchanged list answers 304 with no body. Account endpoints and every other
    response stay uncacheable. Immutable attached photos keep their own policy.
    """
    if response.get("Cache-Control", "").startswith("private, max-age"):
        return response
    if (
        request.method in {"GET", "HEAD"}
        and response.status_code == 200
        and not response.streaming
        and request.path.startswith("/api/companies/")
    ):
        response["Cache-Control"] = "private, no-cache"
        patch_vary_headers(response, ("Cookie",))
        set_response_etag(response)
        return get_conditional_response(request, etag=response["ETag"], response=response)
    response["Cache-Control"] = "no-store"
    return response
