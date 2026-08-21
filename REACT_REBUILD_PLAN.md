# Nelson Electric Tool Custody System — React Rebuild Plan

## 1. Goal

Rebuild the existing custody-system prototypes as a static, responsive React application that:

- opens on a login screen;
- offers one-click demo access as a hardcoded worker or administrator;
- uses the supplied tool photographs and existing custody-system visual language;
- supports the important worker, warehouse, and administrative click-through flows;
- keeps all data local and deterministic;
- places all data access behind API-shaped contracts and adapters so a real backend can replace the mock implementation later;
- is composed from reusable, typed components rather than large role-specific pages.

The current public Nelson Electric landing page is a separate concept. It may supply brand language, but it should not be folded into the custody application or made the application entry point.

## 2. Current-source inventory

The source is a set of interactive `.dc.html` prototypes, not an existing React project:

| Reference                                                              | Intended React surface                                                                                                 |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `Nelson Admin.dc.html`                                                 | Authentication, onboarding, admin dashboard, people, permissions, warehouses, settings, audit activity, reconciliation |
| `Nelson Tools.dc.html`                                                 | Worker tools, catalog/checkout, transfers, requests, activity, add-tool flow, account                                  |
| `Nelson Warehouse.dc.html`                                             | Desktop warehouse queue, inventory, people, editing, decommissioning                                                   |
| `Nelson Warehouse Mobile.dc.html`                                      | Responsive/mobile treatment of warehouse operations                                                                    |
| tool PNG files                                                         | Tool catalog and detail photography                                                                                    |
| `index.html`, root `styles.css`, root `script.js`, landing concept PNG | Separate marketing-site reference only                                                                                 |

There are 16 unique tool images. Many files are exact duplicates, and most originals are 6–9 MB. Preserve the originals, but publish optimized derivatives from one canonical copy of each image.

## 3. Product and technical decisions

### Static application

- Use React + TypeScript + Vite.
- Produce a normal `dist/` directory with no runtime server requirement and no network calls.
- Use a hash router initially so deep links work on any static host without rewrite rules. The router can be changed to history routing when a deployment target supplies SPA rewrites.
- Keep the custody app at the repository root. Leave the current prototypes in place as references until parity has been verified.

### Demo authentication

The `/login` page is the entry point and shows two explicit profile cards:

| Profile    | Role   | Default landing page |
| ---------- | ------ | -------------------- |
| Ray Torres | Worker | My tools             |
| Sam Ochoa  | Admin  | Admin dashboard      |

Selecting a profile calls the authentication adapter, creates a local demo session, and redirects according to role. There are no fake production credentials and no password is required for the primary demo path.

Session behavior:

- retain the selected role in `sessionStorage` so refresh does not log the viewer out;
- provide Sign out from both shells;
- guard routes by role and redirect unauthorized navigation;
- provide Reset demo data in the account/settings surface;
- keep signup, invitation, and password-reset UI as later prototype-parity screens, not as prerequisites for the first useful build.

### One coherent mock system

Do not copy the separate worker/admin/warehouse state objects from the prototypes. Create one normalized fixture database containing users, warehouses, tools, custody records, transfers, requests, flags, and audit events.

Every role reads and mutates that same mock database through adapters. For example:

1. Ray requests a rotary hammer.
2. The custody adapter creates a pending request and audit event.
3. Sam sees the request in warehouse operations.
4. Sam approves it.
5. Ray becomes the holder and both activity feeds show the custody change.

That coherence is the most important difference between a visual mockup and a principled static application.

## 4. Architecture

```text
src/
  app/
    App.tsx
    router.tsx
    providers.tsx
    route-guards.tsx
  api/
    contracts/
      auth-api.ts
      tools-api.ts
      custody-api.ts
      warehouse-api.ts
      admin-api.ts
    mock/
      create-mock-api.ts
      mock-database.ts
      seed-data.ts
      persistence.ts
    http/
      http-client.ts
      create-http-api.ts
  domain/
    auth.ts
    tool.ts
    custody.ts
    warehouse.ts
    activity.ts
    reconciliation.ts
  features/
    auth/
    worker-tools/
    catalog/
    custody/
    activity/
    warehouse-operations/
    people/
    permissions/
    reconciliation/
    settings/
  components/
    ui/
    layout/
    tool/
    custody/
  styles/
    tokens.css
    globals.css
  assets/
    tool-images.ts
  test/
    render-app.tsx
public/
  images/tools/
```

