# Drive: radar-map

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-152346
**OK:** true
**When:** 2026-09-03T15:23:46.261Z → 2026-09-03T15:23:52.204Z

## Action → state

Fresh load: tor komórki aria-pressed=false, overlay amber pixels=0. Chip on: aria-pressed=true, overlay amber pixels=846. Sheet unchanged.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. timeline ticks: 17:20 · 17:50 · 18:20 · 18:50
4. timeline aria: Brak opadu od 17:20 do 18:50
5. trio labels: Za ile · Szansa
6. status row: Radar 17:20 · 4 min · IMGW ✕ · wyładowania ✕
7. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Warszawa
8. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
9. tor komórki chip present=true aria-pressed=false
10. overlay canvas amber pixels (off)=0
11. overlay canvas amber pixels (on)=846

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","tracksMap":true}

## Screenshots

- `01-tracks-off.png` — fresh load, `tor komórki` aria-pressed false, no orange arrows
- `02-tracks-on.png` — chip on, arrows drawn

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
