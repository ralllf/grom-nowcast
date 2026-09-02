# GROM launch-readiness audit — `main` @ `ec7d59a`

Audited 2026-09-01. Scope: making GROM a real public product with push alerts and later native apps.

---

## 1. Tests & typecheck

**`npm test`: 238 pass, 1 fail.** The failure is environment-dependent, not a product bug.

```
✖ Date.parse-as-UTC would be two hours late in July
  src/lib/weather/imgw-time.test.ts:19  →  0 !== 7200000
```

`src/lib/weather/imgw-time.test.ts:20-23` asserts `Date.parse(raw) - parseImgwWarsaw(raw) === 2h`. Per spec, a date-time with no offset parses as **local** time. The machine TZ is CEST, so the two agree and the delta is 0. Verified: `TZ=UTC node --test src/lib/weather/imgw-time.test.ts` → **13 pass, 0 fail**. The suite has an unpinned-TZ assumption; `npm test` should set `TZ=UTC`, or the test should assert the offset via `Intl` instead of the process clock.

**`npm run typecheck`: 1 error, test-only.**

```
src/components/threat-sheet.test.ts(133,24): error TS2339: Property 'includes' does not exist on type 'never'.
```

`imgwAsideCountLine(undefined)` returns `null`, so after `assert.equal(line, null)` at line 132 the optional chain `line?.includes(...)` narrows to `never`. Dead assertion; delete it or cast.

**`npm run build`: exit 0**, ~2 s after transform. No blocker.

---

## 2. Docs

| Doc | What it says |
|---|---|
| `NEXT.md` (67 ln) | Five ranked slices written 2026-09-01 against `cbafda2`. **#1 is "Pin the radar clock to Europe/Warsaw"** — but that is already shipped at `ec7d59a` (`wall-clock.test.ts` "formatRadarClock is Europe/Warsaw" passes). Items 3, 4, 5 also read as partly landed. **The file is stale relative to HEAD** and should be re-derived before anyone picks from it. Explicitly parks Web Push, GPS-as-platform, ML. |
| `ACCURACY-PLAN.md` (259 ln) | Ranked failure modes F1–F9 and slices 0–9, all marked shipped in `NEXT.md`. F1 (growth/initiation invisible) and F6 (Szansa uncalibrated) remain open; Slice 9 growth math is copy-only behind `GROWTH_MATH_ENABLED=false`. |
| `DATA-PROBES.md` (68 ln) | Live probe of every IMGW feed, 2026-09-01. Verdicts: keep SRI + RainViewer fallback + `warningsmeteo`; **try** ZHAIL (hail probability) and CMAX_250 as the best free accuracy wins; **refuse** Blitzortung (terms forbid storm-warning use) and the `/api/data/product` mirror (~11 h lag). PERUN point CSVs still 307. |
| `HINDCAST-LOG.md` (1010 ln) | The error ledger. **Two `front` rows, zero `konwekcja` rows.** Szansa calibration rests on one midday RainViewer window. |
| `HINDCAST.md`, `DATA.md`, `IDEAS.md`, `ARCHITECTURE.md` | Already read by the lead. |
| `superpowers/plans/2026-08-28-poland-motion-field.md` + 2 specs | Completed TDD plan for pin-free motion arrows; all steps checked except the final "summarize to user". Historical. |

---

## 3. Server side

Three server functions via TanStack `createServerFn({ method: "POST" })`: `getSnapshot` (`server.ts:441`), `searchPlaces` (`server.ts:467`), `getSriOverlay` (`server.ts:486`). All Zod-validated.

**All caching is module-level in-process** — `mapsCache`/`warningCache`/`lightningCache` (`server.ts:34-36`), `frameCache` + `frameInFlight` (`server.ts:271-272`), `radarScanCache` 90 s (`server.ts:274`, `:411`), `sriListCache` 45 s (`server.ts:268`), `placeCache` LRU 200 (`server.ts:37`), and `overlayFields`/`overlayPngs` (`sri-overlay-png.ts:63-64`).

**I probed the live cost.** One cold `getSnapshot`:

| Step | Cost |
|---|---|
| SRI listing (`POST getFilesList`, 968 KB HTML, 870 files) | **7.7 s** |
| One H5 download (57 KB) | 0.9 s |
| `h5wasm` import + ready | 0.04 s |
| `decodeSriH5` (800×800) | 0.09 s |
| `hitsFromSriGrid` + `aggregate` | 0.01 s |

