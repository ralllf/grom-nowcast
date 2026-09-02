# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-205619
**OK:** true
**When:** 2026-09-02T20:56:19.695Z → 2026-09-02T20:56:24.203Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. trio labels: Szansa · Za ile · Echo
3. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
4. localStorage place.label before=null
5. click button[aria-label="Ustawienia"]
6. dialog open: Lokalizacja i alerty
7. click city chip "Kraków"
8. sheet shows Kraków (no TERYT); dialog closed

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `trio.json` — live `dt`/`dd` quote of the trio (this slice)

## Live trio labels (this slice)

DOM `textContent` **Szansa · Za ile · Echo**. Expanded `innerText` **SZANSA · ZA ILE · ECHO** (`uppercase` on Stat). **No `ETA`.** `sheetHasETA: false` on both pins.

- Warszawa (`01-warszawa-sheet.png`): place **Warszawa** · headline **Czysto** · chip **CZYSTO**. Trio **SZANSA 10%** · **ZA ILE 74 min** · **ECHO 48 km**. Slider **`22:50 Radar IMGW`**. Honesty line uses **Za ile**, not ETA.
- Kraków (`03-krakow-sheet.png`): place **Kraków** · headline **Czysto** · chip **CZYSTO**. Trio **SZANSA 10%** · **ZA ILE —** · **ECHO 44 km**. Dialog closed. `grom-settings-v1.place.terc` still **1261**. **No `TERYT`.** **No `ETA`.**

Doctor: `analysisSource: sri`, radar age 6.2 min, `overlayCount` 7, `echoCount` 1162. IMGW + PERUN unavailable. `GROWTH_MATH_ENABLED` stays `false`.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
