from smtplib import SMTPException
from urllib.parse import urlencode

from django.conf import settings
from django.core.mail import send_mail
from ninja.errors import HttpError


def app_url(path, **query):
    suffix = f"?{urlencode(query)}" if query else ""
    return f"{settings.PLATFORM_PUBLIC_BASE_URL.rstrip('/')}/{path.lstrip('/')}{suffix}"


def send_account_mail(email, subject, message):
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [email], fail_silently=False)
    except (OSError, SMTPException) as exc:
        raise HttpError(503, "Email delivery is unavailable. Please try again later.") from exc
