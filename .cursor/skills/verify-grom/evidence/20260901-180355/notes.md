# Drive: radar-map (`tor komórki` default off)

**Feature:** radar-map — cell-track arrows, Warszawa, 1280×800
**Base:** http://127.0.0.1:8080 (this run’s Vite; not production)
**Out:** `.cursor/skills/verify-grom/evidence/20260901-180355`
**OK:** true
**When:** 2026-09-01T18:04:02.479Z → 2026-09-01T18:04:05.509Z

Doctor: worth driving. `analysisSource: sri`, `overlayCount: 4`, radar age 4 min. IMGW warnings and PERUN unavailable (skip those assertions).

## Action → resulting state

Viewport `1280×800`. WebGL2 on (SwiftShader). Sheet `#grom-threat-sheet` not `Skanuję radar…`. Fresh Chrome profile (empty `grom-settings-v1`).

| Control | Before | After chip click |
|---|---|---|
| `tor komórki` | `aria-pressed="false"` | `aria-pressed="true"` |
| Overlay canvas amber (`#e4572e` / AMBER) | **0** | **659** |
| Full-page exact `#e4572e` pixels | **0** | **664** |
| `Pokaż mżawkę` | `aria-pressed="false"` | left off |
| Sheet | `Ulewa nad Tobą` · Warszawa TERYT 1465 · Szansa 95% · ETA teraz · Echo 2 km | same story (not this slice) |

`pokaż` stayed on the pill and was not the overlay toggle.

## Steps

1. `launch.sh` → Vite PID in `/tmp/verify-grom/launch.json`
2. `doctor.mjs` → `ok: true`, SRI overlays
3. Chrome CDP 1280×800, `--use-angle=swiftshader`. Wait until sheet is not `Skanuję radar…`
4. `tor komórki` present, `aria-pressed=false`; overlay canvas amber = 0
5. Screenshot `01-tracks-off.png`
6. Click the `tor komórki` chip (not `pokaż`); poll until `aria-pressed=true`
7. Overlay canvas amber = 659
8. Screenshot `02-tracks-on.png`

## Side effects

- `grom-settings-v1.tracksMap` became `true` after the chip click (throwaway Chrome profile).
- Sheet Szansa / ETA / Echo unchanged.
- `pokaż` / `computeThreat` / `makeTrack` not deleted.

## Screenshots

- `01-tracks-off.png` — fresh load, chip off, no track glyphs (radar color only)
- `02-tracks-on.png` — chip on, white-head / amber-tail arrows drawn

Mocks: none. Live IMGW SRI snapshot.

## Unit

`src/lib/weather/tracks-map.test.ts` — fresh settings overlay false; `tracksForMap` empty until on.
`npm test`: 242 pass, 0 fail.
