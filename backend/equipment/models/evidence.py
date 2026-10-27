from django.db import models

from companies.base import CompanyRecord
from companies.constraints import ScopedForeignKey


class IncidentAttachment(CompanyRecord):
    incident = models.ForeignKey("equipment.AssetIncident", on_delete=models.PROTECT)
    file = models.OneToOneField("evidence.StoredFile", on_delete=models.PROTECT)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="incident", name="incident_attachment_company"),
            ScopedForeignKey(field="file", name="incident_file_company"),
        ]


class HandoffAttachment(CompanyRecord):
    handoff = models.ForeignKey("equipment.CustodyHandoff", on_delete=models.PROTECT)
    file = models.OneToOneField("evidence.StoredFile", on_delete=models.PROTECT)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="handoff", name="handoff_attachment_company"),
            ScopedForeignKey(field="file", name="handoff_file_company"),
        ]


class ReconciliationAttachment(CompanyRecord):
    case = models.ForeignKey("equipment.ReconciliationCase", on_delete=models.PROTECT)
    file = models.OneToOneField("evidence.StoredFile", on_delete=models.PROTECT)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="case", name="reconciliation_attachment_company"),
            ScopedForeignKey(field="file", name="reconciliation_file_company"),
        ]


class ServiceEventAttachment(CompanyRecord):
    event = models.ForeignKey("equipment.AssetServiceEvent", on_delete=models.PROTECT)
    file = models.OneToOneField("evidence.StoredFile", on_delete=models.PROTECT)

    class Meta(CompanyRecord.Meta):
        constraints = [
            *CompanyRecord.Meta.constraints,
            ScopedForeignKey(field="event", name="service_attachment_company"),
            ScopedForeignKey(field="file", name="service_file_company"),
        ]
