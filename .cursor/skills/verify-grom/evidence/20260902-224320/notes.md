# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-224320
**OK:** true
**When:** 2026-09-02T22:43:20.778Z → 2026-09-02T22:43:25.622Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

Extra CDP on the same Vite instance (attribution.json): closed `<details>` **innerText** is the credit line plus the summary — **`Dane: IMGW-PIB · mapa OpenFreeMap/OSM`** and **`O danych ›`**. Closed sheet innerText has **no** `POLRAD` / `dBZ` / `Marshall–Palmer` / `COMPO_SRI` (those stay in `details.textContent`). After `details.open = true`, body is the legal paragraph starting **`Źródłem danych ostrzeżeń i sieci POLRAD…`** and ending **`Analiza: IMGW COMPO_SRI`**. Map chrome credit stays **`OpenFreeMap / OSM`**.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 00:40 · 01:10 · 01:40 · 02:10
3. timeline aria: Brak opadu od 00:40 do 02:10
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 00:40 · 3 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 00:40 · 3 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 00:40 · 01:10 · 01:40 · 02:10
16. Kraków timeline aria: Brak opadu od 00:40 do 02:10
17. extra CDP: visible credit `Dane: IMGW-PIB · mapa OpenFreeMap/OSM`; summary `O danych ›`; closed innerText has no COMPO_SRI/dBZ
18. extra CDP: open details body quotes POLRAD / dBZ / Marshall–Palmer / COMPO_SRI; map chrome still `OpenFreeMap / OSM`

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row (credit + O danych ›, no jargon)
- `04-odanych-closed.png` — details closed: `Dane: IMGW-PIB · mapa OpenFreeMap/OSM` + `O danych ›`
- `05-odanych-open.png` — details open: POLRAD / dBZ / Marshall–Palmer / COMPO_SRI

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor. `GROWTH_MATH_ENABLED` stays `false`.
