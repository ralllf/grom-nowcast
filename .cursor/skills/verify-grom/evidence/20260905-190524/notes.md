# Drive: pin-alerts

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260905-190524
**OK:** true
**When:** 2026-09-05T19:05:24.994Z → 2026-09-05T19:05:37.523Z

## Action → state

Enabled pin alerts, Testuj alert showed Deszcz za ok. 18 min for Warszawa, dismissed banner, log + grom-alerts-v1 kept the title. Sheet still Warszawa / Szansa / Za ile.

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
10. click button[aria-label="Ustawienia"]
11. dialog open: Lokalizacja i alerty
12. alerts toggle was Włącz
13. click "Testuj alert"
14. banner: Deszcz za ok. 18 min · Warszawa
15. click button[aria-label="Zamknij alert"]
16. sheet still Warszawa + Szansa / Za ile after test alert

## Side effects

- `grom-alerts-v1` {"storage":"grom-alerts-v1","title":"Deszcz za ok. 18 min"}

## Screenshots

- `01-sheet-before.png` — sheet after snapshot, default pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-test-banner.png` — `Testuj alert` banner
- `04-sheet-after.png` — dialog closed, sheet unchanged

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