Rules for keeping the codebase honest:

- Components never import seed fixtures directly.
- Components never call `fetch` directly.
- Pages obtain data through feature hooks backed by the injected API contracts.
- Domain types do not contain JSX or presentation-only fields such as colors.
- Status labels, permissions, and role capabilities are derived in selectors/policies rather than repeated in pages.
- Mutations live in adapters/domain services; sheets and dialogs only collect intent.
- Shared interaction patterns are components, not copied markup.
- Prefer small feature-local components; promote a component to shared UI only after it is reused.

### API contracts

Expose one application API composed from focused ports:

```ts
interface NelsonApi {
  auth: AuthApi;
  tools: ToolsApi;
  custody: CustodyApi;
  warehouse: WarehouseApi;
  admin: AdminApi;
}
```

Representative operations:

- `AuthApi`: `listDemoProfiles`, `signInAs`, `restoreSession`, `signOut`
- `ToolsApi`: `listTools`, `getTool`, `createTool`, `updateTool`, `flagTool`
- `CustodyApi`: `requestTool`, `startTransfer`, `acceptTransfer`, `declineTransfer`, `cancelTransfer`
- `WarehouseApi`: `listQueue`, `approveRequest`, `acceptReturn`, `declineQueueItem`, `decommissionTool`
- `AdminApi`: `getDashboard`, `listPeople`, `updateRole`, `invitePeople`, `removePerson`, `listActivity`, `listReconciliationIssues`, `resolveIssue`

The initial `createMockApi` implements every contract with promises and a shared local store. `createHttpApi` supplies a real transport seam and request/response mapping without being selected by the static build. This makes a backend migration an adapter replacement rather than a component rewrite.

Use TanStack Query at the feature boundary for query keys, mutations, cache invalidation, loading states, and eventual HTTP compatibility. Keep transient UI state—open sheets, active filters, draft notes—in the owning component or reducer.

## 5. Route map

```text
/
  -> /login
/login
/worker/tools
/worker/checkout
/worker/activity
/worker/account
/admin/dashboard
/admin/operations/queue
/admin/operations/inventory
/admin/operations/flagged        5B
/admin/people
/admin/permissions
/admin/warehouses
/admin/activity
/admin/reconciliation
/admin/settings
/invite/:token                 later parity screen
/reset-password               later parity screen
```

The admin profile is allowed to enter warehouse operations, so the complete warehouse prototype remains demonstrable without requiring a third login profile. A warehouse-manager profile can be added later without changing the route or adapter design.

## 6. Component inventory

### Application and layout

- `AppRouter`, `ProtectedRoute`, `RoleRoute`
- `AuthLayout`, `WorkerShell`, `AdminShell`, `OperationsShell`
- `AppHeader`, `SidebarNav`, `MobileNavDrawer`, `AccountMenu`
- `ThemeProvider`, `SessionProvider`, `ToastProvider`, `ApiProvider`

### UI primitives

- `Button`, `IconButton`, `TextField`, `SearchField`, `SelectField`
- `Card`, `StatCard`, `Avatar`, `ToolPhoto`, `StatusBadge`, `FilterChip`
- `Tabs`, `SegmentedControl`, `Toggle`, `DataTable`, `EmptyState`
- `Modal`, `BottomSheet`, `SideDrawer`, `ConfirmDialog`, `Toast`
- `FormField`, `PhotoDropzone`, `Timeline`, `TimelineItem`

These components own semantic markup, focus behavior, keyboard behavior, and visual variants. Feature pages should not rebuild dialogs, chips, badges, or fields with one-off inline styles.

### Authentication

- `LoginPage`, `DemoProfileCard`, `DemoNotice`
- later: `SignInForm`, `PasswordResetFlow`, `InviteAcceptanceFlow`, `CompanySetupFlow`

### Worker tools and custody

- `MyToolsPage`, `HeldToolCard`, `PendingHandoffCard`
- `CheckoutPage`, `ToolCatalog`, `ToolGrid`, `ToolList`, `CatalogFilters`
- `WorkerToolDetailSheet`, `CustodySummary`, `ToolMetadata`, `CustodyTimeline`
- `RequestToolDialog`, `TransferSheet`, `TransferTargetPicker`
- `CustodyEvidenceFields`, `IncomingTransferReview`, `FlagToolDialog`
- `AddToolWizard`, `MockPhotoCapture`, `ToolDetailsForm`
- `WorkerActivityPage`, `ActivityFilters`, `ActivityFeed`

