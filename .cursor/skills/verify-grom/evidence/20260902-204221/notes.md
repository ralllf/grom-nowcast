# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-204221
**OK:** true
**When:** 2026-09-02T20:42:21.659Z → 2026-09-02T20:42:26.346Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków (no TERYT); dialog closed

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip

## Live sheet quotes (no TERYT)

- Warszawa (default, `01-warszawa-sheet.png`): place **Warszawa** · headline **Czysto** · chip **CZYSTO**. Box: **Idzie od zachodu → na wschód · 39 km/h** · **Spodziewaj się: słabego deszczu** · **Komórka rośnie**. Echo **14 km**, ETA **78 min**, Szansa **10%**. Slider **`22:40 Radar IMGW`**. **No `TERYT`.**
- Kraków (after chip, `03-krakow-sheet.png`): place **Kraków** · headline **Czysto** · chip **CZYSTO**. Echo **20 km**, ETA **—**, Szansa **10%**. Dialog closed. `grom-settings-v1.place.terc` still **1261**. **No `TERYT`.**

Doctor: `analysisSource: sri`, radar age 2.3 min, `overlayCount` 7, `echoCount` 1091. IMGW + PERUN unavailable. `GROWTH_MATH_ENABLED` stays `false`.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
