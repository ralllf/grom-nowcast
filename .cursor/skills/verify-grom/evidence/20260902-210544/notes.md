# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-210544
**OK:** true
**When:** 2026-09-02T21:05:44.234Z → 2026-09-02T21:05:53.542Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. trio labels: Szansa · Za ile · Echo
3. status row: Radar 23:00 · 6 min · IMGW ✕ · wyładowania ✕
4. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
5. Warszawa sheet scrolled to status row
6. localStorage place.label before=null
7. click button[aria-label="Ustawienia"]
8. dialog open: Lokalizacja i alerty
9. click city chip "Kraków"
10. sheet shows Kraków (no TERYT); dialog closed
11. Kraków status row: Radar 23:00 · 6 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Status row (this slice)

Live `#grom-threat-sheet` quote, both pins:

> Radar 23:00 · 6 min · IMGW ✕ · wyładowania ✕

- Grey (`text-faint`). Radar age 6 min — not stale, not down, so not amber.
- Sheet `innerText` does **not** contain `Wyładowania chwilowo niedostępne` or `Ostrzeżenia IMGW chwilowo niedostępne`.
- Desktop aside still shows `Ostrzeżenia IMGW chwilowo niedostępne` (aside, not the sheet).
- Doctor: SRI, `latestTime` 1788382800, age 6 min, `warningsUnavailable` + `lightningUnavailable` true.

`GROWTH_MATH_ENABLED` stays `false`.