### Warehouse operations

- `WarehouseQueuePage`, `QueueStats`, `QueueGroup`, `QueueItemCard`
- `QueueReviewSheet`, `InventoryPage`, `InventoryTable`, `InventoryFilters`
- `FlaggedToolsPage`, `EditToolDialog`, `DecommissionToolDialog`
- `WarehousePeoplePanel`, `WarehouseSelector`

Desktop and mobile warehouse references should reuse these components. Responsiveness belongs in layout and component CSS; there should not be separate desktop and mobile business logic.

### Administration

- `AdminDashboardPage`, `DashboardStats`, `WarehouseCoverage`, `LongHeldTools`
- `PeoplePage`, `PeopleTable`, `PersonDrawer`, `InvitePeopleDialog`, `RemovePersonDialog`
- `PermissionsPage`, `PermissionMatrix`
- `WarehousesPage`, `WarehouseCard`, `WarehouseDialog`
- `AdminActivityPage`, `AuditLogFilters`, `AuditLog`
- `ReconciliationPage`, `DuplicateRecordCard`, `MergeRecordsDialog`, `CustodyMismatchCard`
- `SettingsPage`, `CompanySettingsForm`, `CategoryManager`, `DangerZone`

## 7. Data model

Use stable IDs and normalized relationships for at least:

- `User` and `Role`
- `Warehouse`
- `ToolDefinition` (name, brand, model, category, image)
- `ToolUnit` (tool ID, serial, price, condition, lifecycle status)
- `CustodyRecord` (current holder: person or warehouse)
- `Transfer`
- `ToolRequest`
- `ConditionReport`
- `AuditEvent`
- `ReconciliationIssue`
- `PermissionPolicy`

Separate the repeated tool definition from individual units. The prototypes already imply this distinction with quantities and “unit 1/3”; the React model should represent it explicitly rather than infer it from matching strings.

Inject a clock and ID generator into the mock adapter. Tests can then assert deterministic event ordering and IDs instead of depending on `Date.now()`.

## 8. Styling and assets

- Translate the existing dark/light palette into CSS custom properties in `tokens.css`.
- Preserve Space Grotesk for interface copy and IBM Plex Mono for IDs, labels, and timestamps.
- Preserve the custody prototype’s blue operational accent and restrained status colors. Treat the orange marketing concept as separate brand reference, not a reason to recolor every application state.
- Replace prototype inline styles with CSS Modules organized beside components.
- Define consistent spacing, radii, focus rings, shadows, transition durations, and responsive breakpoints.
- Respect `prefers-reduced-motion`.
- Use real `<button>`, `<a>`, form labels, dialog semantics, focus trapping, and visible keyboard focus.

Asset work:

1. Choose one canonical source for each of the 16 unique images.
2. Rename the three generated filenames to meaningful tool names.
3. Generate a small card thumbnail and a larger detail image in WebP (and optionally AVIF).
4. Keep explicit width/height and `loading="lazy"` to prevent layout shift.
5. Keep the original PNGs untouched until final visual approval; do not ship their duplicates in `dist/`.

## 9. Implementation batches

### Cross-phase prerequisite — TanStack Query cutover (React Query)

React Query is now the TanStack Query package and boundary used by this rebuild. The cutover is a hard prerequisite, not an optional later optimization: no new feature phase may start until its reads and commands use the certified query/mutation hooks and shared invalidation authority.

Before advancing beyond the current custody slice, every adapter-backed read and mutation surface must cross one TanStack Query boundary. Direct component calls to `NelsonApi` are not an accepted steady state. The cutover owns:

- one domain-level query-key vocabulary for tools, catalog, detail, pending handoffs, activity, admin summaries, and transfer targets;
- `useQuery` wrappers for every adapter read and `useMutation` wrappers for every command, including loading, error, retry, and disabled-repeat behavior;
- success invalidation for all projections affected by custody commands and tool creation, including all pending-handoff profiles, transfer-target lists, and the affected detail record;
- query-backed component tests that prove a mutation refreshes visible projections through the injected API and that failed mutations preserve drafts/evidence;
- a single `QueryClient` per app/test harness with deterministic test cleanup, no feature-local caches, and no component-owned fixture arrays;
- an explicit adapter-boundary test proving components import hooks/contracts only, never transport DTOs or `fetch`.

