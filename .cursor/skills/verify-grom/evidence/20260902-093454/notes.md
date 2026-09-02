# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-093454
**OK:** true
**When:** 2026-09-02T09:34:54.832Z → 2026-09-02T09:34:59.346Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Czysto
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

## Doctor

SRI, radar age 4.7 min, `overlayCount: 7`. IMGW warnings and PERUN unavailable (sheet shows those banners; nowcast still drove).

## Live composite probe (Szczecin pin, same cached scan)

- Overlay corners still UL/LR: TL `11.6, 56.3` / BR `25.3, 48.0` (UR `26.59, 56.30`, LL `12.89, 48.00`).
- This frame’s echo lived at 15.49–24.34°E — no rain west of 13.8°E to keep. Units cover that clip; overlay already paints the full raster.
