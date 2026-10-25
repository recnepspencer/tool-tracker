# Regression evidence

Run `npm run check` for TypeScript, page-boundary lint rules, formatting, five HTTP-client boundary checks, and the production PWA build. Run `npm run test:browser` with the Django API and PostgreSQL running. The browser harness starts the production web preview on port 4173.

Browser scenarios create isolated companies through public HTTP endpoints and use actual sessions, CSRF, file-inbox email, PostgreSQL, and private photo downloads. No business endpoint is mocked. Account scenarios prove verified signup, invitation switching, recovery, replay prevention, and offline behavior. Workspace scenarios prove separate physical units, URL navigation, condition/service/lifecycle independence, stale-edit recovery, company isolation, configurable participation and employee registration, suspension, and photo authorization. Small shared setup helpers use the same public API; the scenario assertions inspect the UI and persisted outcomes rather than helper call sequences.

The backend gate is `python scripts/check_api.py` from `backend/` using the configured environment. It checks declarations, migrations, PostgreSQL constraints, OpenAPI drift, populated upgrades, behavior, lint, and formatting. Fixtures remain domain-owned. The seeder is separately tested for repeatability and preservation of user changes.

The removed demo tests exercised a retired mock implementation. They remain in Git history, and are not counted as evidence for the API-backed application. CI runs the same real PostgreSQL and production-browser gates before packaging the web application.
