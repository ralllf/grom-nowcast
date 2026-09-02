# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-211840
**OK:** true
**When:** 2026-09-02T21:18:40.248Z → 2026-09-02T21:18:45.473Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. trio labels: Szansa · Za ile · Echo
3. status row: Radar 23:15 · 4 min · IMGW ✕ · wyładowania ✕
4. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
5. Warszawa sheet scrolled to status row
6. localStorage place.label before=null
7. click button[aria-label="Ustawienia"]
8. dialog open: Lokalizacja i alerty
9. click city chip "Kraków"
10. sheet shows Kraków (no TERYT); dialog closed
11. Kraków status row: Radar 23:15 · 4 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row
- `04-map-chips.png` — `tor komórki` + `pokaż` + `Pokaż mżawkę` on the map
- `05-city-chips.png` — settings city chips (Warszawa selected)

## Chips + faint (this slice)

Live `getBoundingClientRect` on the instance (see `chips.json`):

| Control | height |
|---|---|
| pokaż | **36px** |
| tor komórki | **36px** |
| Pokaż mżawkę | **36px** |
| Warszawa city chip | **36px** |
| Kraków city chip | **36px** |

IMGW map chip not on screen (`warningsUnavailable`). Presets hidden until alerts on — same `CHIP` class as city chips.

Computed `--color-faint` on the page: **`#7a8593`** (`rgb(122, 133, 147)`).

`GROWTH_MATH_ENABLED` stays `false`.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
