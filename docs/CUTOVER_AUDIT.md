# Cutover acceptance

The original demo is the interaction and visual reference, with the approved account design retained. Server-owned company roles are `company_admin`, `equipment_manager`, `dispatcher`, `estimator`, and `field_member`. Warehouse authority is an additional grant on a membership, and foreman/supervisor are assignment responsibilities rather than global roles. Combined roles must preserve the union of permissions. This document records remaining work, not completion.

## Boundary review and implementation order

The generated OpenAPI contract and company capability projection own the public client boundary. PostgreSQL owns membership, policy, custody, condition, assignments, and revisions. UI navigation must reflect these permissions without granting authority itself. No retired mock transport, synthetic photo, or role switcher may supply business state.

The parity review found missing photo-first registration, job-filtered directory, activity filters, company profile updates, and warehouse creation dialogs. Registration must continue selecting a shared model and identifying one physical unit; a photo must not infer a model or create fake custody. Directory filtering already exists in the API. Activity filtering must occur before pagination and preserve the existing own/company visibility rule. Company profile updates need an explicit revisioned, audited command and an address migration. Forms must preserve drafts on conflict. Appearance remains local presentation only.

Implement these gaps first, then verify each workflow family across each applicable role and scoped grant. Run focused browser scenarios during repair, then the PostgreSQL migration/contract gate and production browser suite. Keep state in feature hooks, with effects only for external resource synchronization such as focus, listeners, and object-URL lifetime.

## Workflow matrix

| Family | Allowed actors and observations | Denial/edge obligations | Evidence status |
| --- | --- | --- | --- |
| Accounts | Signup/verify, login/logout, invitation acceptance/account switch, recovery/reset | Invalid/expired/replayed links, wrong email, anonymous private navigation, offline and cross-tab revocation | Existing account journeys; broader audit pending |
| Company | Bootstrap, switch tenant; admin profile name/address/timezone | Last admin, foreign tenant, stale revision, invalid timezone; no profile mutation for other roles | Implemented; five-role HTTP profile tests, populated upgrade and browser conflict recovery pass |
| People/access | Admin invite/revoke, roles/title/access, employment end/reinstate | Suspended/disabled/ended sessions, issuer loses authority, retained custody, union roles | Existing backend cases; role/browser audit pending |
| Catalog | Admin/equipment manager categories/models/warehouses, archive/restore, warehouse grants | Shared model edits preserve individual units; archived references; permission and tenant denials | Admin/equipment edit/archive/restore journeys and inactive-grant revocation pass; shared definitions preserve unit identity and custody |
| Registration | Admin/equipment manager; field member with policy enabled | Photo validation/authorization, unique tag, retry key, policy disabled mid-draft, no fabricated holder | Photo-first and lost-response browser journeys pass; employee policy scenarios exist; broader role mutation audit pending |
| Browse/detail | Equipment roles and field members, including warehouse grant and foreman | Specific duplicate units, filters/search/refresh/back, sheets/focus, retired/history | Photographed detail, filtered background, checkout mode, Escape/focus restoration and duplicate-unit journeys pass; remaining history/lifecycle audit open |
| Requests | Field-capable actor requests specific asset; equipment/warehouse authority reviews; requester withdraws | Duplicate/replayed request, unavailable unit, rejected/withdrawn state, foreign scope, approval does not establish receipt | Rejection, withdrawal before/after approval, decline and receipt pass for admin/equipment/scoped warehouse reviewers; broader edge audit remains open |
| Handoffs | Holder or warehouse authority proposes; recipient/receiving authority accepts/declines; proposer cancels | Transfer/return, stale revision, concurrent receipt, revoked authority, pending custody unchanged, one open custody period | Transfer/cancel/return passes for admin, equipment, field and scoped warehouse holders; destination scope and lost-response photo replay pass |
| Condition/lifecycle | Holder reports; responsible warehouse/equipment authority resolves missing, service, retire/restore/dispose | Missing independent of damage and custody; permanent disposal; evidence authorization | Existing selected journeys; role audit pending |
| Reconciliation | Admin/equipment manager opens/resolves evidenced cases | Photo required for custody correction, preserve provenance, cross-company evidence rejected | Admin/equipment browser recovery passes with mandatory photo, preserved former-holder identity and custody history; scoped warehouse denial verified |
| Jobs/projects | Admin/dispatcher creates/edits/archives, assigns/ends crew/foreman/supervisor | Estimator read only; field direct/approval/disabled join and leave; pending approve/reject/withdraw; offboarding | Existing selected journeys; broader browser audit pending |
| Directory | Field/equipment actors see people, jobs and held physical tools | Job/no-job filters, text search, no estimator/dispatcher equipment disclosure | Job/no-job, search/reload and held-unit browser journey passes; broader responsibility transitions pending |
| Activity | Equipment/admin company feed; remaining roles own events | Search/type/warehouse filters before pagination, foreign tenant, private visibility, actual audit worker | Server filters, pagination, historical context and own/company browser/HTTP evidence pass |
| App shell/PWA | Every role desktop/mobile, appearance, account, allowed navigation | Direct denied routes, overflow, offline private data not cached, install/update behavior, no demo controls/runtime | Eight role/grant combinations pass route/mobile navigation checks; full install/update and remaining action states pending |

