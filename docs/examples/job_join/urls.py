"""Example consumer URL root; the app needs normal Django settings/migrations."""

from backend_platform.api import create_api
from cleanforce_identity.api import router as identity_router
from django.urls import include, path

from .api import router as participation_router

api = create_api(title="Nelson Electric", version="1.0")
api.add_router("", identity_router)
api.add_router("", participation_router)

urlpatterns = [
    path("", include("backend_platform.urls")),
    path("api/", api.urls),
]
