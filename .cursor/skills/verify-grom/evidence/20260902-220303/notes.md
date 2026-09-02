# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-220303
**OK:** true
**When:** 2026-09-02T22:03:03.848Z → 2026-09-02T22:03:09.415Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 00:00 · 00:30 · 01:00 · 01:30
3. timeline aria: Brak opadu od 00:00 do 01:30
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 00:00 · 3 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 00:00 · 3 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 00:00 · 00:30 · 01:00 · 01:30
16. Kraków timeline aria: Brak opadu od 00:00 do 01:30

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
