# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260903-105414
**OK:** true
**When:** 2026-09-03T11:08:03.787Z → 2026-09-03T11:08:22.987Z

## Action → state

Peek at 390x844: max-h-[128px], 128px, no nested scroller or button, Za ile — @30px over Szansa 10% @18px, chip CZYSTO. Handle tap → max-h-[45dvh] at 347px with the status row "Radar 13:05 · 3 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 13:05 · 13:35 · 14:05 · 14:35
5. timeline aria: Brak opadu od 13:05 do 14:35
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Zgorzelec
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. Ustawienia tap 1 did not open the dialog (hydration?)
11. pin Kraków: chip CZYSTO · Czysto CZYSTO Kraków Za ile teraz Szansa 10% 13:05 13:35 14:05 14:35
12. pin Katowice: chip CZYSTO · Czysto CZYSTO Katowice Za ile minie Szansa 10% 13:05 13:35 14:05 14:35
13. pin Łódź: chip CZYSTO · Czysto CZYSTO Łódź Za ile — Szansa 10% 13:05 13:35 14:05 14:35
14. pin Poznań: chip CZYSTO · Czysto CZYSTO Poznań Za ile 32 min Szansa 50% 13:05 13:35 14:05 14:35
15. pin Wrocław: chip CZYSTO · Czysto CZYSTO Wrocław Za ile — Szansa 10% 13:05 13:35 14:05 14:35
16. pin Gdańsk: chip CZYSTO · Czysto CZYSTO Gdańsk Za ile 62 min Szansa 10% 13:05 13:35 14:05 14:35
17. pin Warszawa: chip CZYSTO · Czysto CZYSTO Warszawa Za ile — Szansa 10% 13:05 13:35 14:05 14:35
18. pin Lublin: chip CZYSTO · Czysto CZYSTO Lublin Za ile — Szansa 10% 13:05 13:35 14:05 14:35
19. peek: detent max-h-[128px] · height 128px · aria-expanded=false · chip CZYSTO
20. peek: Za ile — @30px > Szansa 10% @18px
21. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
22. peek text: Czysto CZYSTO Lublin Za ile — Szansa 10% 13:05 13:35 14:05 14:35
23. tap the grab handle
24. half: detent max-h-[45dvh] · height 347px · aria-expanded=true · chip CZYSTO
25. half: Za ile — @30px > Szansa 10% @18px
26. half status row: Radar 13:05 · 3 min · IMGW ✕ · wyładowania ✕
27. half text: Czysto CZYSTO Lublin Za ile — Szansa 10% 13:05 13:35 14:05 14:35 Idzie od zachodu na wschód · 23 km/h · echo 50 km Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 13:05 · 3 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Lublin"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
