# Batch 2 browser evidence

This is the repeatable in-app-browser diagnostic for the worker browse/detail slice. It is intentionally read-only: the only state changes are selecting the seeded demo profiles and opening/closing sheets.

1. Start the local app with `npm run dev -- --host 127.0.0.1`.
2. Open `http://127.0.0.1:5173/#/login` in the in-app browser and enter as Ray.
3. At viewport widths 320, 390, and 768, open `#/worker/checkout`, scroll in 500px steps through the catalog, and assert:

```js
const expectedToolPhotos = new Set([
  'bandsaw.png',
  'cable-cutters.png',
  'circuit-tracer.png',
  'conduit-bender.png',
  'extension-ladder.png',
  'fish-tape.png',
  'Gemini_Generated_Image_9u5w5o9u5w5o9u5w.png',
  'Gemini_Generated_Image_rxhw3arxhw3arxhw.png',
  'Gemini_Generated_Image_v50edhv50edhv50e.png',
  'hammer-drill.png',
  'hydraulic-bender.png',
  'impact-driver.png',
  'ir-tester.png',
  'knockout-punches.png',
  'multimeter.png',
  'rotary-hammer.png',
]);
const loadedPhotoNames = [...document.images].map((image) =>
  new URL(image.currentSrc || image.src, document.baseURI).pathname.split('/').pop(),
);
({
  noHorizontalOverflow: document.documentElement.scrollWidth === document.documentElement.clientWidth,
  allPhotosLoaded: [...document.images].every((image) => image.complete && image.naturalWidth > 0),
  photoCount: document.images.length,
  uniquePhotoCount: new Set(loadedPhotoNames).size,
  canonicalPhotosPresent: [...expectedToolPhotos].every((name) => loadedPhotoNames.includes(name)),
  unexpectedPhotos: loadedPhotoNames.filter((name) => !expectedToolPhotos.has(name)),
});
```

The photo assertion is intentionally set-based: it proves every expected canonical filename is present and loaded, not merely that sixteen duplicate images happen to render.

4. Open `#/worker/tools`, open the account sheet and mobile navigation drawer, and assert each right edge is no greater than the viewport width. Open `#/worker/activity`, choose “Damage & loss,” and confirm “Marked a cable cutter lost” is visible. Open `#/worker/account` and confirm Ray’s title and home warehouse are visible.
5. Sign out, enter as Sam, open `#/admin/dashboard`, and confirm the dashboard renders the 16-tool summary and warehouse coverage. Confirm the newest canonical event (“Requested a bandsaw handoff”) appears first in Recent movement, ahead of the older inventory events.
6. On a fresh tab after the final reload, `tab.dev.logs()` must contain no `warn` or `error` entries. Reset any temporary viewport override after the run.

The visible activity, pending-handoff, and detail-timeline labels are derived from canonical `occurredAt`/`occurred_at` and `requestedAt`/`requested_at` instants; fixture display copy is not an independent time authority.

Latest run (2026-08-18 local date): at 320, 390, and 768 CSS pixels each catalog pass reported equal document/client widths, 16 unique canonical photos loaded (`naturalWidth > 0`), and no unexpected image filenames. The account sheet right edge was 374.67px and the navigation drawer right edge was 319.79px within the 390px viewport; the lost activity, account metadata, and admin dashboard rendered. A fresh-tab console check returned zero warnings/errors.
