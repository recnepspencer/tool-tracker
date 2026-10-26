# Demo parity, not a replacement design

The checked-in demo at commit `80202f5` and the original local HTML designs are the visual and interaction references. The API-backed app must preserve their field and control-room experiences. Approved simplified account screens remain in place.

Prior completion claims were too broad: backend and selected browser journeys passed, but the replacement UI did not mirror the demo. Workflow evidence and visual parity are separate obligations.

| Surface | Required reference behavior | Verification still required |
| --- | --- | --- |
| Field shell | Narrow centered workspace, wordmark top bar, navigation drawer, account sheet, light/dark appearance | Desktop and mobile screenshots; keyboard navigation |
| My tools | Held units, pending movements, review, transfer, browse checkout | Incoming/outgoing and empty states with actual custody |
| Checkout | Search, filters, grid/list, photographed catalog, selection of a specific physical unit | Filter combinations, duplicate models, request sheet |
| Tool details | Sheet, metadata, timeline, transfer/return, condition evidence | Every action and denial; focus restoration |
| Add tool | Registration flow with actual photo and individual identification | Manager and employee policy states |
| Control room | Header/account controls, sidebar, warehouse-scoped navigation | Admin and warehouse manager scopes |
| Queue | Warehouse filters, review dialog, receipt/decision flow | Request, transfer, return, resolved history |
| Inventory | Photo table, holder/status/warehouse, grouped identical models, detail drawer | Expand units; edits preserve custody and shared definitions |
| Damaged/lost | Dedicated filtered inventory and resolution actions | Independent loss/damage state and service history |
| People | Directory table, person drawer, invite, access actions | Suspension, roles, employment end, accountability |
| Foremen/jobs | People/job directory, assignments, independent participation rules | Direct/approval/disabled joining and leaving |
| Warehouses | Table, warehouse management, authority and stock | Scoped permissions and archive/history |
| Access | Dedicated capability/role view | Server capabilities; no fake role switcher |
| Activity | Filtered readable feed | Own versus company access; worker materialization |
| Settings/account | Company rules, categories/models, appearance, password recovery | Actual persisted configuration and authorized changes |

This matrix is an acceptance checklist, not a declaration that every row is finished. Record visual evidence and workflow evidence separately before claiming parity.

## Current correction

The field shell, My tools, checkout, grouped inventory, tool sheets, queue review sheets, people table/invite/person sheets, warehouse directory, and role-capability screen now use the original visual structure and scoped design tokens. They continue to read and mutate the real API. The replacement dashboard has been removed.

`e2e/demo-parity.spec.ts` uses real photographed assets and accepted/pending handoffs. It checks the dark field palette, 520-pixel desktop field column, 62-pixel tool photos, mobile overflow, visible control-room navigation, sheet dismissal, catalog mode changes, and queue filters. Captures are written under `artifacts/parity-*.png`. Those checks cover specific reference characteristics; they do not certify every screen or interaction.

The next correction adds a real photo-first registration sheet with retained drafts and payload-bound retries, job/no-job directory filters, readable activity with server-side filters, an audited company profile command, and warehouse creation/archive/restore dialogs. Activity records capture warehouse context at command time; they do not derive historical warehouse labels from an asset's current location. Older events without that context are not backfilled with invented history.

Still open: the comprehensive role-by-workflow mutation audit in [CUTOVER_AUDIT.md](CUTOVER_AUDIT.md), remaining detailed administrative-dialog comparisons, and review of the demo's optional asset details. The current company settings page exposes real profile/policy controls and links to catalog/jobs; the full original settings composition still needs comparison. Existing API-backed forms are not proof of complete visual or workflow parity.

The catalog/custody correction restores the photo-and-metadata tool sheet with separate request, transfer, report and management actions. Transfer uses a searchable Person/Warehouse picker backed by eligible API identities. Catalog archive/restore, grant revocation, every ordinary request decision, transfer/return, and evidenced former-holder recovery now have browser coverage. Lists remain mounted under nested sheets so filters, view mode, expansion and keyboard focus survive. Screenshots include `artifacts/parity-tool-details-desktop.png` and `artifacts/parity-return-destination-mobile.png`. Remaining administrative/settings comparisons and optional asset fields are still open.

The job management correction replaces the old inline form stack with search, project/job dialogs, explicit archive/restore and a roster sheet. Durable history and participation decisions are connected to the generated API. Direct field membership now uses the reference switch presentation; approval mode retains request actions, and disabled self-service explains how to get a manager's help. Add tool navigation follows the employee-registration policy, while equipment managers can still register tools. Full settings composition and optional asset metadata remain open.
