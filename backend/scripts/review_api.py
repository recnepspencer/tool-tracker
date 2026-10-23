"""Exercise the running local review API through real HTTP and session cookies."""

import os
from uuid import NAMESPACE_URL, uuid5

import requests

base = "http://127.0.0.1:8001/api"
session = requests.Session()


def token():
    response = session.get(f"{base}/auth/csrf", timeout=10)
    response.raise_for_status()
    return response.json()["csrf_token"]


response = session.post(
    f"{base}/auth/password-login",
    json={"email": "reviewer@example.com", "password": os.environ["NELSON_REVIEW_PASSWORD"]},
    headers={"X-CSRFToken": token()},
    allow_redirects=False,
    timeout=10,
)
if response.status_code != 302:
    raise RuntimeError(f"Login failed: {response.status_code}")
session.headers["X-CSRFToken"] = token()
response = session.get(f"{base}/me", timeout=10)
response.raise_for_status()
company_id = response.json()["memberships"][0]["company_id"]
response = session.get(f"{base}/companies/{company_id}/tools", timeout=10)
response.raise_for_status()
assets = response.json()["items"]
for item in assets:
    print(f"{item['asset_tag']}: {item['id']} ({item['name']}), requestable={item['requestable']}")
asset = next(item for item in assets if item["asset_tag"] == "NE-001")
url = f"{base}/companies/{company_id}/tools/{asset['id']}/requests"
payload = {
    "request_key": str(uuid5(NAMESPACE_URL, "nelson-electric/local-review/tool-request")),
    "note": "API review: request this specific drill",
}
first = session.post(url, json=payload, timeout=10)
first.raise_for_status()
second = session.post(url, json=payload, timeout=10)
second.raise_for_status()
assert first.status_code in {200, 201}
assert second.status_code == 200
assert first.json() == second.json()
request_id = first.json()["id"]
response = session.get(f"{base}/companies/{company_id}/tool-requests/{request_id}", timeout=10)
response.raise_for_status()
assert response.json() == first.json()
print(f"Request {request_id}: {first.json()['status']}; retry returned the same request.")
