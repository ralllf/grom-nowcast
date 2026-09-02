# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-172619
**OK:** true
**When:** 2026-09-02T17:26:46.680Z → 2026-09-02T17:26:53.112Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Czysto
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków + TERYT 1261; dialog closed

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `04-slider-and-sheet-clocks.png` — second load, slider + sheet clocks quoted
- `clocks.json` — DOM quote from that load

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · TERYT **1465**. Echo **brak**, ETA **—**. Chip **SZANSA 10%**. Overlay query still settling. Slider **`19:25`** next to **`poprzednia klatka`**. Sheet **`Radar 19:25 · poprzednia klatka`**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed. **Czysto**. Echo **16 km**, chip **SZANSA 10%**. Slider **`19:25 Radar IMGW`**. Sheet **`Radar IMGW 19:25 · sprzed 2 min`**.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, `latestTime` **1788369900** = `2026-09-02T17:25:00.000Z`, age 1.8 min, `overlayCount: 7`. Process TZ **UTC**. Unpinned `formatClock` would print **`17:25`**.
- Second load (`04-slider-and-sheet-clocks.png`, `clocks.json`): slider present (`value` 6 / `max` 6). Slider clock **`19:25`**. Source **`Radar IMGW`**. Sheet **`Radar IMGW 19:25 · sprzed 2 min`**. Same Warsaw minute on both. IMGW warnings + PERUN unavailable.
