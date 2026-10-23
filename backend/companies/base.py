from uuid import uuid4

from django.db import models


class CompanyRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid4, editable=False)
    company = models.ForeignKey("companies.Company", on_delete=models.PROTECT)

    class Meta:
        abstract = True
        constraints = [
            models.UniqueConstraint(fields=["company", "id"], name="%(class)s_company_identity")
        ]
