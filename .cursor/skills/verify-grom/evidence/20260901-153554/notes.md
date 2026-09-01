# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260901-153554
**OK:** true
**When:** 2026-09-01T15:35:54.415Z → 2026-09-01T15:35:58.561Z
**Feature driven:** `location-pin` (sheet on `/` after snapshot — radar caption visible)

## Radar caption (Europe/Warsaw)

Quoted from `#grom-threat-sheet` on both pins:

> **Radar IMGW 17:30 · sprzed 6 min**

Doctor snapshot: `latestTime` 1788276600 = **2026-09-01T15:30:00.000Z**. VM / process TZ is **UTC**. Unpinned `toLocaleTimeString("pl-PL")` would print **15:30**. Caption clock is **17:30** (CEST / Europe/Warsaw). Age stays unix-relative (`sprzed 6 min`). Same caption after Kraków chip.

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet and localStorage both show Kraków TERYT 1261. Caption remained `Radar IMGW 17:30 · sprzed 6 min`.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Ulewa nadciąga
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

Mocks: none. Nominatim not used (city chip). Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
