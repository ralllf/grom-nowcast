# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-223110
**OK:** true
**When:** 2026-09-02T22:31:10.111Z → 2026-09-02T22:31:14.913Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Live Idzie od

Warszawa and Kraków were **Czysto** with no direction box (no `comingFrom`). Wrocław chip (same Vite, after location-pin):

**`Idzie od zachodu na wschód · 35 km/h`**

No `→` in that line. Grey detail: `Opad jest nad Wrocławiem teraz. Komórka może też urosnąć na miejscu — tego radar nie zapowie.` — also no `→`. Remaining `→` on the page is the map-legend track glyph and the `dBZ → Marshall–Palmer` attribution (not direction copy). See `idzie-od.json` and `04-idzie-od-top.png`.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 00:25 · 00:55 · 01:25 · 01:55
3. timeline aria: Brak opadu od 00:25 do 01:55
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 00:25 · 6 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 00:25 · 6 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 00:25 · 00:55 · 01:25 · 01:55
16. Kraków timeline aria: Opad od 00:30 do 00:40, najsilniej ok. 00:35

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
