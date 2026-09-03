# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-152254
**OK:** true
**When:** 2026-09-03T15:22:54.958Z → 2026-09-03T15:23:06.705Z

## Action → state

Peek at 390x844: max-h-[128px], 126px, no nested scroller or button, Za ile — @30px over Szansa 10% @18px, chip CZYSTO. Handle tap → max-h-[45dvh] at 380px with the status row "Radar 17:20 · 3 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 17:20 · 17:50 · 18:20 · 18:50
5. timeline aria: Brak opadu od 17:20 do 18:50
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Warszawa
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. pin Warszawa: chip CZYSTO · Czysto CZYSTO Warszawa Za ile — Szansa 10% 17:20 17:50 18:20 18:50
11. peek: detent max-h-[128px] · height 126px · aria-expanded=false · chip CZYSTO
12. peek: Za ile — @30px > Szansa 10% @18px
13. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
14. peek text: Czysto CZYSTO Warszawa Za ile — Szansa 10% 17:20 17:50 18:20 18:50
15. tap the grab handle
16. half: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip CZYSTO
17. half: Za ile — @30px > Szansa 10% @18px
18. half status row: Radar 17:20 · 3 min · IMGW ✕ · wyładowania ✕
19. half text: Czysto CZYSTO Warszawa Za ile — Szansa 10% 17:20 17:50 18:20 18:50 Idzie od zachodu na wschód · 49 km/h · echo 15 km Spodziewaj się: ulewy i porywistego wiatru Tor minie Warszawa ok. 46 km obok. Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 17:20 · 3 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Warszawa"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
