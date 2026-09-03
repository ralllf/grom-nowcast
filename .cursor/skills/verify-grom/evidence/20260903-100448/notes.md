# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-100448
**OK:** true
**When:** 2026-09-03T10:04:48.332Z → 2026-09-03T10:04:54.608Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 12:00 · 12:30 · 13:00 · 13:30
3. timeline aria: Brak opadu od 12:00 do 13:30
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 12:00 · 5 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 12:00 · 5 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 12:00 · 12:30 · 13:00 · 13:30
16. Kraków timeline aria: Opad od 12:00 do 12:25, najsilniej ok. 12:00

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row
- `04-imgw-aside.png` — desktop aside after hydrate (IMGW down)

## IMGW aside quote

SSR (`GET /` before hydrate, also first CDP paint):

> Ostrzeżenia IMGW
>
> Pobieram komunikaty…

Does **not** contain `0 burzowych w kraju`. Does **not** contain `radaru albo ostrzeżeń`.

After hydrate (CDP `aside.innerText`, `aside-quote.json`, `04-imgw-aside.png`). Doctor: `warningsUnavailable: true`, `stormWarningCount: 0` (API miss — not a real clear-country count):

> Ostrzeżenia IMGW
>
> Ostrzeżenia IMGW chwilowo niedostępne

Does **not** contain `0 burzowych w kraju`. Does **not** contain `Pobieram komunikaty…`. Does **not** contain `Nie udało się pobrać radaru albo ostrzeżeń`. No `albo`. IMGW-down copy names ostrzeżenia only. Radar-down copy is absent (radar was fine — status row `Radar 12:00 · 5 min · IMGW ✕ · wyładowania ✕`).

`GROWTH_MATH_ENABLED` stays **false**.

Mocks: none. Nominatim not used (city chip). Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
