# Drive: location-pin (+ IMGW aside honesty)

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260901-160834
**OK:** true
**When:** 2026-09-01T16:08:52.435Z → 2026-09-01T16:08:56.860Z
**Feature:** location-pin on desktop 1280×800 so the IMGW aside is visible.

## Doctor

`warningsUnavailable: true`, `radarUnavailable: false`, `analysisSource: sri`, `stormWarningCount: 0` (API miss — not a real clear-country count). PERUN also down.

## IMGW aside quote

After snapshot (CDP `aside.innerText`, also `04-imgw-aside.png`):

> Ostrzeżenia IMGW
>
> Ostrzeżenia IMGW chwilowo niedostępne

Does **not** contain `0 burzowych w kraju`. Does **not** contain `Pobieram komunikaty…` after settle.

## Sheet honesty quote

`#grom-threat-sheet` includes:

- Radar nowcast: `Deszcz nad Tobą` / `Radar IMGW 16:05 · sprzed 6 min` (radar is up).
- IMGW line (separate, bottom): `Ostrzeżenia IMGW chwilowo niedostępne`
- PERUN: `Wyładowania chwilowo niedostępne`

No `Nie udało się pobrać radaru albo ostrzeżeń`. No `albo`. Radar-down copy is absent (radar was fine). IMGW-down copy names ostrzeżenia only.

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Deszcz nad Tobą
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków + TERYT 1261; dialog closed
8. CDP scrape of desktop `aside` + sheet (this notes file)

## Side effects

- `grom-settings-v1` place = `{"lat":50.0647,"lon":19.945,"label":"Kraków","city":"Kraków","terc":"1261"}`

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `04-imgw-aside.png` — desktop aside honesty after settle

Mocks: none. Nominatim not used (city chip). Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
