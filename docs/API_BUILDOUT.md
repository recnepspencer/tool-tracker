# Tool tracker API completion

The public API is generated from CleanForce endpoint declarations and checked in as `backend/contracts/openapi.json`. The consumer contract owns request/response meaning; domain tests own behavior; PostgreSQL tests own persistence and transaction guarantees. Test fixtures are scoped to the responsibility under test. Cross-domain scenarios supplement these tests rather than replacing them with one universal fixture.

## Completion scope

- CI: real PostgreSQL, migration drift detection, populated upgrades, checked OpenAPI, regression tests, repeatable seeding; deployment depends on these checks.
- Company/access: bootstrap, people, invitations, role/access changes, warehouse grants, self-service policies. Identity authentication remains CleanForce-owned.
- Work: projects, jobs, direct administrative assignments, configurable self-join/leave and approvals, archive/restore, participation history.
- Equipment: warehouses, categories/models, individual asset registration/editing, employee registration switch, staged photos and authorized downloads.
- Custody: specific-unit requests, approval/rejection/withdrawal, transfer/return proposals, recipient acceptance/decline/cancellation, immutable custody history and responsible warehouse updates.
- Condition: independent missing/damage reports, service/repair outcomes, lifecycle transitions, evidenced custody reconciliation.
- Reads: per-company asset detail/search, operational queues, people/job directory, and activity.
- Seed: deterministic company/admin/manager/workers, two identical tools, held/damaged/missing units, multiple warehouses/jobs, pending requests and handoffs; reruns preserve live state.

Future estimating, reservation scheduling, consumable stock, accounting, and optional site/party/allocation extensions are outside tool-tracker completion. Frontend integration and production infrastructure deployment are separate from completing this API.

## Verification requirements

Exercise HTTP contracts with real sessions/CSRF, use small domain-owned factories, and assert outcomes rather than helper call sequences. Validate real responses against the generated OpenAPI schemas. Test authorization independently of database setup where possible. Exercise invalid transitions, tenant isolation, optimistic revisions, replay behavior, concurrent mutations, and audit rollback. Migration tests cover a fresh database and upgrades preserving historical records. Seeding tests verify scenario meaning and repeatability without resetting user changes.

CI uses a dedicated read-only CleanForce deploy key. It does not use a developer's account token. Fork PRs without the secret fail closed; do not switch to `pull_request_target` to run untrusted code with credentials.

## Implemented evidence

The backend suite covers fresh migration installation, populated upgrades, generated-contract validation, concurrent receipt decisions, audit rollback, tenant isolation, account verification/recovery, and seed preservation. PostgreSQL verification compares 56 declared scoped foreign keys with the actual database. CI executes the seeder twice and publishes the generated OpenAPI artifact.

The frontend uses the generated OpenAPI client. Browser integration tests exercise real sessions and delivered email links, specific-asset custody, assignments, company policies, condition/service, photo authorization, stale edits, workspace switching, and offline behavior. Public HTTP commands create isolated fixture companies; scenarios assert visible user outcomes and persisted API state. The removed prototype and its mock-only tests are recoverable through Git history.

Asset registration and metadata updates accept optional `serial_number`, `acquisition_date`, `acquisition_cost`, `acquisition_currency` and `notes`. Send purchase amounts as decimal strings, for example `"249.95"` with `"USD"`; reads return decimal strings without floating-point conversion. Metadata updates preserve omitted fields. An explicit `acquisition_cost: null` clears the amount and currency, while `"0.00"` records a known zero price. These fields belong to the physical unit and do not change its shared model, custody or future bid prices.

Production SMTP and hosting are still deployment configuration tasks. Development emails use a private file inbox. Bidding, consumable stock, reservations, automatic identity merging, and optional site/allocation models remain future domains.
