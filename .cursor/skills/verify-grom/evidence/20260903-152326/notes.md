# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-152326
**OK:** true
**When:** 2026-09-03T15:23:26.774Z → 2026-09-03T15:23:41.019Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. timeline ticks: 17:20 · 17:50 · 18:20 · 18:50
4. timeline aria: Brak opadu od 17:20 do 18:50
5. trio labels: Za ile · Szansa
6. status row: Radar 17:20 · 4 min · IMGW ✕ · wyładowania ✕
7. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Warszawa
8. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
9. Warszawa sheet scrolled to status row
10. localStorage place.label before=null
11. click button[aria-label="Ustawienia"]
12. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
13. click city chip "Kraków"
14. sheet shows Kraków (no TERYT); dialog closed
15. Kraków status row: Radar 17:20 · 4 min · IMGW ✕ · wyładowania ✕
16. Kraków timeline ticks: 17:20 · 17:50 · 18:20 · 18:50
17. Kraków timeline aria: Brak opadu od 17:20 do 18:50

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
