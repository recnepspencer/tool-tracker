# Phase 6A — public auth parity and login query safety ledger

Status: `OPEN`

Frozen candidate fingerprint: `D3B07DEAFAA99D56244DB8C76BDB1CB2AE69384565E260E2CA117FA639846307`

Frozen candidate entries: `467`

Scope: the ten root config/package files, `public/tool-images/**`, and `src/**`. Generated `dist/**`, ledgers, and browser/evidence docs are excluded. Phase 5C remains closed and must not be rewritten.

## Boundary brief

- `AuthApi` remains the only authority for demo-profile listing and session entry/restore/sign-out.
- `AdminApi.invitePerson` and `SettingsApi` remain untouched authorities; the new public flows are explicitly transient previews and make no adapter calls or flow-owned browser-storage writes. The shared theme provider may write only the permitted `nelson-demo-theme` key.
- `sessionStorage` still stores only the selected demo profile ID; no password, invite token, signup draft, or company data is persisted.
- TanStack Query remains the sole adapter-backed UI boundary. Login profile state is explicit for loading, refetching, paused, error, empty, and ready states; profile commands fail closed while the authority is unsettled.
- Public routes share one anonymous guard and role-home policy; authenticated users cannot remain on public walkthrough routes.

## Guarantee ledger

| ID | Closure claim | Evidence | Result |
| --- | --- | --- | --- |
| B6A-1 | Public login, signup/company setup, invitation preview, and password-recovery routes are hash-reloadable, anonymous-only, and role-home redirects are centralized. | `app-routes.tsx`, `route-guards.tsx`, `role-home-path.ts`, public auth surface tests, browser artifact. | `OPEN` |
| B6A-2 | Signup/company, invite acceptance, and password recovery are honest transient walkthroughs with local validation, focusable semantic controls, no auth/admin/settings calls, and no flow-owned storage writes (only the shared `nelson-demo-theme` key is permitted). | onboarding/invitation/recovery modules, exhaustive API sentinels, instrumented storage-write tests, browser journeys. | `OPEN` |
| B6A-3 | Login profile authority has explicit loading, refetch, paused, error/retry, empty/reload, and global sign-in pending behavior; stale cards cannot issue commands. | `LoginPage`, `AsyncState`, login query-safety tests, browser login evidence. | `OPEN` |
| B6A-4 | Shared async state semantics expose live/busy status, retry affordances, empty recovery, and reduced-motion-safe presentation. | `AsyncState.tsx/.css`, `AsyncState.test.tsx`, global reduced-motion rule. | `OPEN` |
| B6A-5 | The exact frozen candidate passes typecheck/lint/format/tests/build, both high-severity audits, exact manifest verification, and fresh independent reviews. | `npm run check` (102 files/400 tests/build), both audits 0 vulnerabilities, `.phase-6a-fingerprint.txt`, browser artifact, fresh Luna and Sol reviews. | `OPEN` |

## Reviewer history

| Pass | Reviewer | Source fingerprint | Findings | Status |
| --- | --- | --- | --- | --- |
| Primary Batch 6A implementation and causal-proof fixes | Root agent | `AFE3C4163B52B7C611752B9DD37DC96F9660A7F8A14EDA3DAA2240F365523948` | Implemented the public auth parity slice, explicit login query states, route policy, focus transitions, exhaustive API and storage-write sentinels, validation negatives, cached paused/error refetch proofs, complete role redirect matrix, session-race persistence proof, session-race safety, and shared admin style ownership. | IN PROGRESS |

This ledger remains `OPEN` until all B6A guarantees are independently reviewed by fresh Luna-max QA-loop, QA-tests, and code-quality critics, then a fresh Sol-high reviewer certifies this exact source candidate.
