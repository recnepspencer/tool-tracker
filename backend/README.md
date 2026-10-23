# Nelson Electric API

The first API slice supports an authenticated employee requesting a specific physical tool. Two identical drills share a `ToolModel`, but each has its own `ToolAsset`, tag, custody, and requests. This backend is a CleanForce consumer; the React demo is not connected yet.

## Implemented scope

- CleanForce password login, sessions, logout, recovery and its identity routes.
- Company, person, company membership, and fixed company role grants.
- Warehouses, tool categories/models, individual assets, custody periods, and incident records needed to determine availability.
- Authenticated, paginated asset browsing with availability derived from current state.
- Requests for one required asset ID, plus reading your own request.
- Model-declared PostgreSQL company-integrity foreign keys, exclusive custodians, and nonoverlapping custody periods. Initial asset/custody creation is atomic application code.
- Transactionally queued CleanForce audit, request-key retries, and prevention of duplicate open requests by one person for one asset.

A request remains pending. It does not reserve the tool, alter custody, or substitute another unit. Multiple employees may request the same unit. Approval, fulfillment, withdrawal, and employee tool-registration endpoints are not part of this slice. The employee-registration setting and configurable job assignment rules remain specified in [the database proposal](../docs/DATABASE_PROPOSAL.md).

## Run locally

Requirements: Git access to the private CleanForce repository, uv, Docker with Compose. uv installs Python 3.13 when needed. CleanForce is pinned to commit `80ea29899246a4680f01624e03b896522770b6dd`; `uv.lock` pins the resolved dependencies.

Run from `backend/`:

```powershell
Copy-Item .env.example .env  # First setup only; preserve an existing .env.
uv sync --locked
docker compose up -d --wait
uv run --env-file .env python manage.py migrate
uv run --env-file .env python manage.py seed_review_data
uv run --env-file .env python manage.py runserver 127.0.0.1:8001 --noreload
```

On this workstation, uv is also available at `../artifacts/api-bootstrap/bin/uv.exe`; substitute that path for `uv` if it is not on PATH. PostgreSQL listens only on localhost port 55432. The compose volume retains review data; `docker compose stop` stops it without deleting records. This configuration and the example credentials are for local review only. Secrets are required through environment variables; secure cookies are enabled when DEBUG is off.

The seed prints the company/asset IDs and creates `reviewer@example.com`. Its password is `NELSON_REVIEW_PASSWORD` from your local `.env`. Rerunning it preserves assets, custody and requests and does not reset an existing login password.

