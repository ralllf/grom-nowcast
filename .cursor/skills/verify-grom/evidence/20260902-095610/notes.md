# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-095610
**OK:** true
**When:** 2026-09-02T09:56:26.817Z → 2026-09-02T09:56:30.866Z

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

- Warszawa: **Czysto** · Szansa 10% · ETA minie · Echo 40 km. Pin class is not Ulewa (echo 40 km, miss ~83 km).
- Kraków: **Opad nadciąga** · Szansa 55% · ETA 33 min · Echo 32 km · Spodziewaj się: deszcz i mokrą jezdnię (not Ulewa nad Tobą).
- Doctor: `analysisSource: sri`, radar age 6.4 min, `overlayCount: 7`. IMGW + PERUN unavailable.
