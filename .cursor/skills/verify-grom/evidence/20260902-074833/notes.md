# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-074833
**OK:** true
**When:** 2026-09-02T07:48:33.238Z → 2026-09-02T07:48:37.056Z

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

## Doctor / listing cache

Doctor worth driving: `analysisSource: sri`, radar age 3.4 min, overlayCount 4. IMGW warnings and PERUN unavailable (skip those assertions). First `getSnapshot` 11523 ms — listing was cold.

Vite log (`/tmp/verify-grom/vite.log`):

- `[sri-list] miss` — first snapshot (cold isolate)
- `[sri-list] hit` — later `getSriOverlay` for an uncached time, 10 ms (in-process TTL; same Vite process)

Second `getSnapshot` 527 ms (90 s `radarScanCache`). Snapshot did not hang past the existing abort.
