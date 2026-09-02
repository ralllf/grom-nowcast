# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-222422
**OK:** true
**When:** 2026-09-02T22:24:22.032Z → 2026-09-02T22:24:28.176Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

Live radar was **fresh** (doctor age 4.2 min, drive quote `Radar 00:20 · 4 min`). Stale (>30 min) amber peek + `alert wstrzymany`, and offline `Bez sieci · ostatni radar HH:MM`, are proven by `threat-sheet.test.ts` — not by driving a stale/offline production boundary.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 00:20 · 00:50 · 01:20 · 01:50
3. timeline aria: Brak opadu od 00:20 do 01:50
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 00:20 · 4 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 00:20 · 4 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 00:20 · 00:50 · 01:20 · 01:50
16. Kraków timeline aria: Brak opadu od 00:20 do 01:50

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor. `GROWTH_MATH_ENABLED` stays `false`.