Cutover acceptance: a controlled mock-API mutation is visible after navigation and role switching without a manual reload; stale transfer targets and pending cards cannot remain actionable after success; active and inactive queries fail closed while loading, paused, or errored; failed commands leave the form draft intact; and the full quality gate plus fresh responsive browser run remain green. No later batch may introduce a direct adapter call or a new query-key literal without extending the shared vocabulary and its proof.

Certified baseline: **prerequisite closed; preserve it in every later batch**. `PHASE_3_LEDGER.md` binds the 262-entry source candidate to fingerprint `951AC0F570FDBFCBF91839C2ADE34F150B192F1BD551F9F14482B19AA3BBD8D1` after independent query, test, composition, closure, quality-gate, audit, and responsive-browser review. `src/app/providers.tsx` remains the owner of the single application `QueryClient`, `src/test/render-app.tsx` remains the per-harness client boundary, `src/api/query-keys.ts` remains the only query-key vocabulary, and feature hooks remain the only production callers of `NelsonApi`. Later work must extend those authorities and their active/inactive refetch, paused/offline, error, failed-draft, disabled-repeat, and adapter-boundary proofs; it must not introduce a parallel cache, direct component adapter call, feature-local query-key literal, or success path that leaves an affected projection stale.

Current status: **Batch 3, the TanStack Query prerequisite, Batch 4 Admin core, and Batch 5A Warehouse operations foundation are closed**. `PHASE_5A_LEDGER.md` binds the final 353-entry candidate to fingerprint `48CF710475F0DB5D9C3589B86CA2A5A7E4820E25AD1CDF62BEC585B6CA56F7CD` after fresh independent Luna QA-loop, QA-tests, and code-quality reviews followed by Sol-high certification. The Phase 3, Phase 4, and Phase 5A ledgers/fingerprints are historical evidence and must not be rewritten by later work. Batch 5 is split into proof-bearing slices: 5A owns the WarehouseApi boundary, assigned-warehouse responsibility, request/return queue decisions, and responsive inventory reads; 5B owns inventory commands and flagged tools; 5C owns reconciliation, full audit history, settings, and reset-demo-data. No later batch may add a direct adapter call or a parallel cache: every new read or command must extend the certified TanStack Query boundary and its shared key/invalidation proofs.

### Batch 1 — Foundation and role entry

Build the smallest complete vertical slice:

- Vite/React/TypeScript scaffold and quality scripts;
- design tokens and core UI primitives;
- hash router, providers, route guards, theme support;
- typed domain models and mock API composition;
- shared seed database;
- `/login` with Ray and Sam profile cards;
- worker and admin shells with sign-out;
- one real tool list backed by the adapter on each landing page.

Acceptance: the app builds statically, starts on login, both profiles route correctly, guarded routes work, and both roles read the same tool records.

### Batch 2 — Worker browse and detail experience

- My tools and pending handoffs;
- checkout catalog with grid/list modes, search, warehouse/category/availability filters;
- tool details, custody holder, metadata, and timeline;
- worker activity filters;
- responsive mobile navigation and account sheet.

Acceptance: Ray can browse the supplied photo catalog, inspect individual units, filter the catalog, and open every worker information surface.

### Batch 3 — Custody workflows

- request a warehouse tool;
- transfer to a person or warehouse;
- accept, decline, cancel, and withdraw handoffs;
- attach mock note/photo evidence;
- report damaged or lost;
- add-tool wizard with simulated photo capture/upload;
- adapter mutations and audit-event creation.

Acceptance: actions update custody, pending queues, statuses, and activity consistently across role switches and survive page navigation.

### Batch 4 — Admin core

Adversarial constraint: an administrator change must not create a second people/warehouse authority, orphan a custody or warehouse reference, erase audit history, authorize an inactive person, or report success while any active or inactive affected query still exposes an actionable stale projection. The Admin slice therefore begins at the normalized database and adapter boundary, not at the pages.

Destination ownership:

