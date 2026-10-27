from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import AuthenticationWindow, SignupChallenge


class Command(BaseCommand):
    help = "Remove expired signup challenges and authentication rate windows. Run daily."

    def handle(self, *args, **options):
        now = timezone.now()
        SignupChallenge.objects.filter(expires_at__lt=now).delete()
        AuthenticationWindow.objects.filter(expires_at__lt=now).delete()
