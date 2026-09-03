# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260903-095404
**OK:** true
**When:** 2026-09-03T09:54:05.294Z → 2026-09-03T09:54:11.188Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. timeline ticks: 11:50 · 12:20 · 12:50 · 13:20
3. timeline aria: Brak opadu od 11:50 do 13:20
4. trio labels: Szansa · Za ile · Echo
5. status row: Radar 11:50 · 4 min · IMGW ✕ · wyładowania ✕
6. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
7. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
8. Warszawa sheet scrolled to status row
9. localStorage place.label before=null
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
12. click city chip "Kraków"
13. sheet shows Kraków (no TERYT); dialog closed
14. Kraków status row: Radar 11:50 · 4 min · IMGW ✕ · wyładowania ✕
15. Kraków timeline ticks: 11:50 · 12:20 · 12:50 · 13:20
16. Kraków timeline aria: Opad od 11:50 do 12:00, najsilniej ok. 11:50

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row

## Sheet copy (this radar scan)

Doctor: SRI, radar age **4.1 min**, IMGW ✕, PERUN ✕. Status row: `Radar 11:50 · 4 min · IMGW ✕ · wyładowania ✕`.

Today is **not** the 2026-09-01 17:18 CEST Gdańsk inbound klasa-4 case (Echo `5 km · słaby` + *Opad nadciąga* + *nad … teraz* + hail). Relied on unit fixture `Gdańsk weak pin:*` for that geometry.

### Warszawa (default pin)

- Headline: **Czysto** (badge CZYSTO)
- Detail: Echo ok. 76 km od Warszawy. Szansa ~10%. Komórka może też urosnąć na miejscu — tego radar nie zapowie.
- Echo: **76 km** (no `· słaby` — pinLevel 0)
- Szansa: **10%**
- Za ile: **—**
- Hail words: none
- Timeline aria: Brak opadu od 11:50 do 13:20

### Kraków (chip, TERYT 1261 in settings only)

- Place line: **Kraków** (no TERYT)
- Detail: **Opad jest nad Krakowem teraz.** Komórka może też urosnąć na miejscu — tego radar nie zapowie.
- Echo: **1 km · słaby**
- Szansa: **90%**
- Za ile: **teraz**
- Hail words: **none** (no *możliwy grad* / *możliwego gradu*)
- Story: **teraz** on detail and Za ile. Not *Opad nadciąga* + *nad … teraz*.
- Timeline aria: Opad od 11:50 do 12:00, najsilniej ok. 11:50

Hunch: Kraków 90% with Echo `słaby` is `pinMaxLevel >= 2` (Szansa still uses the 8 km max; Echo label is the mean). The pin is **under** the rain (1 km), not a far inbound klasa 4. That is not the Gdańsk leak this slice locks.

Mocks: none. Nominatim not used (city chip). Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
