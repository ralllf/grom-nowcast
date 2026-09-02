# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-204948
**OK:** true
**When:** 2026-09-02T20:49:48.189Z → 2026-09-02T20:49:52.933Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
3. localStorage place.label before=null
4. click button[aria-label="Ustawienia"]
5. dialog open: Lokalizacja i alerty
6. click city chip "Kraków"
7. sheet shows Kraków (no TERYT); dialog closed

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip

## Live sheet quotes (copy split)

Day is **Czysto**. Box still printed expect on Warszawa; grey `detail` did **not** repeat `Spodziewaj się`.

- Warszawa (`01-warszawa-sheet.png`): place **Warszawa** · headline **Czysto** · chip **CZYSTO**. Box: **Idzie od zachodu → na wschód · 49 km/h** · **Spodziewaj się: słabego deszczu**. Grey detail: **Idzie od zachodu (~49 km/h), echo ok. 26 km od Warszawa. Dojście nad Warszawą: ok. 80 min. Szansa ~10%. To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie.** Echo **26 km**, ETA **80 min**, Szansa **10%**. Slider **`22:45 Radar IMGW`**. **No `TERYT`.** **No second `Spodziewaj się` in detail.** Detail keeps caveat + „to ruch echa”.
- Kraków (`03-krakow-sheet.png`): place **Kraków** · headline **Czysto** · chip **CZYSTO**. Box: **Idzie od zachodu → na wschód · 56 km/h** (no expect line). Grey detail: **Echo ok. 12 km od Kraków, od zachodu. Szansa ~10%. Komórka może też urosnąć na miejscu — tego radar nie zapowie.** Echo **12 km**, ETA **—**, Szansa **10%**. Dialog closed. `grom-settings-v1.place.terc` still **1261**. **No `TERYT`.** **No `Spodziewaj się` in detail.**

Doctor: `analysisSource: sri`, radar age 4.5 min, `overlayCount` 7, `echoCount` 1121. IMGW + PERUN unavailable. `GROWTH_MATH_ENABLED` stays `false`.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
