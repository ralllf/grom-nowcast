# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-231029
**OK:** true
**When:** 2026-09-02T23:10:29.063Z → 2026-09-02T23:10:34.091Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

Dialog quote (`02-settings-dialog.png`): `[role="dialog"][aria-labelledby="settings-title"]` has **`aria-modal="true"`**. Headings **`Miejsce`** (search, **Użyj GPS**, city chips including Warszawa selected) and **`Alerty`** (Włącz under Alerty na pinezkę). Intro: **`Wybierz miasto albo stuknij mapę.`** Layer checkboxes are not in the dialog — **Pokaż mżawkę** / **tor komórki** stay on the map.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 01:05 · 01:35 · 02:05 · 02:35
3. timeline aria: Brak opadu od 01:05 do 02:35
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 01:05 · 6 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 01:05 · 6 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 01:05 · 01:35 · 02:05 · 02:35
16. Kraków timeline aria: Opad od 02:00 do 02:05, najsilniej ok. 02:00

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
