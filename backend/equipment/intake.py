"""Temporary field inventory collection; submissions never create catalog entries."""

import hashlib
import json

from backend_platform.api import bad_request, conflict, forbidden, not_found
from django.db import transaction
from django.utils import timezone

from companies.access import authorize_write, capabilities, require_member
from companies.audit import record_company_event
from companies.revisions import expect_revision
from evidence.files import claim_file

from .models import CustodyPeriod, EquipmentSubmission, ToolAsset, ToolModel
from .registration import register_asset, registration_allowed


def submissions(identity, company_id):
    actor = require_member(identity, company_id, "tools.read")
    query = EquipmentSubmission.objects.filter(company_id=company_id).select_related(
        "reporter__person"
    )
    if "tools.manage" not in capabilities(actor):
        query = query.filter(reporter=actor)
    return query.order_by("-submitted_at", "id")


@transaction.atomic
def submit(identity, company_id, data):
    actor = authorize_write(identity, company_id, "tools.register")
    fingerprint = hashlib.sha256(
        json.dumps(data.model_dump(mode="json", exclude={"request_key"}), sort_keys=True).encode()
    ).hexdigest()
    previous = EquipmentSubmission.objects.filter(
        reporter=actor, request_key=data.request_key
    ).first()
    if previous:
        if previous.fingerprint != fingerprint:
            raise conflict(
                "Submission key was used for different input.", code="request_key_reused"
            )
        return previous
    registration_allowed(actor, lock=True)
    if (
        data.suggested_type_id
        and not ToolModel.objects.filter(
            pk=data.suggested_type_id,
            company_id=company_id,
            archived_at__isnull=True,
            category__archived_at__isnull=True,
        ).exists()
    ):
        raise not_found("Active equipment type not found.")
    if not data.in_my_possession and not data.location:
        raise bad_request("Tell your manager where the equipment is.")
    photo = claim_file(actor, data.photo_id, "registration") if data.photo_id else None
    report = EquipmentSubmission.objects.create(
        company_id=company_id,
        reporter=actor,
        fingerprint=fingerprint,
        description=data.description,
        location=data.location,
        in_my_possession=data.in_my_possession,
        notes=data.notes,
        suggested_type_id=data.suggested_type_id,
        photo=photo,
        request_key=data.request_key,
    )
    record_company_event(identity, company_id, "equipment.submission.created", report)
    return report


def message(report, actor, text):
    report.discussion = [
        *report.discussion,
        {"author": actor.person.preferred_name, "text": text, "at": timezone.now().isoformat()},
    ]


@transaction.atomic
def reply(identity, company_id, report_id, data):
    actor = authorize_write(identity, company_id, "tools.read")
    report = (
        EquipmentSubmission.objects.select_for_update()
        .filter(pk=report_id, company_id=company_id, reporter=actor)
        .first()
    )
    if report is None:
        raise not_found("Submission not found.")
    expect_revision(report, data.expected_revision)
    if report.status != "clarification":
        raise conflict("This submission is not waiting for clarification.")
    message(report, actor, data.note)
    report.status = "pending"
    report.revision += 1
    report.save()
    record_company_event(identity, company_id, "equipment.submission.replied", report)
    return report


@transaction.atomic
def review(identity, company_id, report_id, data):
    # Lock both participants before the report and registration aggregates.
    reporter_id = (
        EquipmentSubmission.objects.filter(pk=report_id, company_id=company_id)
        .values_list("reporter_id", flat=True)
        .first()
    )
    actor = authorize_write(identity, company_id, "tools.manage", related_members=[reporter_id])
    report = (
        EquipmentSubmission.objects.select_for_update()
        .select_related("reporter__person")
        .filter(pk=report_id, company_id=company_id)
        .first()
    )
    if report is None:
        raise not_found("Submission not found.")
    expect_revision(report, data.expected_revision)
    if report.status not in {"pending", "clarification"}:
        raise conflict("This submission has already been reviewed.")
    if data.decision == "clarify":
        if not data.note:
            raise bad_request("Enter a question for the reporter.")
        report.status = "clarification"
    elif data.decision == "link":
        asset = ToolAsset.objects.filter(company_id=company_id, pk=data.asset_id).first()
        if asset is None:
            raise not_found("Choose an existing registered item in this company.")
        # Linking evidence to an existing item must not silently overwrite its custody.
        report.asset = asset
        report.status = "linked"
    else:
        if data.registration is None:
            raise bad_request("Enter registration details.")
        reporter = report.reporter
        if report.in_my_possession and (
            reporter.access_state != "active"
            or reporter.ended_at
            or "tools.transfer" not in capabilities(reporter)
        ):
            raise forbidden(
                "The reporter is no longer eligible to hold equipment. Resolve its location with a manager."
            )
        # The report photo is already attached; adopt it after normal registration.
        if data.registration.photo_id:
            raise bad_request("Registration uses the photo attached to this submission.")
        asset, created = register_asset(identity, company_id, data.registration)
        if not created:
            raise conflict(
                "This registration key belongs to an existing item. Link the submission to it instead."
            )
        asset.registration_photo = report.photo
        asset.save(update_fields=["registration_photo"])
        if report.in_my_possession:
            custody = CustodyPeriod.objects.get(asset=asset, ends_at__isnull=True)
            custody.holder_warehouse = None
            custody.holder_membership = reporter
            custody.save(update_fields=["holder_warehouse", "holder_membership"])
        report.asset = asset
        report.status = "registered"
    if data.note:
        message(report, actor, data.note)
    report.revision += 1
    report.save()
    record_company_event(
        identity,
        company_id,
        "equipment.submission.reviewed",
        report,
        metadata={"decision": data.decision},
    )
    return report
