# Cutover acceptance

The original demo at commit `80202f5` is the interaction and layout reference; the approved compact account design is retained. This document maps the tool-tracker completion scope to production paths and acceptance evidence. Current release results are available on [PR #1](https://github.com/recnepspencer/tool-tracker/pull/1).

## Product agreements

- A request names one physical tool. Identical models still have separate unit IDs, asset tags, purchase details, condition and custody.
- Approval prepares a handoff. Confirmed receipt changes custody. Requests, assignments and access changes do not silently transfer tools.
- Companies independently configure employee tool registration and direct/reviewed/manager-controlled joining and leaving jobs.
- Invitations belong to the company once issued. Later changes to the sender's role do not invalidate them; expiry, explicit revocation and acceptance control their lifecycle.
- Company roles, warehouse grants and job responsibilities remain separate. Combined roles preserve their existing capabilities. No additional approval rules were introduced.

## Workflow and role coverage

| Family | Required behavior and actors | Evidence |
| --- | --- | --- |
| Accounts | Verified signup, login/logout, invitation account switching, replacement links, forgot/reset password, recovery from unusable links | `accounts`, `invitations`, `access-lifecycle` browser files; `test_browser_accounts.py`, `test_people_workflows.py` |
| Company/people | Bootstrap/switch company; admin profile, invitations, roles, access, employment end/reinstate; retain named custody | `workspace`, `workspace-access`, `access-lifecycle`, `settings`; public HTTP role/profile/people tests |
| Catalog/warehouses | Admin/equipment managers create/edit/archive/restore definitions and warehouses; manage scoped grants; preserve unit identity | `catalog-lifecycle`, `cutover-workflows`, `role-surfaces`; catalog/custody edge tests |
| Registration | Admin/equipment manager registration; policy-enabled employee registration; actual photos; optional unit metadata; safe committed retries | `accounts`, `cutover-workflows`, `asset-details`, `access-lifecycle`; registration/evidence and populated-upgrade tests |
| Browse/details | Photographed inventory, duplicate-model groups, checkout modes/filters, persistent background lists and sheets, readable histories, keyboard focus | `demo-parity`, `workspace`, `asset-details`, `condition-lifecycle` |
| Requests | Specific-unit request and withdrawal; admin/equipment/scoped warehouse decisions; approval is not receipt | `custody-decisions`, `custody-recovery`; request, isolation and concurrency HTTP tests |
| Handoffs | Holder transfer/return, source and receiving warehouse authority, accept/decline/cancel, recorded evidence and actual custody | `custody-decisions`, `custody-recovery`, `accounts`; custody, concurrent receipt and rollback tests |
| Condition/lifecycle | Holder reports; responsible managers find/repair/service/retire/restore/dispose; keep missing, damage and custody independent | `condition-lifecycle`, `workspace`; condition/history HTTP tests and private photo checks |
| Reconciliation | Admin/equipment managers record and resolve evidenced cases while retaining former-holder accountability | `custody-recovery`; reconciliation, tenant and evidence tests |
| Jobs/projects | Admin/dispatcher management, roster and crew/foreman/supervisor responsibility changes; field self-service under independent company rules | `jobs-management`, `settings`, `access-lifecycle`; job HTTP scenarios |
| Directory | Actual current jobs and held units, job/no-job/search filters; latest responsibility after replacement; archive/restore does not revive assignments | `cutover-workflows`; job/directory HTTP observations and combined-access checks |
| Settings | Original narrow company/jobs/categories composition; shared editors and ordinary dialogs; persisted independent filters; readable member rules | Five company-role journeys in `settings`, plus eight role/grant navigation cases |
| Activity | Real audit worker, own/company scope, search/type/warehouse filters before pagination, Previous/Next and reload | `cutover-workflows`; activity pagination/privacy HTTP tests and rapid-filter controller integration test |
| Shell/PWA | Eight role/grant combinations, mobile/desktop navigation, account and appearance persistence; manifest eligibility, offline notice, static-only cache and update lifecycle | `role-surfaces`, `workspace-access`, `accounts`, `pwa`; loaded browser captures |

The eight role/grant combinations are company admin, equipment manager, dispatcher, estimator, field member, scoped warehouse manager, foreman assignment and combined dispatcher/equipment roles. Individual workflows run for their applicable actors; route and API boundary checks verify the remaining roles do not receive unusable controls or unauthorized data.

## Implementation boundaries

PostgreSQL owns company, assignment, custody, condition and history state. CleanForce endpoint declarations generate the checked OpenAPI contract and typed frontend client. Page views compose feature controllers; effects synchronize external browser resources, sessions, focus, events or timers. The retired mock runtime, profile switcher, reset-data control, stock catalog images and prototype-only tests are absent from the active application.

Settings and catalog share category editors and their query. Settings composes the ordinary job dialogs and roster. Optional unit metadata never edits the shared model or custody. Names/history remain readable after employment ends. Revision conflicts retain the user's draft and offer a deliberate latest-value reload.

The PWA controller preserves prompt-mode worker activation. Reload consent is local to the accepting tab: another tab's worker activation must not discard an unsaved form. The real two-tab update journey reproduces the old lost-serial behavior and verifies retained draft, save, then explicit reload. A supplied install-event boundary checks offer dismissal, appinstalled cleanup and prompt-failure recovery; it is not a native OS installation test.

## Verification gates

- `npm run check`: frontend/e2e types, page-boundary lint, formatting, ten client/controller tests and the production PWA build.
- `uv run --env-file .env python scripts/check_api.py` from `backend/`: PostgreSQL declarations and 56 scoped foreign keys, fresh/populated migrations, checked OpenAPI, 130 backend tests, lint and formatting.
- `npm run test:browser`: 69 production-browser scenarios with actual sessions, CSRF, email links, PostgreSQL, private photos and the audit worker. Business responses are not mocked.
- CI repeats the seeder, verifies generated TypeScript drift and runs all gates before the web artifact can be packaged.

Each browser file has an owned database, web-build copy, file inbox, media and diagnostics under `artifacts/browser-runs/`. The worker-update test changes only its web copy. Review assets, review data and unrelated processes remain independent. Failed ENOSPC runs are not accepted as product evidence; the clean rerun exposed the actual cross-tab reload defect.

Visual evidence and reference behavior are mapped in [DEMO_PARITY.md](DEMO_PARITY.md); fixture and boundary details are in [TESTING.md](TESTING.md). Loaded captures include the original field/control-room structure, registration, tool reports/history, optional unit details and settings. Settings captures wait for actual saved values rather than only a heading.

## Scope boundaries

Production SMTP remains deferred, as requested. Development uses the private file inbox. The DigitalOcean testing environment uses trusted HTTPS, persistent PostgreSQL/photos and a private SMTP inbox; deployment and recovery procedures are in [deploy/README.md](../deploy/README.md). Chromium manifest eligibility and real worker behavior are tested; physical iOS/Android installation has not been performed. Future bidding, consumables, reservations and accounting remain separate domains.
