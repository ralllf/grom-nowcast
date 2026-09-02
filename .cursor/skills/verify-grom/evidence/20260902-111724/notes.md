# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-111724
**OK:** true
**When:** 2026-09-02T11:18:12.095Z → 2026-09-02T11:18:16.795Z

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

Rain is in play on the Kraków pin after the chip click — nowcast sheet exercised.

- Warszawa (default, `01-warszawa-sheet.png`): **Czysto** · Szansa 10% · ETA **minie** · Echo 38 km · *Idzie od południowego zachodu → na północny wschód · 20 km/h* · *Tor minie Warszawa ok. 67 km obok* · Komórka rośnie.
- Kraków (after chip, `03-krakow-sheet.png`): **Ulewa nadciąga** · Szansa 90% · ETA **12 min** · Echo 18 km · *Idzie od północy → na południe · 52 km/h* · *Dojście nad Kraków: ok. 12 min* · timeline `Opad nad pinezką · 90 min` present · *z ruchu echa*.
- Doctor: `analysisSource: sri`, radar age 3.2 min, `overlayCount: 7`, `echoCount: 3932`. Live snapshot on Warszawa (`52.2297, 21.0122`, TERYT `1465`).
- IMGW warnings + PERUN unavailable — skipped those assertions. Headline stayed nowcast-only (`Czysto` / `Ulewa nadciąga`), not an IMGW watch title.

Dense-field advection is live on this instance: Kraków’s 12 min ETA and 90-min strip come from the interpolated field + iterated back-trajectory, not a single primary vector for every sample.
