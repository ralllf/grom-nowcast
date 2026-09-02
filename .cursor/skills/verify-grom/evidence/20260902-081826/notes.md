# Drive: location-pin (Nominatim search guard)

**Feature:** location-pin — city chip + one Nominatim search
**Base:** http://127.0.0.1:8080 (this run’s Vite; not production)
**Out:** `.cursor/skills/verify-grom/evidence/20260902-081826`
**OK:** true
**When:** 2026-09-02T08:18:26.577Z → 2026-09-02T08:18:30.437Z

Doctor: worth driving. `analysisSource: sri`, radar age 3.3 min, `overlayCount: 4`. IMGW warnings and PERUN unavailable (skip those assertions).

## Action → resulting state

Viewport `1280×800`. Fresh Chrome profile (empty `grom-settings-v1`). Sheet `#grom-threat-sheet` not `Skanuję radar…`.

| Control | Before | After Kraków chip |
|---|---|---|
| Sheet pin | `Warszawa` · `TERYT 1465` · Czysto | `Kraków` · `TERYT 1261` |
| Dialog | closed | opened `Lokalizacja i alerty`, then closed |
| `grom-settings-v1.place.label` | `null` (no key) | `Kraków` |
| `grom-settings-v1.place.terc` | — | `1261` |

Search form (`Szukaj miasta w Polsce` / `Szukaj`) was not clicked in Chrome. One live `searchPlaces` POST for `Zgorzelec` (same CSRF headers as doctor) returned three `Zgorzelec` rows in 373 ms; the identical POST  immediately after returned the same labels in 6 ms (cache hit, no second Nominatim wait).

## Steps

1. `launch.sh` → Vite PID in `/tmp/verify-grom/launch.json`
2. `doctor.mjs` → `ok: true`, SRI overlays, IMGW/PERUN down
3. Chrome CDP 1280×800. Wait until sheet is not `Skanuję radar…`
4. Screenshot `01-warszawa-sheet.png` — default Warszawa pin
5. Click `button[aria-label="Ustawienia"]` → dialog `Lokalizacja i alerty`
6. Screenshot `02-settings-dialog.png`
7. Click city chip whose exact text is `Kraków`
8. Dialog gone; sheet `Kraków` + `TERYT 1261`; `localStorage` matches
9. Screenshot `03-krakow-sheet.png`
10. POST `searchPlaces` `Zgorzelec` twice (one upstream, one cache)

## Side effects

- `grom-settings-v1.place` became Kraków TERYT 1261 (throwaway Chrome profile).
- One Nominatim search for `Zgorzelec`; second call served from the new search LRU.

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
