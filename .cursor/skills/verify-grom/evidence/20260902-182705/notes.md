# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-182705
**OK:** true
**When:** 2026-09-02T18:27:05.238Z → 2026-09-02T18:27:12.248Z

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

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · TERYT **1465**. Echo **36 km**, ETA **—**. Chip **SZANSA 10%**. Headline Badge **CLEAR**. Slider **`20:25 Radar IMGW`**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed. **Czysto**. Echo **7 km · słaby**, ETA **teraz**. Headline Badge still **CLEAR**. Slider **`20:25 Radar IMGW`**.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, `latestTime` **1788373500** = `2026-09-02T18:25:00.000Z`, age 1.9 min, `overlayCount: 7`. IMGW + PERUN unavailable.
- Second load (`04-chip-quote.png`, `chip.json`): Badge `textContent` **`clear`**, `innerText` **`CLEAR`** (Badge `uppercase`). Live `threat.level` is not `now`, so **NOW** / **TERAZ** is not on screen.
- `GROWTH_MATH_ENABLED` stays `false` in `trend.ts`.

## Level chip copy

- Before this PR, the same Badge rendered `{threat.level}`. `uppercase` painted `"now"` as **NOW**. Cited leftover: `docs/reviews/2026-09-01/07-ui-design-review.md`. Earlier drive `20260901-160834/aside-quote.json` quoted sheet text **NOW** under `Deszcz nad Tobą`.
- After this PR, `threatLevelChip("now")` is `"teraz"`. The same Badge would paint **TERAZ**. Live weather on this instance stayed `clear`, so the on-screen chip is **CLEAR**.
