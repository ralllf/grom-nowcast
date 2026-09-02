# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-201745
**OK:** true
**When:** 2026-09-02T20:18:03.738Z → 2026-09-02T20:18:08.601Z

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

- `04-loaded-echo.png` — second load, Echo stats quoted (`echo.json`)
- `ssr-loading.json` — GET `/` SSR HTML while `Skanuję radar…` (threat still null)

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Echo copy (this slice)

- SSR first paint (`ssr-loading.json`): headline **Skanuję radar…**, Peek + expanded Echo **—** (em dash). HTML has no Echo `brak`. This is the threat-null / scanning path.
- After snapshot, Warszawa (`01-warszawa-sheet.png`, `04-loaded-echo.png`, `echo.json`): headline **Czysto**, Badge **CZYSTO**, Echo **11 km** (peek + expanded). Not a false all-clear. ETA **—**. Szansa **10%**.
- After Kraków chip (`03-krakow-sheet.png`): **Kraków** + **TERYT 1261**. Echo **15 km**. Still not Echo brak.
- Doctor: `analysisSource: sri`, `latestTime` **1788380100**, age 3 min, `overlayCount: 7`, `echoCount: 1329`. IMGW + PERUN unavailable.
- `GROWTH_MATH_ENABLED` stays `false` in `trend.ts`.
