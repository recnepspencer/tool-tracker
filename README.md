# Nelson Electric

An API-backed tool custody application with a responsive, installable web frontend. The active entry point is `src/main.tsx`; the frontend lives in `src/live`. The former demo, mock adapters, prototype tests, phase ledgers, and stock images have been removed; their history remains in Git.

The interface follows the original demo's field and control-room layouts, with the approved compact account screens retained. [Design and workflow parity](docs/DEMO_PARITY.md) maps the reference behavior to browser journeys and loaded visual captures.

## Run locally

Start the PostgreSQL database and Django API using [backend/README.md](backend/README.md), then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Django on port 8001. Use real email/password credentials; there is no profile picker or demo session. The explicitly seeded review accounts use `NELSON_REVIEW_PASSWORD` from your local backend environment.

Company signup verifies the email address before choosing a password and creating an identity. Invitees use their emailed invitation to confirm their address, edit their prefilled name if needed, and set a password to join directly. An existing user signs in directly. Invitations preserve their destination through login and registration. New accounts without memberships may create a company or use an invitation. A password reset invalidates previously issued browser sessions. No passwords or session tokens are stored in localStorage.

Account screens share a compact, neutral layout, with email delivery confirmations, a resend cooldown, editable email drafts, password visibility controls, focused errors, and recovery actions for unusable links. Accepting an invitation confirms access before opening the newly joined workspace. Switching accounts preserves the invitation while clearing private company data.

Development email is written to `artifacts/mail/`. Open the newest message for its verification, invitation, or reset URL. This is a local inbox, not an email simulator returning tokens from public API responses. SMTP production configuration is deliberately deferred at the user's request; set `NELSON_APP_URL`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, and `DEFAULT_FROM_EMAIL` when deploying. Run `cleanup_account_tokens` daily.

## Working screens

Field inventory collection is temporary and controlled in Settings. While open, workers and foremen can describe and photograph equipment already in the field without creating catalog entries or registered inventory. Managers review submissions in Queue, ask for clarification, match an existing physical item, or register a new one. Reviewed items reported in the submitter's possession start with that person as custodian; matching an existing item preserves its current custody. Closing collection removes employee submission access while managers and owners retain registration. Serial numbers and purchase details are visible only to equipment managers and company administrators. Managers can create equipment types and categories inside registration without leaving the form.

- Physical tool inventory and search, registration with photos, requests, transfers and returns, receipt decisions, custody history, condition reports, service history, lifecycle and stewardship changes.
- Projects/jobs, self-service participation according to company policy, approvals, assignments, responsibilities, history, archive/restore.
- Invitations and membership access, shared tool models/categories, warehouses and scoped managers, registration and job policies, directory, reconciliation, activity.

Navigation uses current server capabilities, not assumed worker/admin profiles. The API checks authorization again for each operation. Revision conflicts are surfaced to the user; writes are never retried or queued automatically. Lists use the API's bounded pages; reference selectors collect those pages so records beyond the first page remain selectable. Inventory and reference views collect the bounded pages so complete groups and pickers remain available; Activity has explicit Previous/Next controls.

## Contracts and tests

```sh
npm run api:generate   # after regenerating backend/contracts/openapi.json
npm run check
npm run test:browser   # PostgreSQL and backend dependencies available; production build already generated
```

`openapi-typescript` generates `src/live/schema.d.ts` from the checked backend contract. `openapi-fetch` uses these path, query, body, and response types directly. CI checks generated-client drift, missing migrations, a fresh PostgreSQL database, populated migration upgrades, backend regressions, TypeScript/lint/formatting, client boundary tests, the production bundle, and actual browser account/custody/job/PWA journeys, physical-asset identity, condition/service, photo downloads, company switching, policy persistence, and stale-edit recovery. Browser tests create isolated companies through public HTTP endpoints and use delivered email links; the account journey also creates a company through the UI. Business responses are not mocked.

## PWA and hosting

The manifest includes standalone display, app icons, and an installation entry point. Pages use safe-area insets, touch targets, mobile navigation, and password-manager autocomplete. Feature pages load in separate chunks. Page entry files compose controller hooks and views; an ESLint rule prevents direct state and effect imports in those files. List filters live in the URL. Effects synchronize browser APIs, session events, focus, or timers rather than copying derived state. The service worker precaches the static shell, fonts and field pages; office-only pages (operations, people, catalog, warehouses) are cached on first visit instead, so installing over weak signal downloads less. The service worker never caches API responses, photos, account links or mutations.

### Weak connections

Crews often work where signal is poor, so the app is built for 3G:

- **Saved records.** Each successful read is also saved in IndexedDB for up to three days (`src/live/query-persistence.ts`). Screens still ask the server first. Saved records appear only when that request fails, or is still waiting after 1.5 seconds, so a good connection never shows outdated records. A status bar says when the records on screen were saved, and they refresh when the connection returns. A failed background refresh keeps the records already on screen instead of showing an error. Signing out or losing the session deletes saved records, and a new API contract discards them.
- **Retries.** Reads retry three times with backoff (1s, 2s, 4s) while the device reports it is online. Server decisions (4xx) are not retried. Writes are never retried automatically; their request keys make a manual retry safe.
- **Revalidation.** Company reads return `Cache-Control: private, no-cache` with an ETag, and the client fetches with `cache: 'no-cache'`, so an unchanged list answers `304` with no body. Account endpoints and errors stay `no-store`. Sign-in and sign-out send `Clear-Site-Data: "cache"`.
- **One CSRF fetch.** The CSRF token is fetched once and reused until an account change rotates it. A rejected token is refreshed and the write is sent once more.
- **Photos.** The browser downscales photos to 1600px JPEG before upload, which also strips location metadata. Lists request `?size=thumb` (320px WebP) and sheets request `?size=display` (1280px WebP); only "View photo" links fetch the original. Attached photos are immutable and cached privately for a year.
- **Large pages.** Tool lists load 500 units per request, and the first page renders while later pages load behind it.
- **Compression.** nginx gzips scripts, styles and API JSON and serves HTTP/2 (`deploy/nginx.conf`).

Offline users get an explicit connection message. Updates prompt before reloading so forms are not unexpectedly discarded. On iOS, use Share → Add to Home Screen.

The DigitalOcean testing pipeline builds a versioned application container after the complete quality gate, then deploys the API, worker, PostgreSQL and private test email inbox to a Droplet. Nginx serves the frontend and `/api` on the same trusted HTTPS origin. See [deployment operations](deploy/README.md) for releases, backups, test credentials and inbox access. Production SMTP remains deferred.

GitHub Pages cannot serve this backend. Its retired packaging workflow has been replaced by the testing deployment pipeline. Production hosting remains separate from this testing environment.
