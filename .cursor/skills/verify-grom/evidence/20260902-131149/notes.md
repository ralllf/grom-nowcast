# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-131149
**OK:** true
**When:** 2026-09-02T13:11:49.786Z → 2026-09-02T13:12:02.577Z

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

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): sheet ready with **Czysto** · TERYT **1465**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, radar age 6 min, `overlayCount: 7`, `echoCount: 4020`. Live snapshot on Warszawa (`52.2297, 21.0122`, TERYT `1465`).
- IMGW warnings + PERUN unavailable — skipped those assertions.

NCC slice is live on this instance: SRI motion at 2 km with overlap penalty; pack stays 3 km. This drive only proves the pin still works; 50 km/h / overlap tests are in `threat.test.ts`.

