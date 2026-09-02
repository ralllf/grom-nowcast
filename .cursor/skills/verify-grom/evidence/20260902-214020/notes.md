# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-214020
**OK:** true
**When:** 2026-09-02T21:40:20.197Z → 2026-09-02T21:40:25.876Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261.

## Steps

1. navigate http://127.0.0.1:8080/
2. trio labels: Szansa · Za ile · Echo
3. status row: Radar 23:35 · 5 min · IMGW ✕ · wyładowania ✕
4. sheet ready, starts with pin copy: Warszawa |  | Czysto | CZYSTO
5. Warszawa sheet scrolled to status row
6. localStorage place.label before=null
7. click button[aria-label="Ustawienia"]
8. dialog open: Lokalizacja i alerty
9. click city chip "Kraków"
10. sheet shows Kraków (no TERYT); dialog closed
11. Kraków status row: Radar 23:35 · 5 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row
- `04-mobile-peek.png` — 390×844 default peek (live level `Czysto`, no auto-expand)
- `05-mobile-half.png` — same viewport after handle tap → half detent

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Sheet height (this slice)

Live level was **Czysto** — auto-expand did not fire (correct). Mobile 390×844 `#grom-threat-sheet`:

**Peek (default)** — `04-mobile-peek.png` / `peek-height.json`

- classes: `max-h-[128px] min-h-24` (no `max-h-[70dvh]`)
- computed `max-height`: **128px**
- computed height: **96px** (content is `min-h-24`; cap is 128)
- `aria-expanded`: false
- headline: Czysto · Warszawa · Szansa 10% · Za ile — · Echo brak
- map still shows the header, slider, and chips above the strip

**Half (handle tap)** — `05-mobile-half.png` / `half-height.json`

- classes: `max-h-[45dvh] overflow-hidden`
- computed `max-height`: **379.8px** (= 45% of 844)
- computed height: **379.8px**
- `aria-expanded`: true
- map remains visible above the sheet (not 70dvh)

Doctor: SRI, `latestTime` 1788384900, age 5.2 min, `overlayCount` 7, `echoCount` 1178. IMGW + PERUN unavailable.

`GROWTH_MATH_ENABLED` stays `false`.
