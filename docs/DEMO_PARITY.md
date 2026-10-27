# Tool tracker design and workflow parity

The original demo at commit `80202f5` and the local HTML designs are the references for the field and control-room experiences. The approved compact account screens are retained. Physical units, shared models, confirmed custody and configurable company rules follow the agreed API model.

| Surface | Preserved behavior | Evidence |
| --- | --- | --- |
| Field shell | Centered narrow workspace, wordmark, navigation drawer, account sheet, light/dark appearance | `demo-parity`, `role-surfaces`, `workspace-access` browser journeys; loaded mobile/desktop captures |
| My tools | Held units, pending incoming/outgoing movements, review, transfer and checkout | `custody-decisions`, `custody-recovery`, `accounts` |
| Checkout | Search and warehouse filters, list/grid modes, photographs, request of a specific physical unit | `demo-parity`, `workspace`, `custody-decisions` |
| Tool sheet | Metadata, custody and condition history, transfer/return, evidence, retirement/disposal | `condition-lifecycle`, `asset-details`, `custody-recovery`, `workspace` |
| Registration | Photo-first flow, retained details, model/unit identification, optional serial/price/notes | `cutover-workflows`, `asset-details`, `access-lifecycle` |
| Control room | Header, sidebar, account controls and warehouse scope | Eight role/grant combinations in `role-surfaces` |
| Queue | Warehouse filters, review sheet, request/transfer/return decisions and resolved history | `custody-decisions`, `custody-recovery`, `demo-parity` |
| Inventory | Photo table, grouped identical models, individual unit expansion, holder/status/warehouse | `demo-parity`, `workspace`, `catalog-lifecycle` |
| Damaged/lost | Filtered inventory, reports, finding/repair actions and durable evidence/history | `condition-lifecycle`, `workspace` |
| People | Directory table, person sheet, invitations, role/access changes, offboarding/reinstatement | `invitations`, `access-lifecycle`, `accounts` |
| Jobs/directory | Job list, roster, responsibility history, independent join/leave rules and held-tool directory | `jobs-management`, `cutover-workflows`, public-HTTP job/directory tests |
| Warehouses | Table, create/edit/archive/restore dialogs, scoped managers and stock | `cutover-workflows`, `catalog-lifecycle`, `custody-recovery` |
| Access/activity | Server-projected capabilities and readable, filtered activity | `role-surfaces`, `access-lifecycle`, `cutover-workflows` |
| Settings | Narrow company/jobs/categories cards, shared editors, actual company rules and readonly values | Five role journeys in `settings`; independent filters and saved-value checks after reload |

Business responses come from the real API. The replacement dashboard, mock adapters, role switcher, demo reset and stock catalog images are absent from the runtime. Drafts and filtered parent lists remain in place under sheets; dismissal restores navigation and keyboard focus.

Loaded captures include `artifacts/parity-inventory-desktop.png`, `artifacts/parity-checkout-mobile.png`, `artifacts/parity-tool-details-desktop.png`, `artifacts/parity-return-destination-mobile.png`, `artifacts/tool-disposal-history-mobile.png`, `artifacts/asset-purchase-details-mobile.png`, `artifacts/settings-jobs-desktop.png`, `artifacts/settings-categories-desktop.png` and `artifacts/settings-field_member.png`. The browser journeys generate these from persisted records, not mock screens. Settings captures wait for actual values and finish finite animations before capture.

PWA evidence is tracked in [CUTOVER_AUDIT.md](CUTOVER_AUDIT.md). Native device installation and production hosting/email configuration are separate from these browser layout and interaction checks.
