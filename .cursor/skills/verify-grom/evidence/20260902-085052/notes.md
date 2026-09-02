# Drive: radar-map

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-085052
**OK:** true
**When:** 2026-09-02T08:50:52.679Z → 2026-09-02T08:50:57.898Z

## Action → state

Fresh load: tor komórki aria-pressed=false, overlay amber pixels=0. Chip on: aria-pressed=true, overlay amber pixels=552. Sheet unchanged.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Czysto
3. tor komórki chip present=true aria-pressed=false
4. overlay canvas amber pixels (off)=0
5. overlay canvas amber pixels (on)=552

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","tracksMap":true}

## Screenshots

- `01-tracks-off.png` — fresh load, `tor komórki` aria-pressed false, no orange arrows
- `02-tracks-on.png` — chip on, arrows drawn

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Doctor

Worth driving. `analysisSource: sri`, radar age 5.6 min, `overlayCount: 4`, echoCount 2032. IMGW warnings and PERUN unavailable (skip those assertions). Sheet: Warszawa · TERYT 1465 · Czysto.

## Overlay geometry (live getSriOverlay)

`overlay-geom.json`: PNG 5592 B for latest frame. MapLibre corners lock to the quoted ODIM `/where` UL/LR:

- TL = (11.6, 56.3)
- BR = (25.3, 48.0)
- UR ≈ (26.58529, 56.29999), LL ≈ (12.88528, 48.00000)

Warszawa is Czysto on this frame (echo 56 km) so the city zoom does not show rain colour — the national PNG still paints and the corners match decode.
