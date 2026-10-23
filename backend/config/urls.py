from backend_platform.api import create_api
from cleanforce_identity.api import router as identity_router
from django.urls import include, path

from accounts.api import router as accounts_router
from companies.api import router as company_router
from equipment.api import router as tools_router
from equipment.catalog_api import router as catalog_router
from equipment.operations_api import router as operations_router
from evidence.api import router as evidence_router
from evidence.openapi import describe_photo_download
from work.api import router as work_router

from .api import router as session_router
from .read_api import router as read_router

api = create_api(title="Nelson Electric API", version="0.1.0")
api.add_router("", identity_router)
api.add_router("", accounts_router)
api.add_router("", session_router)
api.add_router("", tools_router)
api.add_router("", catalog_router)
api.add_router("", operations_router)
api.add_router("", company_router)
api.add_router("", work_router)
api.add_router("", evidence_router)
api.add_router("", read_router)
describe_photo_download(api)

urlpatterns = [
    path("", include("backend_platform.urls")),
    path("api/", api.urls),
]
