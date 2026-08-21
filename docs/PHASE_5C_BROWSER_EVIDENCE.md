# Phase 5C browser evidence

Verified 2026-08-20 against the Vite app at `http://127.0.0.1:5174` in the Codex in-app browser. The machine-readable record is [`PHASE_5C_BROWSER_ARTIFACT.json`](C:/Users/Esther/Documents/nelson-electric/docs/PHASE_5C_BROWSER_ARTIFACT.json).

- Ray's worker routes (`tools`, `activity`, `checkout`, and `account`) and Sam's admin routes (`dashboard`, `reconciliation`, `activity`, `settings`, and warehouse operations) were opened at 320, 390, and 768 CSS pixels.
- Every checked route had `document.documentElement.scrollWidth <= clientWidth`; no horizontal overflow was observed.
- The worker tool surface exposed both seeded Hammer drill units with stable TL-101/TL-103 identities. The admin inventory contained 16 rows; after scrolling through the table, all 16 observed tool images loaded from local `/tool-images/` paths.
- The seeded reconciliation merge was exercised in the UI: the open count changed from 2 to 1 and the duplicate card disappeared. Reset demo data was then confirmed with the exact `RESET DEMO DATA` phrase, restoring the seed.
- Admin activity rendered newest-first, beginning with `Aug 17, 2026, 10:18 AM`.
- The final browser tab reported zero warning and error console entries.
- After the reset-safety correction, the settings route was reloaded and the exact `RESET DEMO DATA` journey was repeated successfully; the dialog closed and settings remained available.
- The post-fix settings route remained free of horizontal overflow at 320, 390, and 768 CSS pixels, with zero warning/error console entries.
- This post-fix evidence is bound to `.phase-5c-fingerprint.txt` (455 entries; manifest SHA-256 `EECC700F02CCE4683CE864C2DD45373DF6D26BB479DA0300270DCB2561CA9EF3`).
