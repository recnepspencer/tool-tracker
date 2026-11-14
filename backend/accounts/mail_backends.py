"""Brevo's HTTPS email API, for hosts that block outbound SMTP ports (DigitalOcean Droplets do)."""

import json
from email.utils import parseaddr
from urllib.request import Request, urlopen

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as SmtpBackend

BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"
# Addresses that can never belong to a real mailbox (RFC 2606). Browser checks and seeded
# review data use them; sending them to Brevo would only collect bounces against the account.
RESERVED_DOMAINS = {"example.com", "example.net", "example.org", "localhost"}
RESERVED_SUFFIXES = (".test", ".example", ".invalid", ".localhost")


def reserved(address):
    domain = parseaddr(address)[1].rpartition("@")[2].lower()
    return domain in RESERVED_DOMAINS or domain.endswith(RESERVED_SUFFIXES)


def brevo_payload(message):
    sender_name, sender_email = parseaddr(message.from_email)
    payload = {
        "sender": {"email": sender_email, **({"name": sender_name} if sender_name else {})},
        "to": [{"email": parseaddr(address)[1]} for address in message.to],
        "subject": message.subject,
        "textContent": message.body,
    }
    if message.cc:
        payload["cc"] = [{"email": parseaddr(address)[1]} for address in message.cc]
    if message.bcc:
        payload["bcc"] = [{"email": parseaddr(address)[1]} for address in message.bcc]
    if message.reply_to:
        payload["replyTo"] = {"email": parseaddr(message.reply_to[0])[1]}
    html = next(
        (body for body, kind in getattr(message, "alternatives", []) if kind == "text/html"), None
    )
    if html:
        payload["htmlContent"] = html
    return payload


class BrevoEmailBackend(BaseEmailBackend):
    """Sends through Brevo; mail for reserved test domains goes to the SMTP relay (Mailpit) instead."""

    def send_messages(self, email_messages):
        sent = 0
        relayed = []
        for message in email_messages:
            recipients = message.recipients()
            if not recipients:
                continue
            if all(reserved(address) for address in recipients):
                relayed.append(message)
                continue
            try:
                self.deliver(message)
            except OSError:
                if not self.fail_silently:
                    raise
            else:
                sent += 1
        if relayed:
            sent += SmtpBackend(fail_silently=self.fail_silently).send_messages(relayed) or 0
        return sent

    def deliver(self, message):
        request = Request(
            BREVO_SEND_URL,
            data=json.dumps(brevo_payload(message)).encode(),
            headers={
                "api-key": settings.BREVO_API_KEY,
                "accept": "application/json",
                "content-type": "application/json",
            },
            method="POST",
        )
        # urllib raises HTTPError (an OSError) for Brevo's 4xx and 5xx answers.
        with urlopen(request, timeout=settings.EMAIL_TIMEOUT) as response:
            response.read()
