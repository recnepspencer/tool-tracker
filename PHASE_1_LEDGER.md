# Phase 1 — Foundation and role entry closure ledger

Status: `CLOSED`

Frozen candidate fingerprint: `01669318DB10E95810AA388F6AABFAE5466A69CC653A2C8DC0C2B4744229C072`

Scope: React/TypeScript bootstrap, API seams, normalized mock state, demo login, role guards, responsive shells, worker/admin landing views, theme support, local typography/assets, and executable proof.

## Boundary brief

- The existing `.dc.html` files and `support.js` are visual reference prototypes, not a runtime authority for the new app.
- The public marketing `index.html`, root `styles.css`, and root `script.js` are outside this application slice.
- Phase 1 owns the React entry point, route/session boundaries, typed API contracts and mappers, mock adapter/database, normalized seed projections, shared primitives, and landing-page composition.
- Later custody, warehouse, and admin workflows must consume the same `NelsonApi` and mock database; they must not add role-local fixture arrays.
- `HashRouter`, relative Vite output, and local assets keep the built app usable on static hosts without rewrite rules or runtime network calls.

## Guarantee ledger

| ID | Closure claim | Evidence | Result |
| --- | --- | --- | --- |
| P1 | A fresh visit enters through login. | Root route test starts at `#/`, asserts the login heading and final `#/login` hash. | `PROVED` |
| P2 | Ray Torres and Sam Ochoa are hardcoded demo profiles with complete validated sessions. | The normalized seed declares an explicit private demo-profile ID set; mock tests assert complete profile views, both sign-in sessions, both restores, unknown-profile rejection, and ordinary users being excluded/rejected. | `PROVED` |
| P3 | Role selection lands on the correct page and both cross-role directions are guarded. | Route tests cover worker entry, admin entry, admin-to-worker denial, worker-to-admin denial, and unauthenticated deep links. | `PROVED` |
| P4 | Worker and admin projections read one coherent normalized tool world. | `SeedState` uses users, warehouses, definitions, units, custody, and ID-based events; module-private seed authority validates unique IDs and exactly one custody record per unit; active lifecycle is shared by tool totals and warehouse stock/out projections; tests assert canonical holders, counts, archive behavior, warehouse rows, events, duplicate units, and rename propagation. | `PROVED` |
| P5 | Components do not own transport or fixture authority. | Pages use feature query hooks; API access is confined to hooks/providers/session; fixture authority stays under `api/mock`; no component transport calls. | `PROVED` |
| P6 | A future HTTP backend can replace the mock adapter at the contract boundary. | Focused auth/tools/admin contracts and HTTP adapter mappers cover profile, sign-in, restore, sign-out, tools, and summary wire DTOs. | `PROVED` |
| P7 | Session persistence is replaceable, restore is safe, and sign-out clears it. | Injected `SessionStore` tests cover valid/unknown restore, restore rejection recovery, sign-out cleanup, and remount behavior; `AuthApi.signOut` is wired. | `PROVED` |
| P8 | Production paths expose loading, query-error, and restore-error states. | Route tests inject rejecting login/worker/admin adapters, a deferred worker adapter, and a rejecting restore adapter with a retry surface. | `PROVED` |
| P9 | Landing pages are composed from named shared/feature components and stay within size guidance. | `PageHeading`, `MetricGrid`, `Callout`, `WorkerToolGrid`, `WarehouseCoverage`, `RecentActivity`, feature hooks, extracted shells/account menu, and focused test renderers are present; scoped TS/TSX/CSS files are below 400 lines. | `PROVED` |
| P10 | The UI is portable across narrow and wide static viewports. | Fresh root-browser inspection at 320, 390, and 768 CSS-pixel overrides reports equal document/client widths for login, worker, and admin routes. At 320, worker/admin body and document width are 305px; account right edge is 288.67px and worker badge right edge is 225.32px. At 768, the worker grid is tablet-single-column and every status badge remains inside its card (`badgeRight 705.28 <= cardRight 721.95`). | `PROVED` |
| P11 | Supplied tool photos and typography render locally without runtime network access. | Seven canonical PNGs are copied under `public/tool-images`; built output includes them; `@fontsource` packages are bundled; source has no fetch/XHR/WebSocket. | `PROVED` for Phase 1 assets; derivative optimization remains later work. |
| P12 | Static production URLs work under relative hosting. | `vite.config.ts` sets `base: './'`; built `dist/index.html` references `./assets/...`; tool read models use `./tool-images/...`. | `PROVED` |
| P13 | Theme selection is deterministic and shell-accessible. | `ThemeProvider`, light token mode, `data-theme`, persistence, and authenticated-shell toggle are covered by route tests. | `PROVED` |
| P14 | The mock database is ready for coherent future mutations. | Typed `update`, `reset`, injected `clock`, and injected `nextId` boundary exist; default IDs skip seeded collisions and reset deterministically; unique-ID, referential-integrity, exact-one-custody, reset, append, and dependency tests pass. | `PROVED` for the Phase 1 boundary; custody mutation behavior is later work. |
| P15 | The executable quality gate is green. | `npm run check` combines typecheck, ESLint, Prettier, 28 Vitest tests across 5 files, and Vite build; production-only npm audit reports zero vulnerabilities. | `PROVED` |