```text
src/domain/
  people.ts                         member roles, lifecycle, and admin-person policies
  permission-policy.ts              structural capability matrix; no page-owned policy literals
  warehouse.ts                      warehouse identity and manager eligibility
  read-models/
    admin.ts                         dashboard, long-held, people, permission, warehouse views
src/api/
  contracts/admin-api.ts            admin reads, commands, inputs, and correlated receipts
  query-keys.ts                      admin summary/people/person/permissions/warehouse key families
  mock/
    admin-queries.ts                 read projections from one immutable database snapshot
    admin-mutations.ts               atomic invite/access/role/remove/warehouse transactions
    mock-admin-projections.ts        domain-to-read-model mapping only
  http/
    http-admin-types.ts              wire DTOs only
    http-admin-mappers.ts            strict DTO and command-receipt validation
    create-http-admin-api.ts         HTTP transport implementation of `AdminApi`
src/features/
  admin/                             shared admin invalidation and policy-facing composition only
  admin-dashboard/                   summary, coverage, long-held, and recent-activity UI
  admin-people/                      people page, selectors, drawer, invite/access/role/remove dialogs
  admin-permissions/                 truthful policy-derived permission matrix
  admin-warehouses/                  warehouse cards and create/edit dialog
```

Keep existing focused files when they already own the named responsibility; split only when the added code would mix projection, mutation, transport, or component ownership. Production files remain below 400 lines, functions should remain below 60 lines and five arguments unless a documented boundary justifies otherwise, and shared mechanics move to `src/features/admin/` only when they are genuinely cross-admin.

The caller-facing contract should converge on one injected `AdminApi`; reads and commands carry the acting administrator explicitly for mock authorization, while transport mapping remains an adapter detail:

```ts
interface AdminApi {
  getSummary(input: { actorId: string }): Promise<AdminSummary>;
  listPeople(input: { actorId: string }): Promise<AdminPersonView[]>;
  getPerson(input: { actorId: string; personId: string }): Promise<AdminPersonDetail>;
  invitePerson(input: InvitePersonInput): Promise<AdminMutationReceipt>;
  updatePersonRole(input: UpdatePersonRoleInput): Promise<AdminMutationReceipt>;
  setPersonAccess(input: SetPersonAccessInput): Promise<AdminMutationReceipt>;
  removePerson(input: RemovePersonInput): Promise<AdminMutationReceipt>;
  getPermissionMatrix(input: { actorId: string }): Promise<PermissionMatrixRow[]>;
  listWarehouses(input: { actorId: string }): Promise<AdminWarehouseView[]>;
  createWarehouse(input: CreateWarehouseInput): Promise<WarehouseMutationReceipt>;
  updateWarehouse(input: UpdateWarehouseInput): Promise<WarehouseMutationReceipt>;
}

const people = useAdminPeople();
const { remove } = useAdminMutations();
await remove.mutateAsync({ personId, reason, note });
```

Implement in dependency and authority order:

1. **Normalize people and lifecycle authority.** Extend the canonical member role vocabulary to worker, warehouse manager, and administrator; add active, invited, suspended, and removed lifecycle states; seed enough non-demo people to make every state and filter non-vacuous; and keep Ray and Sam as the only demo profiles. Sign-in/restore, transfer targets, warehouse-manager choices, and admin commands must consult the same lifecycle authority. Invited, suspended, and removed people cannot authenticate or become new transfer targets. Removed people remain as retained records so custody, handoff, and audit history never point at a deleted identity. Reject self-demotion/self-suspension/self-removal and any change that would remove the final active administrator. Reject a role change that would violate existing holder or pending-handoff invariants instead of silently rewriting custody. Prove referential integrity, stable IDs, deterministic reset, role/lifecycle exhaustiveness, and authorization in domain/mock tests before building UI.

2. **Expand `AdminApi` symmetrically.** Keep `getSummary` and the certified `adminSummary` key stable, extend its read model with pending-approval and long-held projections, and add focused people, permission, and warehouse operations. Every mock command must re-read and validate inside one `MockDatabase.update`; every successful command writes audit events using the injected clock/ID generator and returns a receipt correlated to the requested person/warehouse and all affected tool/handoff IDs. Invite normalizes and de-duplicates email addresses. Suspension preserves held custody for later reconciliation but voids pending actions that an inactive person could complete. Removal requires a reason, retains the person as removed, atomically returns held active units to the person's home warehouse, terminally voids affected pending handoffs, and preserves their history. Warehouse create/edit keeps stable warehouse IDs, requires a unique normalized name and nonblank address, and permits only an active warehouse manager or administrator as manager; this batch does not delete warehouses. Implement equivalent HTTP DTO/body mapping and reject malformed enums, instants, duplicate IDs, impossible relationships, and mismatched command receipts.

