"""Google and Microsoft sign-in (OpenID Connect authorization code flow with PKCE)."""

import base64
import hashlib
import json
import secrets
import time
from dataclasses import dataclass
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.conf import settings

from .mail import app_url

# Microsoft's tenant for personal accounts (Outlook.com, Hotmail, Live). Their email is the
# account's own sign-in address.
MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad"


class ProviderError(Exception):
    """The provider's answer could not be trusted; `code` tells the person what happened."""

    def __init__(self, code):
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Provider:
    name: str
    authorize_url: str
    token_url: str

    @property
    def client_id(self):
        return getattr(settings, f"{self.name.upper()}_CLIENT_ID")

    @property
    def client_secret(self):
        return getattr(settings, f"{self.name.upper()}_CLIENT_SECRET")

    @property
    def configured(self):
        return bool(self.client_id and self.client_secret)

    @property
    def redirect_uri(self):
        return app_url(f"api/auth/providers/{self.name}/callback")

    def authorize(self, *, state, nonce, verifier):
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest())
        query = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": "openid email profile",
            "state": state,
            "nonce": nonce,
            "code_challenge": challenge.rstrip(b"=").decode(),
            "code_challenge_method": "S256",
            "prompt": "select_account",
        }
        return f"{self.authorize_url}?{urlencode(query)}"

    def claims(self, *, code, verifier, nonce):
        """Exchange the code and return the ID token's claims once they check out."""
        body = urlencode(
            {
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": self.redirect_uri,
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "code_verifier": verifier,
            }
        ).encode()
        request = Request(self.token_url, data=body, headers={"accept": "application/json"})
        try:
            with urlopen(request, timeout=15) as response:
                token = json.load(response)["id_token"]
        except (OSError, ValueError, KeyError) as exc:
            raise ProviderError("failed") from exc
        # The token came straight from the provider over verified TLS, so its signature need
        # not be checked again (OpenID Connect Core 3.1.3.7); its contents still must be.
        try:
            payload = token.split(".")[1]
            claims = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        except (IndexError, ValueError) as exc:
            raise ProviderError("failed") from exc
        if (
            claims.get("aud") != self.client_id
            or claims.get("iss") not in self.issuers(claims)
            or claims.get("nonce") != nonce
            or not isinstance(claims.get("exp"), int | float)
            or claims["exp"] < time.time() - 60
            or not claims.get("sub")
        ):
            raise ProviderError("failed")
        return claims

    def issuers(self, claims):
        if self.name == "google":
            return {"https://accounts.google.com", "accounts.google.com"}
        return {f"https://login.microsoftonline.com/{claims.get('tid')}/v2.0"}

    def verified_email(self, claims):
        """The email address the provider vouches for, or "" when it does not."""
        email = str(claims.get("email") or "").strip().lower()
        if self.name == "google":
            verified = claims.get("email_verified") is True
        else:
            # A work or school tenant can put any address in `email`; trust it only when
            # Microsoft says the tenant owns that domain (the xms_edov optional claim).
            personal = claims.get("tid") == MICROSOFT_CONSUMER_TENANT
            verified = personal or claims.get("xms_edov") in (True, 1, "1", "true")
        return email if verified and "@" in email else ""


PROVIDERS = {
    "google": Provider(
        "google",
        "https://accounts.google.com/o/oauth2/v2/auth",
        "https://oauth2.googleapis.com/token",
    ),
    "microsoft": Provider(
        "microsoft",
        "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    ),
}


def configured_providers():
    return [name for name, provider in PROVIDERS.items() if provider.configured]


def new_attempt(provider):
    """Random values that tie the provider's answer to this browser session."""
    return {
        "provider": provider,
        "state": secrets.token_urlsafe(32),
        "nonce": secrets.token_urlsafe(32),
        "verifier": secrets.token_urlsafe(64),
    }
