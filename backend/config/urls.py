from backend_platform.api import create_api
from cleanforce_identity.api import router as identity_router
from django.urls import include, path

from equipment.api import router as tools_router

from .api import router as session_router

api = create_api(title="Nelson Electric API", version="0.1.0")
api.add_router("", identity_router)
api.add_router("", session_router)
api.add_router("", tools_router)

urlpatterns = [
    path("", include("backend_platform.urls")),
    path("api/", api.urls),
]