Four frames fetch in parallel (`server.ts:394`), so a cold snapshot is roughly **9 s** — inside Vercel's 60 s Pro/Fluid limit but over the 10 s Hobby default. The listing dominates and is re-fetched every 45 s per instance.

**Vercel viability.** `nodejs24.x`, `supportsResponseStreaming`, function bundle 7.9 MB. h5wasm is *not* external despite `vite.config.ts:19` — Nitro inlines it to `_libs/h5wasm.mjs` (5.03 MB) with the HDF5 wasm embedded as a decoded string literal (`binaryDecode("\0asm…")`), so **there is no missing `.wasm` at runtime**. `decodeSriH5` writes to `os.tmpdir()` (`sri-h5.ts:73`), which Vercel allows. It will run. The problem is economics: every cold instance repeats the 7.7 s listing, and **no cache is shared across instances**, so under real traffic IMGW gets hit in proportion to instance count, not user count.

**Env vars: zero.** `grep process.env|import.meta.env` over `src/`, `scripts/`, `vite.config.ts` returns nothing. Nothing to configure, and nothing to rotate.

**Rate limiting / abuse: none on GROM's own endpoints.** The only throttle is outbound, `nominatimGate` at 1.1 s (`server.ts:38`, `nominatim.ts:3`), applied in `reversePlace` (`server.ts:206`) and `searchNominatim` (`server.ts:233`). It is per-instance, so N instances mean N× the agreed Nominatim rate. `searchPlaces` is an unauthenticated, uncached, per-caller-unthrottled proxy to Nominatim — the clearest abuse vector at launch, and a plausible way to get the app's User-Agent banned. That UA embeds the owner's email in plaintext at `nominatim.ts:2`.

---

## 4. Alert engine and delivery

`evaluateAlert(threat, settings, memory, now, opts)` at `alerts.ts:223`. Inputs are a `Threat` object, `AlertSettings`, an `AlertMemory` state machine, wall-clock ms, and `{ placeLabel, radarTime, analysisSource }`. Returns `{ event, memory, reason }`. It is a pure synchronous reducer with an explicit `idle → incoming → now → idle` episode machine, staleness gate at 30 min (`alerts.ts:147`, `:232`), quiet hours, and a 3-minute all-clear debounce.

Delivery in `src/lib/alert-delivery.ts` is browser-only, three channels: OS `Notification` (`:25`), a Web Audio chime (`:73`), and a tab-title flash (`:112`). The banner lives in the store as `activeAlert`.

**Confirmed absent: no service worker, no web manifest, no Web Push, no VAPID, no cron, no `vercel.json`.** `grep -rn "serviceWorker|manifest|VAPID|PushManager|showNotification" src/ public/` returns nothing, and the repo root has no manifest or `sw.js`. The file header at `alert-delivery.ts:5-6` says so explicitly: *"No service worker, no push — this only works while the GROM tab is open."*

**Reusability for server push is excellent.** `grep -ln "window\.|document\.|navigator\.|localStorage" src/lib/weather/*.ts` returns **nothing** — every module under `src/lib/weather/` is pure. `computeThreat` (`threat.ts:790`) takes `(place, frames, warnings, sampleOrigin, strikes)` and returns a `Threat`. So a server push worker is `sampleRadar() → computeThreat() → evaluateAlert()` with per-subscriber `AlertMemory` moved out of localStorage into a database. The only client-coupled piece is `alert-delivery.ts` and the memory persistence in `store.ts:122-134`.

---

## 5. Client

