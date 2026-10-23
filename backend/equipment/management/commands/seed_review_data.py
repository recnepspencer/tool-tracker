import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from review_seed.scenarios import seed_review_scenarios


class Command(BaseCommand):
    help = "Create coherent, repeatable local review scenarios without resetting existing state."

    def handle(self, *args, **options):
        password = os.getenv("NELSON_REVIEW_PASSWORD")
        if not settings.DEBUG or not password:
            raise CommandError("Requires DEBUG=1 and NELSON_REVIEW_PASSWORD; local review only.")
        result = seed_review_scenarios(password)
        self.stdout.write(f"Company: {result['company'].pk}")
        for tag, asset in result["assets"].items():
            self.stdout.write(f"{tag}: {asset.pk}")
        self.stdout.write(
            "Profiles: " + ", ".join(f"{key}@example.com" for key in result["members"])
        )
        self.stdout.write(
            "New accounts use NELSON_REVIEW_PASSWORD. Existing passwords and business state are preserved."
        )
