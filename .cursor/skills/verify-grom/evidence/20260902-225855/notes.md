# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-225855
**OK:** true
**When:** 2026-09-02T22:58:55.478Z → 2026-09-02T22:59:00.123Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

GET `/` HTML (this Vite instance) quotes:

- `<link rel="manifest" href="/manifest.json"/>`
- `<meta name="theme-color" content="#e8edf2"/>`
- `<title>GROM</title>`

Same origin also served `/manifest.json` 200, `/icon.svg` 200, `/icon-192.png` 200, `/icon-512.png` 200. No service worker registered. Offline nowcast is not claimed.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 00:55 · 01:25 · 01:55 · 02:25
3. timeline aria: Brak opadu od 00:55 do 02:25
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 00:55 · 4 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 00:55 · 4 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 00:55 · 01:25 · 01:55 · 02:25
16. Kraków timeline aria: Brak opadu od 00:55 do 02:25
17. extra: GET `/` quotes `<link rel="manifest" href="/manifest.json"/>` and `<meta name="theme-color" content="#e8edf2"/>`

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor. `GROWTH_MATH_ENABLED` stays `false`. No Miejsce/Alerty split.
