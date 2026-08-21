# Phase 6A browser evidence

Candidate source is bound to the exact frozen manifest below:

- entries: `467`
- manifest SHA-256: `D3B07DEAFAA99D56244DB8C76BDB1CB2AE69384565E260E2CA117FA639846307`
- scope: the ten root config/package files, `public/tool-images/**`, and `src/**`; generated `dist/**`, ledgers, and browser docs are excluded

The in-app browser verified the public auth parity slice on port `5174`:

- `/login` renders Ray and Sam demo profiles and links to each walkthrough.
- `/signup` validates locally, carries a transient draft to `/company-setup`, and completes without calling auth, admin, or settings commands or writing flow-owned browser storage; the shared theme provider's `nelson-demo-theme` key is the only permitted write.
- `/invite/sample-invite` previews acceptance without adapter or flow-owned storage writes; an unknown token renders an explicit unavailable state under the same sentinels.
- `/reset-password` completes the request/code/password walkthrough in memory only, with no adapter or flow-owned storage writes.
- Authenticated Ray and Sam sessions visiting every public walkthrough redirect to `#/worker/tools` and `#/admin/dashboard`, respectively.
- Public route headings receive focus after each walkthrough transition; the fresh `/signup` run focused `Start a company space`.
- At 320, 390, and 768 CSS pixels, every checked route had equal document `scrollWidth` and `clientWidth` (305/305 at 320, 375/375 at 390, and 753/753 at 768 when the page scrollbar was present; the short `/reset-password` route measured 768/768).
- A fresh tab had zero console warnings and errors after route, focus, and responsive checks.
- The application made zero adapter/API calls during the transient walkthroughs; Vite development-module traffic is not counted as application behavior.

This artifact records the browser run; Batch 6A remains open until fresh QA-loop, QA-tests, code-quality, and Sol-high reviewers certify this exact source candidate.
