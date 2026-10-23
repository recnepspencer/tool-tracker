# Nelson Electric

An API-backed tool custody application with a responsive, installable web frontend. The active entry point is `src/main.tsx`; the frontend lives in `src/live`. The former browser demo is archived under `legacy/prototype` and is excluded from production.

## Run locally

Start the PostgreSQL database and Django API using [backend/README.md](backend/README.md), then run:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Django on port 8001. Use real email/password credentials; there is no profile picker or demo session. The explicitly seeded review accounts use `NELSON_REVIEW_PASSWORD` from your local backend environment.

Account creation verifies the email address before choosing a password and creating an identity. An existing user signs in directly. Invitations preserve their destination through login and registration. New accounts without memberships may create a company or use an invitation. A password reset invalidates previously issued browser sessions. No passwords or session tokens are stored in localStorage.

Account screens share a compact, neutral layout, with email delivery confirmations, a resend cooldown, editable email drafts, password visibility controls, focused errors, and recovery actions for unusable links. Accepting an invitation confirms access before opening the newly joined workspace. Switching accounts preserves the invitation while clearing private company data.

Development email is written to `artifacts/mail/`. Open the newest message for its verification, invitation, or reset URL. This is a local inbox, not an email simulator returning tokens from public API responses. SMTP production configuration is deliberately deferred at the user's request; set `NELSON_APP_URL`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `EMAIL_USE_TLS`, and `DEFAULT_FROM_EMAIL` when deploying. Run `cleanup_account_tokens` daily.

## Working screens

- Physical tool inventory and search, registration with photos, requests, transfers and returns, receipt decisions, custody history, condition reports, service history, lifecycle and stewardship changes.
- Projects/jobs, self-service participation according to company policy, approvals, assignments, responsibilities, history, archive/restore.
- Invitations and membership access, shared tool models/categories, warehouses and scoped managers, registration and job policies, directory, reconciliation, activity.

Navigation uses current server capabilities, not assumed worker/admin profiles. The API checks authorization again for each operation. Revision conflicts are surfaced to the user; writes are never retried or queued automatically. Lists use the API's bounded pages; reference selectors collect those pages so records beyond the first page remain selectable. Inventory and activity have explicit page controls.

## Contracts and tests

```sh
npm run api:generate   # after regenerating backend/contracts/openapi.json
npm run check
npm run test:browser   # API on 8001, production build already generated
```

`openapi-typescript` generates `src/live/schema.d.ts` from the checked backend contract. `openapi-fetch` uses these path, query, body, and response types directly. CI checks generated-client drift, missing migrations, a fresh PostgreSQL database, populated migration upgrades, backend regressions, TypeScript/lint/formatting, client boundary tests, the production bundle, and actual browser account/custody/job/PWA journeys. Browser tests create their own isolated company through public UI and use delivered email links; business responses are not mocked.

## PWA and hosting

The manifest includes standalone display, app icons, and an installation entry point. Pages use safe-area insets, touch targets, mobile navigation, and password-manager autocomplete. Feature pages load in separate chunks. The service worker precaches only the static shell and fonts; API responses, private photos, account links, and mutations are never cached. Offline users get an explicit connection message. Updates prompt before reloading so forms are not unexpectedly discarded. On iOS, use Share → Add to Home Screen.

Serve `dist/` and proxy `/api/` on the same HTTPS origin, with SPA fallback for navigation. See [deploy/nginx.conf](deploy/nginx.conf). Run the Django API, PostgreSQL, persistent private photo storage, and `python manage.py run_platform_worker`. Configure SMTP later to enable real inbox delivery. Do not place `backend/media` or `artifacts/mail` in a public web root.

GitHub Pages cannot serve this backend. The former Pages workflow now validates and packages the web artifact instead of automatically publishing an unusable static application. Hosting and production email are not deployed by this change.
