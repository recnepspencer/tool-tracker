# Phase 4 primary search coverage

This is the primary implementation audit record. It is intentionally excluded from the Phase 4 source fingerprint.

## Boundary searches

- `rg "api\\.(auth|tools|activity|admin|custody)\\.|useApi\\(" src/features src/components src/app --glob '!**/*.test.*'` — adapter calls occur only in TanStack/query hook boundaries and the existing session/provider boundary.
- `rg "fetch\\s*\\(|from ['\"][^'\"]*api/http" src --glob '!**/*.test.*'` — no component transport bypasses.
- `rg "useQuery|useMutation|QueryClient|queryKeys" src/features src/app src/api` — all adapter-backed Admin reads/commands use the certified TanStack Query boundary and centralized keys.
- `rg "AdminApi|createMockAdminApi|createHttpAdminApi" src` — mock and HTTP adapters implement the same expanded facade.
- `rg "MEMBER_ROLES|MEMBER_LIFECYCLES|PERMISSION_CAPABILITIES|isActiveMember|isAdminMember|isEligibleWarehouseManager" src` — role, lifecycle, and permission vocabulary is domain-owned and reused by seed validation, commands, projections, and DTO mappers.
- `rg "STRUCTURAL_PERMISSION_RULES|structuralRules|structural_rules|Locked rules" src` — locked custody, audit, and people-administration rules have one domain authority and are carried through mock/HTTP projection and UI evidence.
- `rg "PeopleTable|Filter role|Filter lifecycle|MEMBER_ROLE_LABELS" src/features/admin-people` — people search covers role labels and local filters distinguish lifecycle/no-access and admin-capable roles.
- `rg "invalidateAdminProjections|adminPeopleRoot|adminPersonRoot|adminWarehousesRoot" src` — Admin mutations invalidate active and inactive summary, people, detail, warehouse, worker projection, pending, target, and profile caches with `refetchType: 'all'`.
- `rg "TODO|FIXME|Next in the build" src` — no stale Batch 4 placeholder remains in the Admin dashboard.

## Scope and composition

All new production and test files were counted and reviewed against the 400-line law. The largest production file is `src/api/mock/admin-mutations.ts` at 397 lines; the largest test file is `src/features/admin/admin-query-invalidation.test.tsx` at 344 lines. The existing adapter-boundary scanner, full type/lint/format/test/build gate (63 files / 254 tests), strict HTTP cross-resource and adversarial tests, mock receipt/audit/identity tests, Admin route/action tests, warehouse cross-projection test, modal rerender focus oracle, inactive custody-resolution oracle, and full active/inactive invalidation fanout test provide the executable proof surface.
