# Drive: radar-map (`tor komórki` / `pokaż`)

**Feature:** radar-map — cell-track arrows, Warszawa, 1280×800  
**Base:** http://127.0.0.1:8080 (this run’s Vite; not production)  
**Out:** `/workspace/.cursor/skills/verify-grom/evidence/20260901-173500`  
**OK:** true  
**When:** 2026-09-01T17:33:29Z → 2026-09-01T17:33:55Z

Doctor: worth driving. `analysisSource: sri`, `overlayCount: 4`, radar age 2.7 min at check. IMGW warnings and PERUN unavailable (skip those assertions).

## Action → resulting state

Viewport `1280×800`. WebGL2 on (SwiftShader). Sheet `#grom-threat-sheet` not `Skanuję radar…`.

| Control | Before | After |
|---|---|---|
| `pokaż` on `tor komórki` | present; slider `17:30` / max latest | clicked; `fitBounds` to pin-narrative track; map still up (`canvas` 1280×800, overlay canvas present, no `Coś poszło nie tak`) |
| `Pokaż mżawkę` | `aria-pressed="false"` | left off |
| Sheet | `Ulewa nadciąga` · Warszawa TERYT 1465 · Szansa 90% · ETA 6 min · Echo 10 km | same story (inbound cell; copy not this slice) |

`pokaż` has no `aria-pressed` — it `fitBounds` the pin-narrative cell (`threat.track`), not the highest-confidence storm 250+ km away.

## Track vs pin (same last-4 COMPO_SRI as the page: 17:15–17:30 UTC)

`computeThreat(Warszawa 52.2297, 21.0122, frames, [], PL_RADAR_ORIGIN)`:

| | |
|---|---|
| title | Ulewa nadciąga |
| nearestKm | **10.32** |
| etaMin | **10** frame-time (sheet wall-clock ~6) |
| chancePct | **90** |
| pinLevel | **0** (pin dry) |
| **track.now** | **52.3156, 20.4463** |
| pin | 52.2297, 21.0122 |
| now → pin | **39.67 km** |
| nearest sample to `now` | **1.57 km** (on echo, not the pinezka) |
| bearing | **108.7°** (advection ESE) |
| pin azimuth from `now` | **103.7°** (Δ **5.0°** — cell is approaching; shaft is not a line-to-pin construct) |

Same 19:05 CEST dump used in the PR (frames ending 17:05 UTC): `now` moved from the 56 km mass centroid **52.3876, 20.3348** (2 samples within 3 km, 49.3 km from the pin, bearing Δ pin **0.30°**) onto the core **52.3657, 20.2071** (0 km from `massAnchor`, 1.4 km from a level-2 sample). Sheet stayed **55 / 30 / 23.46**.

## Steps

1. `launch.sh` → Vite PID in `/tmp/verify-grom/launch.json`
2. `doctor.mjs` → `ok: true`, SRI overlays
3. Chrome CDP 1280×800, `--use-angle=swiftshader` (WebGL2). Wait until sheet is not `Skanuję radar…` + 8 s for style/overlay
4. Screenshot `01-before-pokaz.png` — `tor komórki` visible, drizzle off
5. Click `pokaż`; map remains; no error overlay
6. Screenshot `02-after-pokaz.png` — camera on the inbound cell; orange shaft on the map (548 amber pixels in the map half)

## Side effects

- Map camera `fitBounds` after `pokaż` (no `localStorage` change). Place stayed default Warszawa TERYT 1465 (`grom-settings-v1` unset in the throwaway profile).
- `drizzleMap` left off.

## Screenshots

- `01-before-pokaz.png` — desktop Warszawa, tracks pill on, drizzle off
- `02-after-pokaz.png` — after `pokaż`, inbound-cell arrow in view

Mocks: none. Live IMGW SRI snapshot.

## Unit

`src/lib/weather/threat.test.ts` — `inbound 23 km cell: arrow now sits on that echo, not in the dry gap aimed at the pin`.  
`npm test`: 239 pass, 0 fail.