3. **Extend the certified query boundary before adding consumers.** Add only shared `queryKeys` families for admin people, person detail, permissions, and warehouses, plus the roots needed for broad invalidation of auth sessions and admin collections. Admin hooks own every `useQuery`/`useMutation`; components never call `api.admin`, import mock data, or construct query-key arrays. Await success invalidation before presenting a command as complete. Invite/role/access changes invalidate people/detail, admin summary/recent activity, demo-profile/session eligibility, transfer targets, and affected pending views. Removal additionally uses the existing custody/tool invalidation authority for tools, catalog, details, activity, all pending profiles, and transfer targets. Warehouse create/edit invalidates warehouse/admin/people/session projections and every tool/catalog/detail/activity projection that presents warehouse names. Preserve `refetchType: 'all'` where inactive stale data could later become actionable.

4. **Complete the dashboard without creating a dashboard authority.** Derive statistics, pending approvals, coverage, long-held rows, and recent activity from one adapter snapshot. Long-held ordering uses canonical custody instants and the injected clock, excludes warehouse-held or archived units, and has deterministic tie-breaking. Coverage counts must reconcile with the same active-unit/custody rules already certified for tools and catalog. Replace the temporary “Next in the build” callout with real navigation or current operational facts. Prove aggregate consistency, chronology, empty states, loading/error/retry behavior, and the existing custody-command-to-admin-summary invalidation path.

5. **Build people as a query-backed workflow.** `/admin/people` owns local search/filter/drawer/form state only. `PeoplePage`, `PeopleTable`, and `PersonDrawer` render adapter read models; invite, role, access, and removal dialogs collect intent and call mutations. Search covers name/email/role, filters distinguish invited/admin-capable/no-access, and empty results are explicit. Drawers and dialogs use the established overlay focus/Escape/restore semantics. Commands fail closed while pending, paused, refetching, or errored; repeat submission is disabled; a failed command preserves entered email/reason/note and the selected person remains stable across authoritative refetch.

6. **Expose a truthful permission matrix.** `/admin/permissions` reads a domain-policy projection for Worker, Warehouse manager, and Admin. Structural rules—especially accepting-party custody rules, immutable audit history, and admin-only people administration—are visibly locked. Batch 4 does not claim editable authorization policy: mutable permission toggles require an enforcement authority across existing worker and later warehouse commands and are deferred until that authority is deliberately specified. Tests must prove the matrix is generated from the same role/capability vocabulary rather than duplicated JSX booleans.

7. **Build warehouse administration, not warehouse operations.** `/admin/warehouses` lists canonical warehouse cards and opens accessible create/edit dialogs. Forms keep drafts local, submit IDs rather than labels, and render server/mock validation errors without losing input. Manager choices come from the active eligible-person query. Created warehouses must immediately appear in cards, coverage, people/home-yard choices, and later transfer targets through invalidation; edits must propagate renamed warehouse/manager facts without changing IDs. Request/return queues, inventory actions, flagged tools, and reconciliation remain Batch 5.

8. **Cut over routes, navigation, and proofs together.** Enable Dashboard, People, Permissions, and Warehouses in desktop/mobile admin navigation; keep Operations, Reconciliation, Activity, and Settings visibly unavailable until their owning batches. Add guarded deep-link tests for every new route and preserve worker/admin denial in both directions. Extend the adapter-boundary scanner for every new admin hook/port and add causal active/inactive cache tests that mutate the shared database, observe changed values without remount masking, and cover loading, paused/offline, refetch error, failed draft, and disabled-repeat behavior. Run focused domain/mock/HTTP/component tests, structural searches for direct adapters/fetch/fixture imports/query-key literals, TypeScript/lint/format, the full Vitest/build gate, both high-severity audits, and fresh 320/390/768 admin browser checks for responsive table/card fallbacks, dialog/drawer containment, keyboard focus, and clean console output. Only then create and independently close a new Phase 4 ledger/fingerprint; do not edit the closed Phase 3 evidence.

