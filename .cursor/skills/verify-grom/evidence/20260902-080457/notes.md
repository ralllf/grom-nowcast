# Drive: radar-map

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260902-080457
**OK:** true
**When:** 2026-09-02T08:04:57.679Z → 2026-09-02T08:05:02.599Z

## Action → state

Fresh load: tor komórki aria-pressed=false, overlay amber pixels=0. Chip on: aria-pressed=true, overlay amber pixels=886. Sheet unchanged.

## Radar caption (quoted)

Doctor: `analysisSource: sri`, overlayCount 4, latestTime 1788336000 (2026-09-02 08:00 UTC = **10:00** Europe/Warsaw), age ~5 min.

- Sheet (`#grom-threat-sheet`): **Radar IMGW 10:00 · sprzed 5 min**
- Map clock chip (`aria-label="Źródło radaru na mapie"`): **Radar IMGW**

Paint matches analysis here (current SRI overlay). Caption is **Radar IMGW**, not a bare **Radar** and not **poprzednia klatka**. Slider clock still shows process-TZ `08:00` (pre-existing `formatClock`, not this slice).

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready, starts with pin copy: Warszawa |  | TERYT 1465 | Czysto
3. tor komórki chip present=true aria-pressed=false
4. overlay canvas amber pixels (off)=0
5. overlay canvas amber pixels (on)=886

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","tracksMap":true}

## Screenshots

- `01-tracks-off.png` — fresh load, `tor komórki` aria-pressed false, no orange arrows
- `02-tracks-on.png` — chip on, arrows drawn

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
