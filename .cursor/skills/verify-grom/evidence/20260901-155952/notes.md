# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260901-155952
**OK:** true
**When:** 2026-09-01T15:59:52.946Z → 2026-09-01T15:59:57.125Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261. Then opened settings again and chose Gdańsk (the 2026-09-01 17:18 CEST live pin) to read sheet copy.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Deszcz nadciąga
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków + TERYT 1261; dialog closed

## Side effects

- `grom-settings-v1` place = `{"lat":50.0647,"lon":19.945,"label":"Kraków","city":"Kraków","terc":"1261"}`

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `04-gdansk-sheet.png` — sheet after Gdańsk chip (follow-up on the same Vite instance)

## Sheet copy (this radar scan)

No live pin was Echo `N km · słaby` over the pin (the 17:18 CEST Gdańsk case had already moved). Quotes anyway:

### Warszawa (default pin)

- Headline: **Deszcz nadciąga**
- Detail: Idzie od zachodu (~51 km/h), echo ok. 11 km od Warszawy. Dojście nad Warszawę: ok. 5 min. Spodziewaj się: deszcz i mokrą jezdnię. Szansa ~90%.
- Echo: **11 km** (no `· słaby` — pinLevel 0)
- Szansa: **90%**
- Hail words: none (`deszcz i mokrą jezdnię`)
- Story: both sides approaching (ETA 5 min). 90% here is ETA ≤ 20 + willHit (raw 70 remap) — parked, not this slice.

### Kraków

- Headline: (sheet body) Echo ok. 40 km od Kraków, od południa. Szansa ~10%.
- Echo: **40 km**
- Szansa: **10%**
- Hail words: none
- ETA: —

### Gdańsk (chip, TERYT 2261)

- Headline: **Opad nadciąga**
- Detail: Idzie od południowego zachodu (~44 km/h), echo ok. 12 km od Gdańsk. Dojście nad Gdańsk: ok. 22 min. Spodziewaj się: silną ulewę, porywy wiatru. Szansa ~55%.
- Echo: **12 km** (not `· słaby`)
- Szansa: **55%**
- Hail words: **none** (`silną ulewę, porywy wiatru` — no `możliwy grad`)
- Story: **nadciąga** + Dojście 22 min. Not `nad Gdańsk teraz`. Not Szansa 90.

The weak-pin + inbound klasa-4 case is locked by unit `weak pin echo + approaching klasa-4 cell: no hail, one story, not Szansa 90`.

Mocks: none. Nominatim not used (city chip). Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
