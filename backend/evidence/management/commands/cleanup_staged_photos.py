from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from evidence.models import StoredFile


class Command(BaseCommand):
    help = "Delete expired, unattached photos; preserve all attached evidence."

    def handle(self, *args, **options):
        count = 0
        ids = StoredFile.objects.filter(
            attached_at__isnull=True, expires_at__lte=timezone.now()
        ).values_list("id", flat=True)
        for pk in ids.iterator(chunk_size=100):
            with transaction.atomic():
                record = (
                    StoredFile.objects.select_for_update()
                    .filter(pk=pk, attached_at__isnull=True, expires_at__lte=timezone.now())
                    .first()
                )
                if record:
                    default_storage.delete(record.storage_key)
                    record.delete()
                    count += 1
        self.stdout.write(f"Removed {count} expired staged photos.")