Open [API documentation](http://127.0.0.1:8001/api/docs) or [OpenAPI JSON](http://127.0.0.1:8001/api/openapi.json). Swagger displays the contract, but browser mutations still require the real session and CSRF header; use the following script for a complete working request flow:

```powershell
uv run --env-file .env python scripts/review_api.py
```

This script signs in, lists both drills, requests `NE-001`, retries the same request key, and reads the result. Its stable request key makes repeated review runs safe. It deliberately creates a pending request in the review database.

## HTTP contract

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/api/auth/csrf` | Obtain a CSRF token and cookie before login. |
| POST | `/api/auth/password-login` | CleanForce login; send email, password, CSRF header, and cookie. Successful login redirects. |
| GET | `/api/me` | Active identity and active company memberships. |
| GET | `/api/companies/{company_id}/tools?limit=50&offset=0` | Individually tagged assets; limit 1–100. Includes model identity and derived requestability. |
| POST | `/api/companies/{company_id}/tools/{asset_id}/requests` | Request exactly that physical asset. New request returns 201; same-key retry returns 200. |
| GET | `/api/companies/{company_id}/tool-requests/{request_id}` | Read your own request in this company. Other people's requests are not exposed. |

```json
{
  "request_key": "cdf7f965-0fc5-4966-89f3-e87a5c2bf279",
  "note": "Needed for rough-in"
}
```

`request_key` is scoped to the requesting membership. Reusing it for a different asset or normalized note returns 409. Replaying the same request returns that resource's current state without repeating its audit event, even if the tool later becomes unavailable. Current authorization is still checked. A new key cannot create a second pending/approved request by the same person for that asset; the 409 response identifies the existing request.

Requests derive the actor from the authenticated session. `actor_id`, model-only requests, and other extra body fields are rejected. Tools must be active, serviceable, not reported missing, and currently held by an unarchived warehouse in the company. Other-company IDs do not bypass scope checks. HTTP statuses: 400 invalid input using CleanForce's validation response, 401 unauthenticated, 403 unauthorized/CSRF, 404 inaccessible or absent record, and 409 business conflict.

## Source map

| File | Responsibility |
| --- | --- |
| `companies/models.py`, `companies/access.py` | People/company identities and active capability checks. |
| `equipment/models/` | Catalog, physical assets, custody, and request records. |
| `companies/constraints.py` | Migration-serializable `ScopedForeignKey`, used in model `Meta.constraints`. |
| `equipment/migrations/` | Versioned PostgreSQL schema; applied history is preserved. |
| `equipment/asset_creation.py` | Atomic creation of an asset and its initial warehouse custody. |
| `equipment/queries.py` | Availability and read projections. |
| `equipment/request_tool.py` | Transactional request command and audit dispatch. |
| `equipment/api.py` | CleanForce HTTP declarations and typed schemas. |
| `config/urls.py` | Single governed API composition. |
| `tests/` | Real HTTP authentication/CSRF tests and PostgreSQL integrity/concurrency tests. |

The first schema intentionally contains only the columns and entities needed by this slice. The proposal's full job, estimating, lifecycle-resolution, and registration models are not all installed. No separate generic repository/service framework or frontend-shaped state tables are introduced.

## Transactions and audit

Commands lock membership, then asset, then warehouse. Availability is queried in a new statement after acquiring the asset lock, so a waiting request does not use a pre-lock custody snapshot. Future membership/role changes must lock the affected membership; custody and condition mutations must lock the asset. This protocol serializes request checks with the commands that change their authority. `create_asset_at_warehouse` creates an active asset and its initial custody in one transaction; the review seed uses this operation. It is an internal persistence function, not an authorized employee-registration endpoint. The asset's current custody is the one open period, not a second holder field on the asset.

PostgreSQL enforces at most one open custody period, valid holders, and nonoverlapping history. The application owns the requirement that an active asset has a custody period: arbitrary ORM/SQL writers can now bypass that existence rule. Future registration, handoff, and reconciliation commands must preserve it atomically. An asset with no custody is unavailable to the request API. The deferred existence triggers from migration `0002` are removed by `0003`; their historical SQL is retained so applied migrations remain reproducible and reversible.

The request, its captured source custody, and CleanForce's audit job commit together. Audit enqueue failure rolls the request back. The audit event itself is materialized by the platform worker:

```powershell
uv run --env-file .env python manage.py run_platform_jobs --limit 100
# Or run the persistent worker in another terminal:
uv run --env-file .env python manage.py run_platform_worker
```

Requests are not availability locks. Fulfillment must later lock the asset again and verify the captured source custody before creating a handoff. Company rules for granting capabilities are application code; a displayed title or Django staff flag confers no access.

## Verification

After applying migrations to the local review database, run the same complete gate before a release:

```powershell
uv run --env-file .env python scripts/check_api.py
uv run --env-file .env python manage.py generate_platform_openapi --output ../artifacts/nelson-openapi.json
```

The gate fails on Django model errors, missing migration files, unapplied migrations, or scoped-foreign-key drift in the configured PostgreSQL database. `manage.py check_database_schema` compares declared names, source/target columns, target tables, validation status, and enforcement modes against PostgreSQL, and rejects company-owned relationships without a scope declaration. It specifically checks scoped foreign keys and obsolete custody triggers; it is not a general-purpose comparison of every database object. It does not apply migrations or change review records.

The test step forces a new test database and applies the entire migration history. It also upgrades populated `0002` data to the latest schema and verifies that assets, custody, and requests survive. Tests prove that changing a scoped constraint generates executable remove/add migration operations, and deliberately remove, weaken, or add constraints to verify that drift is detected. Keep `companies.constraints.ScopedForeignKey` importable for historical migrations. Review generated migrations whenever changing fields or table names; automatic detection is backed by these checks, not a guarantee that every future schema change needs no review.

Other tests cover two identical tools, authentication, CSRF, live access revocation, cross-company access, request ownership, availability, retries, competing requests, concurrent duplicate submissions, audit rollback, atomic initial custody creation, and database-enforced custody/company integrity. Tests use a separate PostgreSQL test database and the local development database role, with no SQLite substitute. The frontend and existing static deployment remain separate. This gate is available locally; the existing Pages workflow does not run it, and API CI will need access to the private CleanForce dependency.
