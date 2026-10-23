# Retired browser prototype

This directory preserves the former demo frontend and its mock-specific tests for reference. It is not imported, compiled, tested, copied, or served by the real application. `src/main.tsx` at the repository root now mounts the API-backed application in `src/live`.

The old profile picker, localStorage database, imaginary HTTP adapter contract, and demo-specific role projection are retired. Their tests describe the prototype, not the current backend contract. The last legacy test run reported 393 passing and 29 failing tests; those failures are preserved here rather than changing obsolete assertions to pass. Current checks cover the generated OpenAPI client, real PostgreSQL behaviors, and browser journeys against the API.

Prototype images remain under the root `public/tool-images` directory for reference. Vite serves only `public/app`, so these images do not enter the production artifact or PWA cache.