Completion requires closing these outstanding evidence gaps against current production behavior. Passing a subset is not whole-app certification.

## Findings carried into the next audit pass

### Catalog and custody boundary review

The next slice preserves the independent lifetimes of catalog definitions, physical units, membership access and custody. A model remains editable when its category is archived, but new registration must stop offering it. Current/historical custody labels must come from durable membership and warehouse relationships, rather than an active-person picker. Warehouse grants and handoff destinations must be effective for the relevant capabilities; revoking an old grant must remain possible after the subject or warehouse becomes inactive. A stranded pending handoff needs an explicit, reasoned administrative cancellation that preserves custody and audit provenance; recipient acceptance remains the only ordinary receipt path.

Implementation order: add regression cases for these boundaries; repair catalog/grant/destination commands and durable read projections; regenerate OpenAPI; restore the photo/metadata/action tool sheet using feature hooks and separate action components; integrate warehouse-authority display and revocation; then exercise catalog edits and all request/handoff decisions in real browser journeys for the applicable roles. Keep the previous ordinary command paths and their denial semantics intact, and add a distinct manager cancellation action rather than impersonating the proposer. Verify focused HTTP/browser cases during repair, then the PostgreSQL migration/contract gate and production browser suite. Optional asset-value fields and remaining jobs/account/PWA audit work remain open; they are not discarded from the overall cutover.

- Compare and restore remaining tool detail/action dialog composition, inline settings/catalog/jobs composition, and optional asset detail semantics from the original demo. Do not silently drop demo fields or reinstate mock values.
- Complete remaining job/participation decisions, rehire/disable/revocation, cross-tab session changes, and disposal flows.
- Existing audit events without warehouse snapshots are intentionally not assigned an invented historical warehouse. Only events with recorded context match a warehouse filter.

The production browser setup reuses a verified owner session per worker while creating independent companies. Fresh account journeys remain separate. Authentication throttling is enabled. No API/business responses are mocked; the lost-response scenario first executes the actual command, then drops its response.

### Browser-runtime isolation boundary

Repeated public-account journeys currently share the review database's IP throttle and email inbox. Production authentication remains authoritative; tests must not disable throttling or clear live security state. The test launcher will create an owned PostgreSQL database per test file, apply ordinary migrations, start the API and audit worker on a separate port, and give both an isolated inbox/media directory. The production preview must proxy to that API and cannot reuse an unrelated server. Teardown may terminate only spawned processes and drop only the launcher-created database. CI and local runs must use the same launcher. Verify the focused custody/recovery cases first, then the full browser suite, retaining logs/screenshots for failures. This changes test runtime ownership, not application authentication semantics.

The custody review also found a misleading recovery instruction: every HTTP 409 was treated as a stale revision. Only `stale_revision` and `stale_custody` warrant loading a newer record. Evidence validation must retain the form and let the user supply the required photo. Verify this in the actual reconciliation journey as well as the HTTP-client boundary test.

### Tool-sheet navigation boundary

The sheet routes currently unmount the launching list and recreate a second list behind the dialog. That drops visible filters/expansion and removes the element to which the focus trap should return. The list owns its URL filters and DOM lifetime; the detail route owns the selected physical asset and action. Keep inventory, flagged inventory, My tools and checkout as persistent parent routes, with detail/registration sheets as nested routes. Read the background list filters from the recorded return location while a sheet is open, preserve that location through action changes, and remove the duplicate list construction from the sheet itself. Verify the actual filtered background, checkout list mode, Escape/close navigation and keyboard focus restoration in the photographed browser journey. Then rerun affected navigation/workspace cases and the regular frontend gate; no backend behavior changes are required.

The next access/job pass must verify live permission changes without relying on a page reload, job assignment/participation history after employment ends, and independent direct/approval/disabled join and leave rules. Assignment labels currently depend on the active-person picker; unlike the corrected custody labels, that historical projection still needs review.

## Verified batch — 2026-10-26

The PostgreSQL release gate passes 107 tests, 56 scoped foreign-key checks, migration declaration/drift/populated-upgrade checks, generated OpenAPI drift, and Python lint/formatting. Frontend type checking (including browser tests), lint, formatting, six client-boundary tests and the production PWA build pass. All 37 production-browser journeys pass on the current application. The full browser run completed 34 journeys; the account file stopped during API startup before executing tests. After increasing readiness to 60 seconds and flushing startup logs, its three journeys passed on rerun. Test databases/processes are isolated per file and cleaned up; production authentication remains enabled.

These results cover the catalog/custody/sheet corrections described above. They do not close the outstanding job/access, disposal, full settings/optional-metadata parity and PWA install/update obligations in this audit.
