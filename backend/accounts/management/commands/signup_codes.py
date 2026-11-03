from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import SignupCode
from accounts.signup_codes import code_digest, issue_codes


class Command(BaseCommand):
    help = "Create, list, or revoke the single-use codes that let someone sign up a new company."

    def add_arguments(self, parser):
        actions = parser.add_subparsers(dest="action", required=True)
        create = actions.add_parser("create", help="Print new codes, one per line.")
        create.add_argument("--count", type=int, default=1)
        create.add_argument(
            "--days", type=int, default=30, help="Days until an unused code expires."
        )
        create.add_argument("--label", default="", help="A note to recognise the codes by later.")
        actions.add_parser("list", help="Show issued codes and whether each was used.")
        revoke = actions.add_parser("revoke", help="Stop an unused code from working.")
        revoke.add_argument("code")

    def handle(self, *args, action, **options):
        if action == "create":
            if not 1 <= options["count"] <= 500 or not 1 <= options["days"] <= 365:
                raise CommandError("Use --count from 1 to 500 and --days from 1 to 365.")
            # Codes are stored only as digests, so this is the one time they can be read.
            for code in issue_codes(options["count"], days=options["days"], label=options["label"]):
                self.stdout.write(code)
        elif action == "list":
            now = timezone.now()
            for code in SignupCode.objects.select_related("company").order_by("-created_at"):
                if code.company:
                    state = f"used by {code.company.name}"
                elif code.claimed_by_id:
                    state = "claimed, company not set up yet"
                elif code.revoked_at:
                    state = "revoked"
                elif code.expires_at <= now:
                    state = "expired"
                else:
                    state = f"unused until {code.expires_at:%Y-%m-%d}"
                self.stdout.write(f"{code.created_at:%Y-%m-%d}  {code.label or '-'}  {state}")
        else:
            updated = SignupCode.objects.filter(
                code_digest=code_digest(options["code"]),
                claimed_by__isnull=True,
                revoked_at__isnull=True,
            ).update(revoked_at=timezone.now())
            if not updated:
                raise CommandError("No unused code matches.")
            self.stdout.write("Revoked.")
