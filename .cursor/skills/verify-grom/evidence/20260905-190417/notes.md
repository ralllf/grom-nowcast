# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260905-190417
**OK:** true
**When:** 2026-09-05T19:04:17.665Z → 2026-09-05T19:04:30.832Z

## Action → state

Peek at 390x844: max-h-[128px], 126px, no nested scroller or button, Za ile 16 min @30px over Szansa 90% @18px, chip ZARAZ. Handle tap → max-h-[45dvh] at 380px with the status row "Radar 21:00 · 4 min · IMGW ✓ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet ready: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
4. timeline ticks: 21:00 · 21:30 · 22:00 · 22:30
5. timeline aria: Opad od 21:20 do 22:30, najsilniej ok. 21:35
6. trio labels: Za ile · Szansa
7. status row: Radar 21:00 · 4 min · IMGW ✓ · wyładowania ✕
8. sheet ready, starts with pin copy: Deszcz nadciąga | ZARAZ |  | Warszawa
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. pin Warszawa: chip ZARAZ · Deszcz nadciąga ZARAZ Warszawa Za ile 16 min Szansa 90% 21:00 21:30 22:00 22:30 Idzie od z
11. stopping on Warszawa: live level chip ZARAZ
12. auto-expanded: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip ZARAZ
13. auto-expanded: Za ile 16 min @30px > Szansa 90% @18px
14. auto-expanded: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
15. auto-expanded on a now/imminent pin; tap the handle back to peek
16. peek: detent max-h-[128px] · height 126px · aria-expanded=false · chip ZARAZ
17. peek: Za ile 16 min @30px > Szansa 90% @18px
18. peek: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
19. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
20. peek text: Deszcz nadciąga ZARAZ Warszawa Za ile 16 min Szansa 90% 21:00 21:30 22:00 22:30
21. half: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip ZARAZ
22. half: Za ile 16 min @30px > Szansa 90% @18px
23. half: headline/place/Za ile hit-test clean (centers resolve inside #grom-threat-sheet)
24. half status row: Radar 21:00 · 4 min · IMGW ✓ · wyładowania ✕
25. half text: Deszcz nadciąga ZARAZ Warszawa Za ile 16 min Szansa 90% 21:00 21:30 22:00 22:30 Idzie od zachodu na wschód · 65 km/h · echo 17 km Spodziewaj się: deszczu i mokrej jezdni To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 21:00 · 4 min · IMGW ✓ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Warszawa"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
