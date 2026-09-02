# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-194830
**OK:** true
**When:** 2026-09-02T19:49:13.618Z → 2026-09-02T19:49:19.072Z

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

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): headline **Czysto** · TERYT **1465**. Detail: **Dojście nad Warszawą**: ok. 66 min. Box: **Spodziewaj się: słabego deszczu**. Echo **17 km**, ETA **66 min**, Szansa **10%**. Chip **CZYSTO**. Slider **`21:45 Radar IMGW`**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**. City chips still nominative: Warszawa (selected), Kraków, Wrocław, …
- Kraków (after chip, `03-krakow-sheet.png`): headline **Czysto**. Place **Kraków** + **TERYT 1261**; dialog closed. Echo **35 km**, ETA **—**. No `nad Kraków` nominative dump. Chip still **CZYSTO**. Slider **`21:45 Radar IMGW`**.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`, `instrumental` `Krakowem`).
- Doctor: `analysisSource: sri`, `latestTime` **1788378300** = `2026-09-02T19:45:00.000Z`, age 4 min, `overlayCount: 7`. IMGW + PERUN unavailable.
- `GROWTH_MATH_ENABLED` stays `false` in `trend.ts`.

## Live headlines

- Warszawa: **Czysto**
- After Kraków chip: **Czysto**
