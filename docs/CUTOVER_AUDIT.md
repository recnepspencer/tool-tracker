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
| Catalog | Admin/equipment manager categories/models/warehouses, archive/restore, warehouse grants | Shared model edits preserve individual units; archived references; permission and tenant denials | Browser audit pending |
| Registration | Admin/equipment manager; field member with policy enabled | Photo validation/authorization, unique tag, retry key, policy disabled mid-draft, no fabricated holder | Photo-first and lost-response browser journeys pass; employee policy scenarios exist; broader role mutation audit pending |
| Browse/detail | Equipment roles and field members, including warehouse grant and foreman | Specific duplicate units, filters/search/refresh/back, sheets/focus, retired/history | Existing selected journeys; role audit pending |
| Requests | Field-capable actor requests specific asset; equipment/warehouse authority reviews; requester withdraws | Duplicate/replayed request, unavailable unit, rejected/withdrawn state, foreign scope, approval does not establish receipt | Additional browser paths pending |
| Handoffs | Holder or warehouse authority proposes; recipient/receiving authority accepts/declines; proposer cancels | Transfer/return, stale revision, concurrent receipt, revoked authority, pending custody unchanged, one open custody period | Existing selected journeys; role audit pending |
| Condition/lifecycle | Holder reports; responsible warehouse/equipment authority resolves missing, service, retire/restore/dispose | Missing independent of damage and custody; permanent disposal; evidence authorization | Existing selected journeys; role audit pending |
| Reconciliation | Admin/equipment manager opens/resolves evidenced cases | Photo required for custody correction, preserve provenance, cross-company evidence rejected | Backend evidence exists; browser journey pending |
| Jobs/projects | Admin/dispatcher creates/edits/archives, assigns/ends crew/foreman/supervisor | Estimator read only; field direct/approval/disabled join and leave; pending approve/reject/withdraw; offboarding | Existing selected journeys; broader browser audit pending |
| Directory | Field/equipment actors see people, jobs and held physical tools | Job/no-job filters, text search, no estimator/dispatcher equipment disclosure | Job/no-job, search/reload and held-unit browser journey passes; broader responsibility transitions pending |
| Activity | Equipment/admin company feed; remaining roles own events | Search/type/warehouse filters before pagination, foreign tenant, private visibility, actual audit worker | Server filters, pagination, historical context and own/company browser/HTTP evidence pass |
| App shell/PWA | Every role desktop/mobile, appearance, account, allowed navigation | Direct denied routes, overflow, offline private data not cached, install/update behavior, no demo controls/runtime | Eight role/grant combinations pass route/mobile navigation checks; full install/update and remaining action states pending |

Completion requires closing these outstanding evidence gaps against current production behavior. Passing a subset is not whole-app certification.

## Findings carried into the next audit pass

- Compare and restore remaining tool detail/action dialog composition, inline settings/catalog/jobs composition, and optional asset detail semantics from the original demo. Do not silently drop demo fields or reinstate mock values.
- Exercise catalog/model/category editing and archive/restore through the UI. Inspect whether an archived category leaves an unregistrable model offered in the registration picker.
- Verify all request/handoff decisions, receiving-warehouse scope, withdrawal after approval, and histories in browser journeys for the applicable roles.
- Complete browser reconciliation, remaining job/participation decisions, rehire/disable/revocation, cross-tab session changes, and disposal flows.
- Inspect labels for ended/suspended accountable holders: the custody ID must remain identifiable in the UI even when the person is absent from the active-person picker.
- Inspect transfer destinations and warehouse grants for memberships without equipment capabilities, including later role revocation; do not offer actions the recipient cannot complete.
- Existing audit events without warehouse snapshots are intentionally not assigned an invented historical warehouse. Only events with recorded context match a warehouse filter.

The production browser setup reuses a verified owner session per worker while creating independent companies. Fresh account journeys remain separate. Authentication throttling is enabled. No API/business responses are mocked; the lost-response scenario first executes the actual command, then drops its response.
