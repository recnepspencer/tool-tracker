from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AuthenticationWindow, SignupChallenge
from companies.logos import delete_expired_logos


class Command(BaseCommand):
    help = "Remove expired signup challenges, authentication rate windows, and unused logo uploads. Run daily."

    def handle(self, *args, **options):
        now = timezone.now()
        SignupChallenge.objects.filter(expires_at__lt=now).delete()
        AuthenticationWindow.objects.filter(expires_at__lt=now).delete()
        delete_expired_logos()
