# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-100818
**OK:** true
**When:** 2026-09-02T10:08:18.843Z → 2026-09-02T10:08:23.500Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Ulewa nadciąga
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków + TERYT 1261; dialog closed

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

- Warszawa: **Ulewa nadciąga** · Szansa 90% · ETA 12 min · Echo 17 km · IMMINENT · Idzie od zachodu → na wschód 44 km/h · Spodziewaj się: silną ulewę, porywy wiatru.
- Kraków: **Czysto** · Szansa 10% · ETA minie · Echo 20 km · miss ~65 km · Idzie od zachodu → na wschód 34 km/h · Spodziewaj się: deszcz i mokrą jezdnię.
- Doctor: `analysisSource: sri`, radar age 2.9 min, `overlayCount: 7`, `echoCount: 3181`. Live `getSnapshot` `radar.cellKm` is **3**. IMGW + PERUN unavailable.
- This live frame is under the old 9 000 cap; the 3 km stay on a ~9k / full-bbox field is proven by `radar-grid.test.ts`.

