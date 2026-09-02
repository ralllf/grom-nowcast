# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-193122
**OK:** true
**When:** 2026-09-02T19:31:38.124Z → 2026-09-02T19:31:43.913Z

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
- `04-chip-quote.png` — second load, headline Badge quoted
- `chip.json` — DOM quote of that Badge

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · TERYT **1465**. Echo **11 km**, ETA **63 min**. Chip **SZANSA 10%**. Headline Badge **CZYSTO**. Slider **`21:30 Radar IMGW`**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed. **Czysto**. Echo **29 km**, ETA **—**. Headline Badge still **CZYSTO**. Slider **`21:30 Radar IMGW`**.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, `latestTime` **1788377400** = `2026-09-02T19:30:00.000Z`, age 1.6 min, `overlayCount: 7`. IMGW + PERUN unavailable.
- Second load (`04-chip-quote.png`, `chip.json`): Badge `textContent` **`czysto`**, `innerText` **`CZYSTO`** (Badge `uppercase`). Live `threat.level` is `clear`. Chip is **CZYSTO**, not **CLEAR**.
- `GROWTH_MATH_ENABLED` stays `false` in `trend.ts`.

## Level chip copy

- #45 mapped `now` → `teraz`. Other levels still leaked the English enum key.
- After this PR, `threatLevelChip` maps `now|imminent|nearby|watch|clear` → `teraz|zaraz|blisko|uwaga|czysto`. The same Badge paints **TERAZ / ZARAZ / BLISKO / UWAGA / CZYSTO**. Live weather on this instance stayed `clear`, so the on-screen chip is **CZYSTO**.
