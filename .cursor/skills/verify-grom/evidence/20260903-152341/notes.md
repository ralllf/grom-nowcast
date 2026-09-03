# Drive: pin-alerts

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-152341
**OK:** true
**When:** 2026-09-03T15:23:41.114Z → 2026-09-03T15:23:46.169Z

## Action → state

Enabled pin alerts, Testuj alert showed Deszcz za ok. 18 min for Warszawa, dismissed banner, log + grom-alerts-v1 kept the title. Sheet still Warszawa / Szansa / Za ile.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. timeline ticks: 17:20 · 17:50 · 18:20 · 18:50
4. timeline aria: Brak opadu od 17:20 do 18:50
5. trio labels: Za ile · Szansa
6. status row: Radar 17:20 · 4 min · IMGW ✕ · wyładowania ✕
7. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Warszawa
8. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
9. click button[aria-label="Ustawienia"]
10. dialog open: Lokalizacja i alerty
11. alerts toggle was Włącz
12. click "Testuj alert"
13. banner: Deszcz za ok. 18 min · Warszawa
14. click button[aria-label="Zamknij alert"]
15. sheet still Warszawa + Szansa / Za ile after test alert

## Side effects

- `grom-alerts-v1` {"storage":"grom-alerts-v1","title":"Deszcz za ok. 18 min"}

## Screenshots

- `01-sheet-before.png` — sheet after snapshot, default pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open
- `03-test-banner.png` — `Testuj alert` banner
- `04-sheet-after.png` — dialog closed, sheet unchanged

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
