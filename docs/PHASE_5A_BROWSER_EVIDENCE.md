# Phase 5A browser evidence

Date: 2026-08-19  
Local URL: `http://127.0.0.1:5177/`  
Profile: Sam Ochoa (administrator)

## Queue approval journey

- Signed in through the explicit Sam demo profile and opened `#/admin/operations/queue`.
- The seeded `HO-1` request rendered as `Bandsaw`, `TL-108`, Ray Torres, North Yard, and the canonical instant `Aug 17, 2026, 10:18 AM`.
- The Review action opened the accessible `Review Bandsaw` dialog; the Decision note field received focus.
- Approving `Release to worker` removed the queue item and changed the All waiting, Requests, and Returns counts to `0`.

## Inventory projection

- Opened `#/admin/operations/inventory` after approval.
- The first row rendered `Bandsaw · TL-108`, `North Yard`, `Checked out`, and `Ray Torres`, proving the queue mutation reached the warehouse inventory read model.
- Inventory filters showed 16 total units, 8 in stock, 6 checked out, 2 flagged, and 0 archived.
- The fresh run also exercised the flagged/all tabs, text search, and warehouse scope selector; each changed the visible rows without leaving the route.

## Responsive and asset checks

Queue and Inventory were checked at explicit viewport widths 320, 390, and 768 pixels:

| Surface                                | 320 | 390 | 768 |
| -------------------------------------- | --: | --: | --: |
| Queue `scrollWidth == clientWidth`     | yes | yes | yes |
| Inventory `scrollWidth == clientWidth` | yes | yes | yes |

All 16 Inventory images completed with positive natural dimensions. Every image URL was local to `/tool-images/`; no external image host was requested. The fresh Queue and Inventory runs captured zero `warn` or `error` console entries. The temporary viewport override was reset after the checks.
