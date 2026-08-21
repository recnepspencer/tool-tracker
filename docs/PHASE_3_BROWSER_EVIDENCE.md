# Batch 3 browser evidence

This diagnostic covers the custody mutation and simulated add-tool surfaces through the in-app browser. It uses the local mock adapter only; no camera, upload, or network permission is requested.

1. Start the app with `npm run dev -- --host 127.0.0.1 --port 5173` and enter as Ray.
2. Open a held tool, choose **Transfer tool**, select a warehouse target, add a note and mock-photo flag, and confirm. The pending card appears while the detail still reports Ray as the holder and says custody moves after acceptance.
3. Open another held tool, choose **Report damaged**, add evidence, and confirm. The tool status changes to Damaged, the attention count increments, and the detail timeline contains the condition event.
4. Open **Add a tool**, capture the simulated photo, complete the required name/category fields, and save. The new tool appears in My tools with a local placeholder image and the current worker as holder.
5. At viewport widths 320, 390, and 768, assert:

```js
({
  noHorizontalOverflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
  loadedImages: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
});
```

6. On a fresh tab after reload, `tab.dev.logs({ levels: ['warn', 'error'] })` must return an empty list. Reset any temporary viewport override after the run.

Latest run (2026-08-18 local date): Ray requested the Rotary hammer, navigated to My tools, and the TanStack-invalidated pending projection rendered the new North Yard → Ray Torres card without a reload. The incoming-transfer acceptance surface was also exercised in component coverage. On a clean fresh tab, at 320, 390, and 768 CSS pixels the worker document/client widths were equal (`305/305`, `375/375`, and `753/753` client/document pixels respectively); six visible tool images were complete with positive natural widths at each width; and the fresh-tab console returned zero warnings/errors. The login, worker navigation, pending handoff, and local-image paths remained available after reload.

The focused TanStack surface tests also keep the worker-tools, catalog, detail, activity, admin summary, pending-handoff, and transfer-target queries mounted while exercising both transfer and simulated tool-creation commands; each active adapter read refetched after invalidation and the changed projection values (pending count, activity/admin events, catalog/unit counts) were asserted. Custody detail tests also prove focus entry, Escape close, focus restoration, terminal-condition action hiding, and fail-closed behavior when pending-handoff loading errors.

Follow-up parity run after the final query-boundary and condition-policy pass: the clean worker tab again had no horizontal overflow at 320/390/768 (`305/305`, `375/375`, `753/753` client/document pixels), six visible local images loaded with positive natural widths at every width, and no warning/error console entries. The cross-tool detail regression confirms a completed condition notice is cleared when another tool opens.

Final fresh-tab run after the retained-lifecycle, archived-action, and fail-closed panel corrections: Ray signed in on a new tab, and the same 320/390/768 checks returned no overflow, six complete local images at each width, and empty warning/error logs. The viewport override was reset after the run.

Current TanStack cutover verification (2026-08-18): the final fresh tab was loaded after the app/query-boundary changes, signed in as Ray, and checked at 320/390/768. Client/document widths were `305/305`, `375/375`, and `753/753`; all six visible local images were complete with positive natural widths; and the fresh-tab warning/error log was empty. The full gate passed typecheck, lint, format, 37 test files/145 tests, and build; both high-severity audit modes reported zero vulnerabilities. Query projection tests now assert no-remount refetch/value changes for tools, catalog, detail, activity, admin summaries, every pending-handoff profile, and transfer targets.

Latest cutover regression run (2026-08-18): after the inactive-query safety fix, the full gate passed typecheck, lint, format, 38 test files/149 tests, and build; both audit modes again reported zero vulnerabilities. A fresh Ray worker tab retained equal client/document widths at 320/390/768 (`305/305`, `375/375`, `753/753`), all six visible local images were complete with positive natural widths, and the warning/error console remained empty. The new inactive-query tests hold an unmounted transfer-target or pending-handoff refetch open and verify the remounted action is disabled (`Loading transfer targets…` or `Saving…`) until the refetch resolves.