Acceptance: Sam can navigate Dashboard, People, Permissions, and Warehouses; all facts come from the shared database through query-backed `AdminApi` hooks; valid local admin changes survive navigation and appear in every affected active or inactive projection; invalid, unauthorized, stale, or repeated commands fail closed without losing drafts or corrupting custody/history; and Batch 5 can add queue/reconciliation consumers without changing Batch 4 ownership.

### Batch 5 — Warehouse operations and reconciliation

#### Batch 5A — Warehouse operations foundation

- add `WarehouseApi` with actor-scoped warehouse scopes, queue, inventory, and summary reads;
- give each tool unit an immutable origin warehouse plus an assigned warehouse that moves with an accepted return;
- classify pending warehouse requests and worker-to-warehouse returns in one domain-owned queue policy;
- approve, accept, or decline queue items atomically with stale-custody checks and correlated audit receipts;
- expose responsive Queue and Inventory routes through TanStack Query hooks and shared invalidation.

Acceptance: the worker request from Batch 3 can be approved by Sam, the resulting custody change is visible to both profiles, and inventory/catalog/admin projections agree on the assigned warehouse. Keep the Batch 5A ledger open until fresh Luna QA-loop, QA-tests, and code-quality reviewers clear the exact candidate and a fresh Sol-high reviewer certifies it.

#### Batch 5B — Inventory decisions

- edit, flag, return, and decommission actions;
- flagged-tools route with condition evidence and lifecycle-safe actions.

Implementation boundary: `ToolsApi.updateTool`, `flagTool`, and `restoreTool` own record and condition decisions; `WarehouseApi.returnTool` and `decommissionTool` own manager-scoped custody/lifecycle decisions. The flagged route consumes the certified `warehouseInventory` TanStack query family and every command awaits the shared tool/warehouse invalidation fanout. No component may call an adapter directly or maintain a second flagged-tools cache.

#### Batch 5C — Reconciliation, audit, and settings

- full audit log search/filtering;
- duplicate-record merge and custody-mismatch resolution;
- company, categories, theme, account, and reset-demo-data settings.

### Batch 6 — Parity, accessibility, and static delivery

- optional signup/company setup, invite acceptance, and password-reset demo screens;
- empty, loading, and error states for every adapter-backed page;
- keyboard/focus and screen-reader review;
- image optimization and bundle review;
- responsive verification at phone, tablet, and desktop widths;
- unit, component, and critical-flow tests;
- production build and static-host smoke test.

Acceptance: all reference screens have a React equivalent or an explicitly recorded exclusion, critical paths are tested, no component bypasses the API layer, and `dist/` works without network access.

## 10. Verification strategy

Use Vitest and React Testing Library for domain policies, adapters, selectors, forms, dialogs, and route guards. Use a small Playwright suite for the role-level click-throughs.

Critical scenarios:

1. Login is the first screen.
2. Worker and admin profile cards land on different guarded routes.
3. Sign out returns to login.
4. Worker requests an in-stock tool; admin sees and approves it; worker becomes holder.
5. Worker sends a transfer; accepting it changes custody and writes an audit event.
6. Damage/loss reporting changes status everywhere.
7. Search and filters produce correct empty and populated results.
8. Reconciliation actions remove resolved issues without corrupting history.
9. Reset demo data restores the deterministic seed.
10. The production build makes zero runtime API requests.

Also enforce TypeScript checking, linting, formatting, and a production build in the normal verification command.

## 11. Deliberate non-goals for the static rebuild

- Real authentication, authorization enforcement, email, or password handling
- A database or network API
- Real photo capture/upload storage
- Push notifications
- Multi-user concurrency
- Offline conflict resolution
- The public marketing website

The adapter boundaries and normalized domain model should make these future additions possible without pretending they exist in the static demo.

## 12. Recommended next step

Implement Batch 5A — the WarehouseApi queue/inventory foundation — from the closed Phase 4 boundary. Establish assigned-warehouse responsibility and queue authority before adding inventory commands, reconciliation, audit search, or settings. Keep each Batch 5 slice OPEN until its fresh Luna QA-loop, QA-tests, code-quality reviews, and Sol-high certification close the corresponding ledger. Batch 6 remains the final parity, accessibility, and static-delivery polish phase; it must also extend TanStack Query rather than introduce a parallel data boundary.
