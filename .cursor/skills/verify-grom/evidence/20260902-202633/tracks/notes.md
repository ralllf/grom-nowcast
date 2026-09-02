# Drive: radar-map

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260902-202633/tracks
**OK:** false
**When:** 2026-09-02T20:27:28.670Z → 2026-09-02T20:27:46.629Z

## Action → state

chip on but overlay canvas has too few amber pixels (0)

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Kraków |  | TERYT 1261 | Czysto
3. tor komórki chip present=true aria-pressed=false
4. overlay canvas amber pixels (off)=0
5. overlay canvas amber pixels (on)=0

## Side effects

- none recorded

## Screenshots

- `01-tracks-off.png` — fresh load, `tor komórki` aria-pressed false, no orange arrows
- `02-tracks-on.png` — chip on, arrows drawn

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
