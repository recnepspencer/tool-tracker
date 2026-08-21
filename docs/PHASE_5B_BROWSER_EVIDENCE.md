# Phase 5B browser evidence

Fresh local run on Vite port 5174 as Sam Ochoa:

- `/admin/operations/flagged` rendered the two seeded flagged units, with warehouse scope/search controls and lifecycle-safe actions: Cable cutter exposed Restore to stock and Decommission; Fish tape exposed Force return.
- Clicking Restore to stock removed Cable cutter from the flagged route and reduced the decision count from 2 to 1. The action refreshed the TanStack-backed inventory projection without a reload.
- Responsive checks at 320, 390, and 768 CSS pixels found `document.documentElement.scrollWidth === document.documentElement.clientWidth` at every width; the visible local tool image completed with a nonzero natural width at each size.
- Browser warning/error logs were empty for the run. The temporary viewport override was reset afterward.

Fresh composition-correction pass on Vite port 5174 (2026-08-20) as Sam Ochoa:

- `/admin/operations/flagged` still rendered 2 flagged units from the shared warehouse inventory query; `/admin/operations/inventory` rendered 16 units with All 16, In stock 9, Checked out 5, Flagged 2, and Archived 0.
- Every inventory image completed with a positive natural width, and the browser captured no warning or error logs.
- Flagged and inventory routes both remained horizontally contained at 320, 390, and 768 CSS pixels (`scrollWidth === clientWidth`); the temporary viewport override was reset afterward.

Strict revision-token pass on the live Vite tabs (2026-08-20):

- The inventory route rendered all 16 local tool images; `scrollWidth` matched `clientWidth` at the desktop viewport, and the flagged route remained contained as well.
- Browser logs contained only Vite/React development diagnostics—no warning or error entries from the application after the revision-token and stale-dialog changes.

Fresh responsibility-boundary pass on a clean Vite tab (2026-08-20) as Sam Ochoa:

- `/admin/operations/flagged` rendered Cable cutter and Fish tape with Edit, Restore/Decommission, and Force return actions; the edit dialog opened and cancelled cleanly.
- `/admin/operations/inventory` rendered all 16 units with the expected All 16 / In stock 9 / Checked out 5 / Flagged 2 / Archived 0 counts. Local tool images completed with positive natural widths.
- Both routes remained horizontally contained at 320, 390, and 768 CSS pixels (`scrollWidth === clientWidth`); the temporary viewport override was reset. The clean tab recorded zero warning/error console entries.

Candidate binding for the fresh responsibility-boundary pass:

- `.phase-5b-fingerprint.txt` contained 380 entries with manifest SHA `0B7B86AC6A6FBC1DC02AF18ADAA12FD53DDAB3C182DED419700B5E45724C1C03` after the source gate and before the independent review trio.

Fresh post-correction pass on Vite port 5174 (2026-08-20) as Sam Ochoa:

- `/admin/operations/flagged` rendered 2 flagged units; `/admin/operations/inventory` rendered 16 units with All 16, In stock 9, Checked out 5, Flagged 2, and Archived 0.
- After scrolling through the inventory at 320, 390, and 768 CSS pixels, all 16 canonical local PNGs completed with positive natural widths. Both routes reported equal document and client widths at every viewport, and the edit dialog kept focus inside its dialog before cancellation.
- The clean tab recorded zero warning/error console entries; the temporary viewport override was reset afterward.

Candidate binding for this post-correction browser pass:

- `.phase-5b-fingerprint.txt` contains 384 entries with manifest SHA `0613C542B7A7B73DD0A4A9DC93630EC4B81FC187C2BC74B7A5288BCE20B58E50`.

Fresh exact-candidate parity pass on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (the 15px scrollbar is reflected in `clientWidth` on the long pages).
- After repeated viewport scrolling, Inventory rendered all 16 canonical local tool PNGs with `complete === true` and positive natural widths at all three viewports. No non-local image source was observed.
- The clean tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for the exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 389 entries with manifest SHA `8DBDE958251E4C099B15DE495006D30C7B93908D4A3B104ED77A7C5D52A2240E`.

Fresh exact-candidate parity pass on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After repeated viewport scrolling, Inventory rendered all 16 canonical local PNGs with `complete === true` and positive natural widths at every viewport. Flagged rendered both canonical flagged images; no non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 389 entries with manifest SHA `E6B69B398EA35FC6B19BA1D9C1AA0394041D5DEBFF06AFE92DE31D3770853EE0`.

Fresh exact-candidate parity pass on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After repeated viewport scrolling, Inventory rendered all 16 canonical local PNGs with `complete === true` and positive natural widths at every viewport. Flagged rendered both canonical flagged images; no non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 390 entries with manifest SHA `D308FA154B67E4401751F310F377D9A8324D35A10952C09FE892FA630E1F850D`.

Fresh exact-candidate parity pass after the domain-authority correction on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After scrolling through Inventory, all 16 canonical local tool PNGs completed with positive natural widths; Flagged rendered both canonical flagged images. No non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this fresh exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 391 entries with manifest SHA `1043AB85CE8F140EB532D023E3AFC60EE8C13D014E241A6E2385897EEB3AB31C`.

Fresh exact-candidate parity pass after the decommission raw-state oracle correction on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After scrolling to the end of Inventory at each viewport, all 16 canonical local tool PNGs completed with positive natural widths; Flagged rendered both canonical flagged images. No non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this fresh exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 391 entries with manifest SHA `A21CD1BFD2E541E63A200E79EAA95C3391382876D6FECCEBD19F2A1329A8A919`.

Fresh exact-candidate parity pass after the lifecycle oracle and invalidation/scope-proof corrections on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After scrolling to the end of Inventory at each viewport, all 16 canonical local tool PNGs completed with positive natural widths; Flagged rendered both canonical flagged images. No non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this fresh exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 391 entries with manifest SHA `6C84D0F6F1B6AB5387367DF739E97354EC44CF9ACC2E02C38E20D2EB4DCA4416`.

Fresh exact-candidate parity pass after the domain-policy fixture correction on Vite port 5175 (2026-08-20) as Sam Ochoa:

- Queue, Inventory, and Flagged tools rendered at 320, 390, and 768 CSS pixels. Every route kept `scrollWidth === clientWidth` (queue `320/320`, `390/390`, `768/768`; long pages `305/305`, `375/375`, `753/753`).
- After scrolling to the end of Inventory at each viewport, all 16 canonical local tool PNGs completed with positive natural widths; Flagged rendered both canonical flagged images. No non-local image source was observed.
- The clean verification tab recorded zero warning/error console entries, and the temporary viewport override was reset. The machine-readable run record is [PHASE_5B_BROWSER_ARTIFACT.json](PHASE_5B_BROWSER_ARTIFACT.json).

Candidate binding for this fresh exact-candidate pass:

- `.phase-5b-fingerprint.txt` contains 391 entries with manifest SHA `3AD49857FEC2B037149D3481BD1E507E6F40519100C95B2FA18ACF606EA4F42E`.
