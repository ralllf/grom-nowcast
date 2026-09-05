# Drive: radar-map

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260905-190537
**OK:** true
**When:** 2026-09-05T19:05:37.668Z → 2026-09-05T19:05:42.129Z

## Action → state

Fresh load: tor komórki aria-pressed=false, overlay amber pixels=0. Chip on: aria-pressed=true, overlay amber pixels=1309. Sheet unchanged.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. sheet ready: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
4. timeline ticks: 21:00 · 21:30 · 22:00 · 22:30
5. timeline aria: Opad od 21:20 do 22:30, najsilniej ok. 21:35
6. trio labels: Za ile · Szansa
7. status row: Radar 21:00 · 6 min · IMGW ✓ · wyładowania ✕
8. sheet ready, starts with pin copy: Deszcz nadciąga | ZARAZ |  | Warszawa
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. tor komórki chip present=true aria-pressed=false
11. overlay canvas amber pixels (off)=0
12. overlay canvas amber pixels (on)=1309

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","tracksMap":true}

## Screenshots

- `01-tracks-off.png` — fresh load, `tor komórki` aria-pressed false, no orange arrows
- `02-tracks-on.png` — chip on, arrows drawn

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
