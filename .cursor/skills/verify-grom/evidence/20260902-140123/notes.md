# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-140123
**OK:** true
**When:** 2026-09-02T14:01:23.956Z → 2026-09-02T14:01:30.211Z

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

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · TERYT **1465**. Echo **67 km**, ETA **minie**. Chip **SZANSA 10%**; body *Nad samym punktem szansa ~10%*. Rain in play: cell ~67 km, miss ~96 km, receding/miss path — `echoFar` / miss ships 10, not a willHit mid-lead 50.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**; Warszawa chip highlighted. Background sheet still **SZANSA 10%**.
- Kraków (after chip, `03-krakow-sheet.png`): **Kraków** + **TERYT 1261**; dialog closed. **Opad jest nad Kraków teraz**, Echo **2 km · słaby**, ETA **teraz**. Chip **SZANSA 10%**. Klasa-1 over the pin does not raise `overPinKlasa2` (needs klasa ≥ 2) — still a percent, still 10, not the old close-echo 20.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`).
- Doctor: `analysisSource: sri`, radar age 1.4 min, `overlayCount: 7`, `echoCount: 3391`. Live snapshot on Warszawa (`52.2297, 21.0122`, TERYT `1465`).
- IMGW warnings + PERUN unavailable — skipped those assertions.

Szansa remap on this instance is by rung id. This drive only proves the pin + percent chip still work; rung-vs-raw tests are in `chance.test.ts` / `threat.test.ts`.

