# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-152205
**OK:** true
**When:** 2026-09-02T15:22:05.574Z → 2026-09-02T15:22:11.259Z

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

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · TERYT **1465**. Echo **51 km**, ETA **—**. Chip **SZANSA 10%**; body *Echo ok. 51 km od Warszawy. Szansa ~10%.* Honesty line *Komórka może też urosnąć na miejscu* still present (live growth math off).
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**; Warszawa chip highlighted. Background sheet still **SZANSA 10%**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed. **Czysto**. Echo **12 km**, ETA **—**, chip **SZANSA 10%**. Body: echo ~12 km, tor minie ~56 km obok, *Nad samym punktem szansa ~10%*. ChanceRung miss/echoFar still ships 10.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, radar age 1.9 min, `overlayCount: 7`, `echoCount: 2617`. Live snapshot on Warszawa (`52.2297, 21.0122`, TERYT `1465`).
- IMGW warnings + PERUN unavailable — skipped those assertions. Sheet shows *Wyładowania chwilowo niedostępne* and *Ostrzeżenia IMGW chwilowo niedostępne*.

Live `GROWTH_MATH_ENABLED` is **false** on this instance. This drive proves the pin + percent chip still work; Lagrangian ΔR tests are in `trend.test.ts` / `threat.test.ts` with the flag forced on.
