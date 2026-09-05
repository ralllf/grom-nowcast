# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260905-190439
**OK:** true
**When:** 2026-09-05T19:04:39.113Z → 2026-09-05T19:04:44.672Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. sheet ready: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
4. timeline ticks: 21:00 · 21:30 · 22:00 · 22:30
5. timeline aria: Opad od 21:20 do 22:30, najsilniej ok. 21:35
6. trio labels: Za ile · Szansa
7. status row: Radar 21:00 · 5 min · IMGW ✓ · wyładowania ✕
8. sheet ready, starts with pin copy: Deszcz nadciąga | ZARAZ |  | Warszawa
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. Warszawa sheet scrolled to status row
11. localStorage place.label before=null
12. click button[aria-label="Ustawienia"]
13. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
14. click city chip "Kraków"
15. sheet shows Kraków (no TERYT); dialog closed
16. Kraków status row: Radar 21:00 · 5 min · IMGW ✓ · wyładowania ✕
17. Kraków timeline ticks: 21:00 · 21:30 · 22:00 · 22:30
18. Kraków timeline aria: Brak opadu od 21:00 do 22:30

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
