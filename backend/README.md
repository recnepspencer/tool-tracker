# Nelson Electric API

The tool-tracker backend uses CleanForce authentication and governed HTTP declarations, Django, and PostgreSQL. Business models follow the company/equipment/work domains in [the proposal](../docs/DATABASE_PROPOSAL.md). Future bidding can share company, people, and project identities. The React app uses these APIs through a generated OpenAPI client; the retired demo has been removed. Production hosting remains to be configured.

## Run and review

Requirements: Git access to the private CleanForce repository, uv, Docker Compose. CleanForce is pinned to `80ea29899246a4680f01624e03b896522770b6dd`; `uv.lock` pins dependencies. Commands run from `backend/`:

```powershell
Copy-Item .env.example .env # First setup only; preserve existing local configuration.
uv sync --locked
docker compose up -d --wait
uv run --env-file .env python manage.py migrate
uv run --env-file .env python manage.py seed_review_data
uv run --env-file .env python manage.py runserver 127.0.0.1:8001 --noreload
```

This workstation also has uv at `../artifacts/api-bootstrap/bin/uv.exe`. PostgreSQL listens on localhost 55432. The volume retains review records. Example credentials, debug mode, and the local server are review configuration.

Open [interactive API docs](http://127.0.0.1:8001/api/docs). The checked [OpenAPI contract](contracts/openapi.json) defines payloads, enums, pagination, revisions, and endpoint paths. Obtain `/api/auth/csrf`, sign in using CleanForce `/api/auth/password-login`, then use the session cookie and refreshed CSRF token for writes. Every business actor comes from the authenticated identity.

Seeded accounts are `admin@example.com`, `manager@example.com`, `reviewer@example.com`, `apprentice@example.com`, `warehouse@example.com`, `estimator@example.com`, and `suspended@example.com`. New account passwords come from local `NELSON_REVIEW_PASSWORD`. Reruns preserve existing passwords, access changes, policies, tool edits, custody, and resolved requests. The warehouse profile manages North only; manager/admin profiles have company equipment authority.

The seed includes ten assets, two identical independently tagged drills, worker-held tools, damaged/missing tools, pending transfers/returns, approved and pending requests, two active job assignments, an archived job, and an approval-required leave request. The basic repeatable HTTP walkthrough is:

```powershell
uv run --env-file .env python scripts/review_api.py
```

## Public capabilities

All business routes are scoped under `/api/companies/{company_id}` except company bootstrap and authenticated invitation acceptance.

| Domain | Capabilities |
| --- | --- |
| Company/access | Bootstrap a company; list people and permissions; grant/revoke roles; suspend, disable, end, and reactivate memberships; issue, revoke, and accept email-bound invitations. |
| Catalog | Create/update/archive warehouses, categories, and shared tool models; grant warehouse authority; register individual assets; edit serials; reassign stewardship. |
| Registration | Company-configurable employee creation; manager override; payload-bound request keys; atomic asset and initial custody creation; optional staged photo. |
| Custody | Request a specific asset; approve/reject/withdraw; propose transfer/return; accept/decline/cancel; browse scoped queues and custody history. |
| Condition | Independent damage and missing incidents; repair/service records; found reports; retirement, restoration, and disposal. |
| Reconciliation | Investigate cases; record reasoned resolutions; correct custody with photo evidence and both case/asset revisions. |
| Work | Projects, jobs, administrative assignments and responsibility changes; configurable direct/approval-required/disabled self-join and self-leave; decisions, archive/restore, historical assignments. |
| Evidence/reporting | Validated staged JPEG/PNG/WebP uploads, authorized downloads, typed evidence links, company summary, person/job/tool directory, and scoped activity. |

Requests do not reserve tools. Approval creates a pending handoff; the recipient's acceptance records actual receipt. Only one handoff may be pending per asset. A warehouse receipt updates responsible warehouse; a worker transfer preserves it. Job changes preserve equipment custody. Suspension preserves accountability; employment end explicitly closes job assignments. Disposed assets cannot be restored. Duplicate reconciliation cases can record findings; automatic asset identity merging is outside this API.

Mutable commands require `expected_revision` where declared. Stale revisions return 409. Request, registration, participation, and handoff creation use `request_key` with payload-bound retries. Replaying a resolved handoff returns the existing matching outcome; a conflicting decision returns 409. Search/list endpoints use bounded `limit`/`offset` pagination.

Invitations deliver an email and return their single-use token once to an authorized administrator for sharing. Tokens are stored only as digests, expire after seven days, and require an authenticated matching email. Sent invitations remain valid when the sender's role or employment changes; administrators can explicitly revoke them. `accounts` adds verified signup and JSON browser endpoints using CleanForce's password/session/recovery authority. Debug email is written to `artifacts/mail`; production SMTP configuration is deferred. See the root README for account and hosting configuration.

## Ownership and integrity

`companies` owns membership/role authority and the bridge to CleanForce audit. `equipment` owns catalog, asset identity, custody, conditions, and registration. `work` owns jobs and assignment histories. `evidence` owns staged photo storage; typed equipment links own attachment meaning. `config/read_api.py` composes read projections without mutation authority.

Commands lock participating memberships in UUID order, then the relevant policy/catalog/asset/job aggregates. Asset locks protect custody, condition, and handoff decisions; a fresh statement after waiting reads current custody. Registration and policy updates lock the same policy row. Shared catalog edits and asset metadata edits have separate revisions. File bytes are stored outside database command transactions; attaching a staged file participates in the domain transaction and rechecks current policy.

`ScopedForeignKey` declarations in model `Meta.constraints` augment normal foreign keys with company/asset matching. Keep its import path stable for historical migrations. PostgreSQL also enforces exclusive holders, valid status vocabularies, one open custody interval, and nonoverlapping histories. The application preserves the existence of custody for active assets; direct SQL/ORM writers can bypass that existence requirement. Applied migration SQL remains historical; new constraint changes are tracked in model state.

New composite constraints must follow creation of their referenced unique keys. The initial work/equipment migrations order these operations explicitly. Fresh-install and populated-upgrade tests expose incorrect ordering before release.

## Checks, contracts, and CI

```powershell
uv run --env-file .env python scripts/check_api.py
# After an intentional public-contract change, regenerate and review the diff:
uv run --env-file .env python manage.py generate_platform_openapi --output contracts/openapi.json
```

The gate checks Django declarations, missing migrations, unapplied migrations, PostgreSQL scoped-constraint drift, OpenAPI drift, a fresh test database with migrations, regression tests, and formatting/lint. Migration tests upgrade populated historical records. Domain-owned fixtures keep job tests independent of equipment; HTTP tests validate real responses against the checked OpenAPI instead of importing implementation schemas. Tests exercise rollback, access revocation, tenant isolation, policy changes, competing receipt decisions, and seed preservation.

[API quality](../.github/workflows/api-quality.yml) runs on branch pushes and PRs using real PostgreSQL and production-browser journeys. The [web packaging workflow](../.github/workflows/deploy-pages.yml) invokes the same reusable check; it no longer publishes the retired static demo. CI uses a dedicated read-only CleanForce deploy key, removed from the runner after dependency installation. Fork PRs without the secret fail closed. The generated OpenAPI document is uploaded as a workflow artifact.

The schema command checks declared scoped foreign keys and obsolete custody triggers; it is not a general comparison of every database object. Review generated migration and contract diffs alongside behavior tests.

## Workers and storage

Audit jobs commit with domain changes; a worker materializes the activity feed. A worker outage can delay activity without losing queued audit evidence.

```powershell
uv run --env-file .env python manage.py run_platform_worker
uv run --env-file .env python manage.py cleanup_staged_photos
```

The cleanup command removes expired unattached photos and preserves attached evidence. `NELSON_MEDIA_ROOT` selects local storage; production can configure Django's storage backend. Downloads require current membership. The pinned CleanForce endpoint helper describes JSON responses only, so `evidence/openapi.py` adapts its public schema output for binary photo media types; a regression test compares the contract with actual streamed responses.

Reservations, future estimating, consumable stock, financial costing, automatic duplicate merging, and optional site/allocation extensions remain future domains.