**`store.ts` (221 ln)** persists three localStorage keys: `grom-settings-v1` (place, alert settings, `imgwMap`, `drizzleMap` — `:155`), `grom-alerts-v1` (last 12 events, `:87`), `grom-alert-memory-v1` (episode memory, pin-keyed and TTL'd to 45 min, `:100-134`). Reads are defensively sanitized (`:36`).

**`grom-app.tsx` is 966 lines** — one component holding map, sheet, settings modal, search, alert banner, alert engine effect (`:206-222`), IMGW aside, and the frame slider. It is the main refactor debt. **`threat-sheet.tsx` is 397 lines** with logic already split into `threat-sheet-logic.ts`.

**Geolocation is one-shot, not `watchPosition`** — `getCurrentPosition` at `:279` with `{ enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }`, guarded by an iframe check (`isEmbeddedPreview`). Fine for now; a real alerting product eventually needs the pin to follow the user.

**Copy is 100% hardcoded Polish.** No i18n library, no locale files, no message catalog. Strings sit inline in JSX and inside `threat.ts` and `alerts.ts` (`levelNounPl` at `alerts.ts:156`, alert titles at `:308-327`). Internationalizing later means touching the engine, not just the UI.

**No analytics, no error tracking.** `grep -rni "analytics|sentry|posthog|plausible|gtag"` finds nothing. You will launch blind: no crash reports, no funnel, no way to know an alert fired wrong.

**SEO/meta is minimal.** `__root.tsx:8-17` sets charset, viewport with `viewport-fit=cover`, title, `theme-color`, and a description. **No Open Graph, no Twitter card, no canonical, no `robots.txt`, no sitemap.** `src/lib/og/site.json` exists with title/description/`"card": "custom"` but is imported nowhere. Sharing a GROM link to Messenger or Twitter today produces a bare URL.

An error boundary exists via `defaultErrorComponent: AppErrorComponent` (`router.tsx:6`), but it is router-level only — a throw inside `RadarMap` or `ThreatSheet` during render has no local boundary.

---

## 6. Mobile readiness

Viewport is correct including `viewport-fit=cover` (`__root.tsx:10`). Safe-area insets are handled at both ends: header `pt-[max(0.75rem,env(safe-area-inset-top))]` (`grom-app.tsx:398`) and sheet `pb-[max(0.75rem,env(safe-area-inset-bottom))]` (`threat-sheet.tsx:148`). Layout uses `100dvh` (`styles.css:34,42,44`; `grom-app.tsx:374`).

**There is a mobile sheet.** `threat-sheet.tsx:148-190` is a bottom sheet with a `touch-none` drag handle hidden at `sm:` and up, `max-h-[70dvh]` when open, `overscroll-contain` on the scroll body. Map rotation and pitch are disabled (`radar-map.tsx:186-188`), which is right for a nowcast.

Client bundle (`.vercel/output/static`, 2.3 MB total):

| Asset | Size |
|---|---|
| `maplibre-gl` | 966 KB |
| `maplibre-gl-worker` | 466 KB |
| `powiaty` (TERYT polygons) | 342 KB |
| `index` | 307 KB |
| `routes` | 145 KB |
| `styles.css` | 110 KB |

**h5wasm is correctly server-only** — `grep -rl h5wasm .vercel/output/static` is empty. MapLibre is lazy-imported (`radar-map.tsx:163`), so it is not in the critical path. The real concern is `powiaty` at 342 KB shipped to every visitor for a choropleth most will never enable (`drizzleMap`/`imgwMap` toggles). That should move server-side or become simplified geometry.

---

## 7. Red flags for a public launch

1. **Unthrottled Nominatim proxy** (`server.ts:467`). Per-instance 1.1 s gate only; no per-IP limit, no captcha, no cache on the search path (only reverse geocoding is cached). Owner's email is in the outbound UA (`nominatim.ts:2`).
2. **IMGW hit per instance, not per user** (`server.ts:411`, `:364`). The 90 s scan cache and 45 s listing cache are in-process. Serverless fan-out multiplies a 968 KB listing fetch by instance count. Needs a shared cache (Vercel KV / Redis) or a cron-driven precompute before real traffic.
3. **Map attribution is switched off.** `attributionControl: false` at `radar-map.tsx:183`, while the sources declare `attribution: "Esri, OSM"` (`:51`). The only attribution is a paragraph deep inside the sheet (`threat-sheet.tsx:305-312`). OSM/ODbL and Esri both require visible credit. See §8.
4. **No analytics or error tracking** — you cannot tell a bad alert from a happy user.
5. **No per-component error boundary** around the map or sheet.
6. **No OG tags**; `src/lib/og/site.json` is dead code.
7. **`grom-mobile.png` and `.playwright-mcp/` are untracked in the repo root** — clean these before making the repo public.
8. **`DEFAULT_ALERT_SETTINGS.enabled = false`** (`alerts.ts:37`). Every new user gets a silent app until they find the toggle. That is a deliberate choice per `NEXT.md`, but it is a product decision worth revisiting at launch.
9. Clean bill on the usual suspects: **zero TODO/FIXME/HACK**, zero `@ts-ignore`, zero secrets, zero env vars. The only `eslint-disable` is in generated `routeTree.gen.ts:1`.

---

## 8. Licensing exposure

**Attribution strings live in exactly one user-visible place**: `threat-sheet.tsx:305-312`, a `text-xs text-faint` paragraph crediting IMGW-PIB / POLRAD, RainViewer, OpenFreeMap, OSM, plus the "not an official RCB alert" disclaimer. `README.md:47` and `:87` point to `docs/DATA.md`. **Nothing is rendered on the map itself**, because `attributionControl: false` (`radar-map.tsx:183`) suppresses the `attribution: "Esri, OSM"` declared at `:51`.

**RainViewer is on the normal path, not only the fallback — in two ways.**

- `resolveAnalysis` calls `getMaps()` **even when SRI succeeds** (`radar-source.ts:77`), so `api.rainviewer.com/public/weather-maps.json` is fetched on every cache miss regardless. `scan.host`, `scan.past` and `scan.nowcast` come from RainViewer (`:38-45`) while `history` holds the SRI frames.
- RainViewer **tiles** are only drawn when `overlayFallback` returns `useRainviewer` (`sri-overlay.ts:113-128`), i.e. SRI overlay missing or errored.

So the app depends on RainViewer's JSON continuously and on its tiles only in degraded mode. That matters because `DATA-PROBES.md` records RainViewer's public API as **personal/educational use with attribution required**, and notes there is no commercial tier to buy. For a real public product, either drop the `getMaps()` call from the SRI path (the frame slider already prefers `scan.overlays` at `grom-app.tsx:230`) or obtain written permission. IMGW open data is the clean lane; RainViewer is the licensing risk.

**Recommended launch order:** shared server cache for the SRI listing → rate-limit `searchPlaces` → re-enable map attribution → error tracking → OG tags → then the push architecture, which the pure engine already makes straightforward.

---

## 9. Live discrepancy, 2026-09-01 ~20:06 CEST, pin Warszawa

Reported: sheet said "Ulewa nad Tobą", Szansa 95%, ETA teraz, "Echo 2 km · silny", Radar IMGW 20:00, timeline to 16 mm/h — but the map overlay at the same slider position showed no echo within ~30 km, nearest around Grójec (~40 km SSE) and Płock (~90 km NW). Both "Ostrzeżenia IMGW chwilowo niedostępne" and "Wyładowania chwilowo niedostępne" were displayed.

**The sheet was right; the map was painting something else.** I re-downloaded the real frames and ran both derivations over the same `Float32Array`:

| File (ODIM) | Analysis nearest / pinLevel | Overlay classes: nearest painted / px ≤30 km |
|---|---|---|
| `…17450000` | 1.9 km / 2 | 2.8 km / 312 |
| `…17500000` | 4.7 km / 2 | 4.0 km / 374 |
| `…17550000` | 4.5 km / 2 | 3.6 km / 425 |
| **`…18000000` (20:00 CEST)** | **1.9 km / 3** | **1.8 km / 452** |

The 20:00 analysis reproduces the sheet exactly, "Echo 2 km · silny", and `classesFromSriGrid` paints 452 pixels within 30 km of Warsaw. Server-side, analysis and overlay agree.

**Ruled out with numbers.** The aeqd-grid-as-image-quad warp (`sri-overlay.ts:85-101`) displaces Warsaw by only **1.4 km** (max ~7 km at the domain edge, Gdańsk/Kraków/Białystok) — not 40 km. Class filtering and row order also match (`sri.ts:91`, `sri-overlay-png.ts:28`). `fallbackPath` is time-matched within 6 min (`grom-app.tsx:233-240`), so a slider index mismatch is not it either.

**Most likely cause, ~70% confident: `getSriOverlay` returned `null` and the client silently fell back to RainViewer tiles.** On a Vercel instance that did not serve the snapshot, `sriOverlayMetaFor` misses and `ensureSriOverlay` (`server.ts:476-483`) must re-fetch the 968 KB listing — measured at **7.7 s** against a 12 s abort (`server.ts:71`). In a window where IMGW had already failed `warningsmeteo` and PERUN (both banners were showing), that call plausibly returned `null`, so `overlayFallback` (`sri-overlay.ts:121-124`) chose `useRainviewer`. The caption still reads "Radar IMGW 20:00" because it comes from `analysisSource`, not from what the map drew (`wall-clock.ts:32`, `const who = source === "sri" ? "Radar IMGW" : "Radar"`).

**Secondary, ~20%: a stale placeholder was painted as current.** `overlayFallback` returns `useSri` on any truthy `png` at `sri-overlay.ts:120` **without checking `isPlaceholder`**, while the query sets `keepPreviousData` and `staleTime: 5 min` (`grom-app.tsx:246-247`).

**Fix both cheaply:** have the map label which source it is actually painting, and make `sri-overlay.ts:120` respect `isPlaceholder`. The underlying accuracy is fine — this is a display-provenance bug, and exactly the class of error that ships undetected because there is no error tracking (§7).