Final cutover browser check (2026-08-18): the detail action boundary also fails closed during an affected tool-detail refetch. The fresh worker tab again reported `305/305`, `375/375`, and `753/753` client/document widths, six complete local images at every viewport, and zero warning/error console entries after the viewport override was reset.

The pending-handoff card now also blocks cached actions when its background query is unavailable, including a refetch error, so an old projection cannot be submitted while the authoritative read is unresolved.

Final query cutover gate (2026-08-18): `npm run check` passed typecheck, lint, format, 40 test files/153 tests, and build; production-only and full high-severity audits both reported zero vulnerabilities. The focused inactive-query suite covers authoritative changed projections, paused/offline refetches, pending-refetch errors, unresolved detail refetches, and active-detail refetch errors. The fresh browser geometry/image/console evidence above remains unchanged because the final addition is an adapter/query oracle.

Clean fresh-tab verification after the controller extraction (2026-08-18): Ray signed in on a new tab, then the worker surface reported equal client/document widths at 320/390/768 (`305/305`, `375/375`, `753/753`), six complete local images at each viewport, and zero warning/error console entries. The viewport override was reset to 768px after the run.

Final cutover-boundary verification after the snapshot/type and action-state corrections (2026-08-18): a clean Ray tab on port 5174 reported equal client/document widths at 320/390/768 (`305/305`, `375/375`, `753/753`), six complete local images with positive natural widths at each viewport, and no warning/error console entries. The adapter-boundary oracle now also rejects destructured and computed adapter access, and blocked pending actions render `Unavailable` rather than implying an in-flight save. `npm run check` passed typecheck, lint, format, 41 test files/154 tests, and build; both high-severity audit modes reported zero vulnerabilities.

Final oracle-strengthening gate (2026-08-18): the inactive transfer-target test now remounts the production `WorkerToolDetailSheet`/`ToolCustodyActions` panel and observes its real disabled confirmation while the target refetch is pending; the adapter-boundary test covers aliased and multi-property destructuring plus optional-chain access. The full gate again passed 41 test files/154 tests/build, both high-severity audit modes reported zero vulnerabilities, and the prior clean-tab geometry/image/console evidence remained green.

Final selected-target oracle gate (2026-08-18): the production action panel retains a selected warehouse destination while an external request invalidates its target query. The test verifies Confirm is disabled with that selection during an offline-paused refetch, during a loading refetch, and after an authoritative target error, with no transfer command emitted; after targets resolve, the selected confirmation becomes actionable again. The full 41-file/154-test/build gate and both zero-vulnerability audits remained green.

Final inactive-cache oracle gate (2026-08-18): a dedicated production-boundary test caches transfer targets, unmounts the target observer and action panel, triggers a request mutation that invalidates the inactive target cache, then remounts the real `ToolCustodyActions` with the selected destination retained by its shell. Confirm remains disabled during the held inactive refetch and becomes actionable only after the authoritative target response resolves. The adapter scanner also rejects member aliases (`const tools = api?.tools`). The full gate passed typecheck, lint, format, 42 test files/155 tests, and build; both high-severity audit modes reported zero vulnerabilities.

Final pending-query causality gate (2026-08-18): the pending-error test now waits for the invalidated inactive query to enter its held refetch before rejecting it, and the offline paused test reads the QueryClient state to prove the inactive pending key is `fetchStatus: paused` before remount. The complete 42-file/155-test/build gate and both zero-vulnerability audits remained green.

Final TanStack cutover safety gate (2026-08-18): the production inactive-target boundary now invokes the real `startTransfer` mutation, preserves and reasserts the selected warehouse destination across unmount/remount, proves Confirm emits zero commands during loading, paused, and error target states, and proves exactly one command after authoritative targets resolve, including recovery from the error state. Dedicated pending-query safety tests likewise attempt blocked Withdraw actions and assert zero adapter calls for held, errored, and paused refetches. The complete 43-file/157-test/build gate and both zero-vulnerability audits remained green. A fresh Ray browser tab on port 5174 again reported equal document/client widths at 320/390/768 (`305/305`, `375/375`, `753/753`), six complete canonical local images at each viewport, and only expected Vite/React informational console entries (no warning/error entries); the viewport override was reset to 768px.
