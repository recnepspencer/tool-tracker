"""Describe streamed photos for the pinned CleanForce HTTP endpoint adapter.

Its define_http_endpoint API exposes JSON response schemas only. Keep this
transport adaptation here until that adapter exposes binary response metadata.
"""

PHOTO_MEDIA_TYPES = ("image/png", "image/jpeg", "image/webp")


def describe_photo_download(api):
    original = api.get_openapi_schema

    def get_schema(*args, **kwargs):
        document = original(*args, **kwargs)
        for path, operations in document["paths"].items():
            if path.endswith("/companies/{company_id}/files/{file_id}"):
                responses = operations["get"]["responses"]
                response = responses.get(200) or responses["200"]
                response["content"] = {
                    media: {"schema": {"type": "string", "format": "binary"}}
                    for media in PHOTO_MEDIA_TYPES
                }
        return document

    api.get_openapi_schema = get_schema
