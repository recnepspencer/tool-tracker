# Jobs and foremen

Administrators manage jobs in **Settings → Jobs**. They can create, rename, archive, and restore jobs. There is no delete operation. Names are unique, including archived jobs; restore the existing job to reuse it.

The existing `worker` access role is used for the foreman workflows. **My jobs** lets each active field user join or leave any combination of active jobs. They can change only their own memberships. **Foremen** lists all active field users, including people with no current jobs or tools. Search matches names, jobs, tool names, brands, models, unit IDs, and serial numbers; the job filter includes a no-current-jobs option.

Job assignments are independent of custody. Switching jobs never moves a tool. The directory reads each individual tool's canonical holder and shows pending transfer destinations and damaged/lost status. A pending transfer remains under its sender until accepted. Tool and people mutations invalidate directory queries.

Archiving closes open job assignments and preserves their start/end timestamps. Archived jobs disappear from current selections and directory job lists, but remain available to admins under Archived jobs. Restoring does not automatically reassign previous members. Job and membership changes appear in the admin audit trail.

## Data boundary

`JobsApi` is implemented by both the mock and HTTP adapters. The GitHub Pages site uses the existing in-memory mock database: state survives navigation and profile switching in the same page, but resets on a full reload and is not shared between devices. The HTTP adapter defines the integration contract; this repository does not implement a backend.

HTTP reads are `GET /jobs?actor_id=…` and `GET /foremen?actor_id=…`. Commands are `POST /jobs` and `POST /jobs/:id/{rename,archive,restore,membership}`. Versioned commands carry `expected_revision`; membership also carries `joined`. The mock checks authorization, job state, unique names, and assignment references atomically. A production server must enforce the same rules using the authenticated session rather than trusting `actor_id`.

Jobs use stable IDs, names, revisions, and optional archive timestamps. Assignments use stable IDs, member/job references, and join/end timestamps. Renaming therefore preserves associations. No quantities or job references are added to individual tool records.
