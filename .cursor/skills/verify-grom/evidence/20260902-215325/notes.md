# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-215325
**OK:** true
**When:** 2026-09-02T21:53:25.060Z → 2026-09-02T21:53:29.296Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 23:50 · 00:20 · 00:50 · 01:20
3. timeline aria: Brak opadu od 23:50 do 01:20
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 23:50 · 3 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. Warszawa sheet scrolled to status row
8. localStorage place.label before=null
9. click button[aria-label="Ustawienia"]
10. dialog open: Lokalizacja i alerty
11. click city chip "Kraków"
12. sheet shows Kraków (no TERYT); dialog closed
13. Kraków status row: Radar 23:50 · 3 min · IMGW ✕ · wyładowania ✕
14. Kraków timeline ticks: 23:50 · 00:20 · 00:50 · 01:20
15. Kraków timeline aria: Opad od 00:25 do 01:05, najsilniej ok. 00:25

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Timeline clocks (this slice)

Live Warsaw ticks on the 90-min strip (not `teraz 24 54 84 min`):

- Warszawa: **23:50 · 00:20 · 00:50 · 01:20**
- aria (dry): **Brak opadu od 23:50 do 01:20**
- now-cursor: present (`hasNowCursor: true`)
- Kraków: same ticks **23:50 · 00:20 · 00:50 · 01:20**
- aria (wet): **Opad od 00:25 do 01:05, najsilniej ok. 00:25**

Radar slider and status row both say **23:50**; first tick matches the scan, last tick is +90 min (**01:20**). Age 3.4 min — old `wallClockAxisLabel` would have printed `teraz` / `27` / `57` / `87 min`.

Doctor: SRI, `latestTime` 1788385800, age 3.4 min, `overlayCount` 7, `echoCount` 1213. IMGW + PERUN unavailable.

`GROWTH_MATH_ENABLED` stays `false`.
