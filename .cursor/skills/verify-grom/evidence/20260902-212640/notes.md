# Drive: location-pin (+ pin above track)

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-212640
**OK:** true
**When:** 2026-09-02T21:26:47.693Z → 2026-09-02T21:31:20Z
**Instance:** Vite launched by this run (`/tmp/verify-grom/launch.json` vitePid 3578). Not production.

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

Then a fresh Chrome profile on the same Vite instance: `tor komórki` off → on, then `pokaż` so a track is in view.

**The pin is visible above the track.** Overlay canvas pin core at (895, 89) is accent `#6ec8d4` (coreAccent=113, coreAmber=0) while amber track pixels=479 and ink outline pixels=1071. Crop `05d-pin-at-overlay.png` shows the 10px accent fill, 3px white ring, ~24px halo, with a dashed past segment under/beside the pin. Crop `05e-track-wide.png` / `05c-track-crop.png` show the amber arrow with ink outline (future segment).

## Steps

1. navigate http://127.0.0.1:8080/
2. trio labels: Szansa · Za ile · Echo
3. status row: Radar 23:25 · 2 min · IMGW ✕ · wyładowania ✕
4. sheet ready, starts with pin copy: Warszawa | Czysto | CZYSTO
5. Warszawa sheet scrolled to status row
6. localStorage place.label before=null
7. click button[aria-label="Ustawienia"]
8. dialog open: Lokalizacja i alerty
9. click city chip "Kraków"
10. sheet shows Kraków (no TERYT); dialog closed
11. Kraków status row: Radar 23:25 · 2 min · IMGW ✕ · wyładowania ✕
12. new Chrome profile: sheet Warszawa / Czysto; `tor komórki` aria-pressed=false; overlay amber=0, pin accent=212 at (640,399)
13. click `tor komórki` → aria-pressed=true
14. click `pokaż` (fit pin + nearest track)
15. overlay: accent=212, amber=479, ink=1071, white=239; pin core (895,89) rgb(110,200,212); coreAmber=0 → pin above track

## Side effects

- `grom-settings-v1` `{"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}`
- Second session: `tracksMap` true after the chip click (throwaway Chrome profile).

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row
- `04-pin-tracks-off.png` — Warszawa, `tor komórki` off, pin only (accent + white ring + halo)
- `05-pin-above-track.png` — chip on + `pokaż`; pin and tracks on the overlay
- `05d-pin-at-overlay.png` — crop at the overlay pin: accent fill, white ring, halo, dashed past nearby
- `05c-track-crop.png` / `05e-track-wide.png` — amber arrow with ink outline

## Doctor

See `doctor.json`. SRI live, `latestTime` 1788384300, age ~1.6–5 min, `overlayCount` 7, `echoCount` 1175. IMGW + PERUN unavailable.

`GROWTH_MATH_ENABLED` stays `false`.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
