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

The completion scope above is implemented in the backend. The regression suite includes 74 tests covering fresh migration installation, populated upgrades, generated-contract validation, registration-disable serialization, competing receipt decisions, audit enqueue rollback, directory capability boundaries, and preservation of advanced seed scenarios. PostgreSQL verification compares 56 declared scoped foreign keys with the actual database. CI also executes the seeder twice and publishes the generated OpenAPI artifact.

Operational boundaries: invitations return a token for administrator delivery and require an existing authenticated CleanForce account; external account provisioning and mail delivery remain deployment integration. The frontend still uses its mock adapter. Automatic duplicate identity merging, future bidding, optional site/allocation models, and production API hosting are outside this buildout.
