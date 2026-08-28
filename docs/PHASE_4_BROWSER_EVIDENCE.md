# Phase 4 browser evidence

Date: 2026-08-18

The in-app browser was run against the local production-compatible dev server at `http://127.0.0.1:5175/` after the final Batch 4 Admin correction pass and a fresh reload. Sam’s certified demo session was used.

## Route parity

- `/admin/dashboard` rendered Control room, 16 tracked tools, 6 checked out, 9 in stock, 2 flagged, three warehouse cards, newest-first Recent movement, one pending approval, and one long-held tool.
- `/admin/people` rendered the lifecycle-aware directory (active, invited, suspended, and removed members), search/lifecycle/role/capability filters, and the Invite person dialog. The no-access filter returned Casey, Quinn, and Taylor plus the active warehouse manager Morgan; the admin-capable filter returned Sam.
- `/admin/permissions` rendered Worker, Warehouse manager, and Administrator rows from the shared capability vocabulary.
- `/admin/warehouses` rendered three canonical warehouse cards and the Add warehouse/Edit dialogs.
- Desktop/mobile navigation exposed Dashboard, People, Permissions, and Warehouses while Operations remained visibly unavailable.
- At 320px, the mobile navigation opened as a modal drawer, moved focus to its close control, trapped Tab focus, closed on Escape, and restored focus to the Open navigation trigger.
- The account sheet used the same modal-focus contract: opening moves focus to Close account menu, Escape closes it, and focus returns to Open account menu.
- The Permissions route rendered the domain-owned locked structural rules for accepting-party custody, immutable audit history, and administrator-only people administration, with an explicit Locked indicator.
- The Invite person dialog focused its first input on open and closed on Escape, with focus restoration handled by the shared `OverlayDialog`. Warehouse create exposed only Morgan and Sam as eligible managers.

## Responsive geometry

| Viewport | Routes checked | `scrollWidth` / `clientWidth` |
| --- | --- | --- |
| 320 × 900 | dashboard, people, permissions, warehouses | 305/305, 305/305, 305/305, 305/305 |
| 390 × 900 | dashboard, people, permissions, warehouses | 375/375, 375/375, 375/375, 375/375 |
| 768 × 900 | dashboard, people, permissions, warehouses | 753/753, 753/753, 768/768, 753/753 |

No horizontal overflow was observed after the responsive toolbar correction. The permission table and people table remained contained by their horizontal-scroll fallback, and dialogs stayed within the viewport.

The fresh mobile drawer probe stayed contained at `305/305`; 390px and 768px checks remained within `375/375` and `753/753` (the permission route measured `768/768` at the widest viewport).

## Console

The fresh route run produced zero warning or error entries. No unexpected external image requests were observed on the admin routes (these routes intentionally contain no tool photos). The executable gate for this evidence pass is green at 63 test files / 254 tests, with typecheck, lint, format, and build passing. The final fresh sweep also verified the Admin route at 320/390/768, locked permission rules, and zero warning/error console entries.
