# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-202633
**OK:** true
**When:** 2026-09-02T20:26:33.937Z → 2026-09-02T20:26:39.310Z

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

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `04-tracks-pokaz.png` — same Vite instance; `tor komórki` on + `pokaż` (not the shipped location-pin path)
- `tracks-warszawa/01-tracks-off.png` — swiftshader Warszawa, chip off, L3 gold legend + map
- `05-track-arrow-crop.png` — map crop near Pabianice: L3 gold pixel next to L4 red, not the same hue

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet (success check)

Drove the Vite instance on `http://127.0.0.1:8080` (not production). Location-pin path completed.

- Warszawa (default, `01-warszawa-sheet.png`): headline **Czysto** · TERYT **1465**. Echo **47 km**, Szansa **10%**. Chip **CZYSTO**. Slider **`22:25 Radar IMGW`**.
- Dialog (`02-settings-dialog.png`): **Lokalizacja i alerty**.
- Kraków (after chip, `03-krakow-sheet.png`): headline **Czysto**. Place **Kraków** + **TERYT 1261**; dialog closed. Echo **13 km**.
- `grom-settings-v1.place.label` → `Kraków` (`terc` `1261`, `instrumental` `Krakowem`).
- Doctor: `analysisSource: sri`, `latestTime` **1788380700**, age 1.4 min, `overlayCount: 7`, `echoCount: 1131`. IMGW + PERUN unavailable.
- `GROWTH_MATH_ENABLED` stays `false` in `trend.ts`.

## Tracks visible? L3 swatch?

**Tracks are off by default.** On the location-pin screenshots the `tor komórki` chip is `aria-pressed=false` (grey dot). No amber arrows on the map.

Turned the chip on and clicked `pokaż` on the same Vite instance (`04-tracks-pokaz.png`):

- Chip `aria-pressed=true`. Dot is exact amber **`#f0a202`** (`rgb(240,162,2)` on the pill — 62 full-page pixels). Not vermilion `#e4572e` (0 px) and not L4 `#e62800`.
- Overlay canvas after `pokaż`: **896** opaque pixels, **202** amber-soft (`#f0a202` family), 13 vermilion-range (ink/amber AA only). Tracks **are drawn**.
- Fresh-load canvas with the chip off: **0** amber pixels.

**L3 swatch / timeline / map** (legend chips, same `LEVEL_SWATCH`):

- `01-warszawa-sheet.png` and `tracks-warszawa/01-tracks-off.png`: **44** pixels within 16 of gold **`#e8b400`**, **0** of old yellow `#ffc500`, **44** of L4 `#e62800` (the `ulewny` chip). Timeline bars empty (`nic w oknie 90 min` — Czysto).
- Map raster near Pabianice (`05-track-arrow-crop.png`): one **gold** L3 cell next to an L4 **red** cell — not the same hue as the track.

## Live headlines

- Warszawa: **Czysto**
- After Kraków chip: **Czysto**
