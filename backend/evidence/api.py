from datetime import datetime
from typing import Literal
from uuid import UUID

from backend_platform.api import define_http_endpoint
from cleanforce_identity.users.facade import current_identity
from django.http import FileResponse, HttpRequest
from django.views.decorators.csrf import csrf_protect
from ninja import File, Form, Router, Schema
from ninja.files import UploadedFile

from .files import read_file, upload_photo

router = Router(tags=["evidence"])


class FileView(Schema):
    id: UUID
    original_name: str
    content_type: str
    byte_count: int
    purpose: str
    expires_at: datetime
    attached_at: datetime | None


@csrf_protect
def upload(
    request: HttpRequest,
    company_id: UUID,
    file: File[UploadedFile],
    purpose: Form[Literal["registration", "incident", "handoff", "reconciliation", "service"]],
):
    return upload_photo(current_identity(request), company_id, file, purpose)


def download(request: HttpRequest, company_id: UUID, file_id: UUID):
    record, stream = read_file(current_identity(request), company_id, file_id)
    response = FileResponse(
        stream, as_attachment=True, filename=record.original_name, content_type=record.content_type
    )
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, no-store"
    return response


define_http_endpoint(
    router, method="post", path="/companies/{company_id}/files", endpoint=upload, response=FileView
)
define_http_endpoint(
    router,
    method="get",
    path="/companies/{company_id}/files/{file_id}",
    endpoint=download,
    response=bytes,
)