## Primary search-coverage manifest

Paths inspected: `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`, `index.html`, `src/**`, `public/tool-images/**`, and the existing prototype/reference directories.

Symbols and boundaries inspected: `AppProviders`, `AppRoutes`, `RequireSession`, `RequireRole`, `RoleShell`, `RoleShellRoute`, `SessionProvider`, `SessionStore`, `ThemeProvider`, `ApiProvider`, `NelsonApi`, focused API contracts, `createMockApi`, `createMockDatabase`, `createHttpApi`, normalized domain entities, read-model projections, feature query hooks, and all Phase 1 tests.

Searches run: direct transport/effect calls (`fetch`, XHR, WebSocket, storage, timers), fixture imports, route references, API/context consumers, `TODO`/`FIXME` markers, TS/TSX/CSS line counts, long-line review, generic-layout feature imports, hardcoded fixture claims, build URL inspection, and dirty-worktree inventory.

Evidence families run: mock adapter unit tests, HTTP adapter mapping tests, route/role integration tests, deferred and rejecting adapter tests, browser responsive checks, TypeScript compiler, ESLint, Prettier, Vite production build, production-only npm audit, and static output asset inspection.

## Known open or intentionally deferred rows

- Photo derivatives/thumbnails are deferred to the asset/performance batch; originals are preserved and canonical copies are shipped in this first slice.
- Custody mutations, warehouse queues, people, permissions, reconciliation, and full activity are later batches, not hidden claims of Phase 1.

## Reviewer history

| Pass | Reviewer | Source fingerprint | Findings | Status |
| --- | --- | --- | --- | --- |
| Primary self-audit | Root agent | Pre-review fingerprint `929e229da580fe6dfb93981037a2956d04cc8689c5f3b6ebefbc62e85fbeb390` | Fixed initial count authority, future-nav semantics, adapter seam, and page composition before freeze. | Complete |
| Luna QA loop (fresh) | `/root/qa_loop_luna` | Pre-review fingerprint above | Reopened mobile overflow, restore rejection, theme, normalized state, dynamic facts, relative base, query hooks, quality scripts, sign-out contract, typography, and ledger proof. | Findings accepted; corrections applied |
| Luna QA tests (fresh) | `/root/qa_tests_luna` | Pre-review fingerprint above | Reopened root/role route proof, sign-out/restore assertions, restore rejection, query error/loading injection, HTTP coverage, identity/shared-world oracles, event referential integrity, production provider harness, and hardcoded facts. | Findings accepted; corrections applied |
| Luna code quality (fresh) | `/root/code_quality_luna` | Pre-review fingerprint above | Reopened domain normalization, availability authority, layout dependency direction, persistence/mutation seams, HTTP DTO mapping, contract topology, query hooks/test renderer, CSS boundaries, and roadmap callout ownership. | Findings accepted; corrections applied |
| Fresh Luna closure trio | `/root/qa_loop_luna_closure`, `/root/qa_tests_luna_closure`, `/root/code_quality_luna_closure` | `F06CAC9FC027ABA33CE4A3C559398E193798E1C650D293516A9D8F2BA9C221AD` | Rechecked responsive geometry, normalized-state invariants, test oracles, API/session/theme boundaries, feature topology, CSS ownership, fixture authority, and size discipline. | CLEAR |
| Fresh Sol high closure | `/root/sol_closure` | `F06CAC9FC027ABA33CE4A3C559398E193798E1C650D293516A9D8F2BA9C221AD` | Found demo-profile authority, default ID collision, and archived warehouse-count gaps; corrections are applied and require a fresh final Sol pass. | SUPERSEDED |
| Fresh Sol final | `/root/sol_last` | `01669318DB10E95810AA388F6AABFAE5466A69CC653A2C8DC0C2B4744229C072` | Independently verified the final authority seams, 28-test gate, zero audit vulnerabilities, relative/local assets, no console warnings, and contained responsive geometry at 320/390/768px including tablet descendants. | CLEAR |
