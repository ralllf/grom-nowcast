# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-151612
**OK:** true
**When:** 2026-09-03T15:16:12.447Z → 2026-09-03T15:16:31.962Z

## Action → state

Peek at 390x844: max-h-[128px], 126px, no nested scroller or button, Za ile 8 min @30px over Szansa 90% @18px, chip ZARAZ. Handle tap → max-h-[45dvh] at 380px with the status row "Radar 17:10 · 7 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 17:10 · 17:40 · 18:10 · 18:40
5. timeline aria: Brak opadu od 17:10 do 18:40
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Kraków
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. pin Warszawa: chip CZYSTO · Czysto CZYSTO Warszawa Za ile 24 min Szansa 50% 17:10 17:40 18:10 18:40
11. pin Łódź: chip ZARAZ · Ulewa nadciąga ZARAZ Łódź Za ile 9 min Szansa 90% 17:10 17:40 18:10 18:40 Idzie od zachodu
12. stopping on Łódź: live level chip ZARAZ
13. auto-expanded: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip ZARAZ
14. auto-expanded: Za ile 9 min @30px > Szansa 90% @18px
15. auto-expanded on a now/imminent pin; tap the handle back to peek
16. peek: detent max-h-[128px] · height 126px · aria-expanded=false · chip ZARAZ
17. peek: Za ile 8 min @30px > Szansa 90% @18px
18. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
19. peek text: Ulewa nadciąga ZARAZ Łódź Za ile 8 min Szansa 90% 17:10 17:40 18:10 18:40
20. half: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip ZARAZ
21. half: Za ile 8 min @30px > Szansa 90% @18px
22. half status row: Radar 17:10 · 7 min · IMGW ✕ · wyładowania ✕
23. half text: Ulewa nadciąga ZARAZ Łódź Za ile 8 min Szansa 90% 17:10 17:40 18:10 18:40 Idzie od zachodu na wschód · 41 km/h · echo 16 km Spodziewaj się: ulewy i porywistego wiatru To ruch echa, nie pewność. Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 17:10 · 7 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Łódź"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Revision note (daylight redesign)

This storm-pin run predates the branch's final desktop-only tweaks (map-chrome `sm:bottom`,
sheet `sm:p-6`→`sm:p-5`, slider `sm:top-28` removal, IMGW lane cap). Every changed class is
behind `sm:`/`lg:` or inside the desktop-only aside, so phone rendering — what this run
proves — is identical on the final code. Final-code phone run (clear sky): `../20260903-152254/`.
