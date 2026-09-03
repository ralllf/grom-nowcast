# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-134359
**OK:** true
**When:** 2026-09-03T13:43:59.132Z → 2026-09-03T13:44:05.145Z

## Action → state

Peek at 390x844: max-h-[128px], 128px, no nested scroller or button, Za ile teraz @30px over Szansa 90% @18px, chip TERAZ. Handle tap → max-h-[45dvh] at 374px with the status row "Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 15:40 · 16:10 · 16:40 · 17:10
5. timeline aria: Brak opadu od 15:40 do 17:10
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Kraków
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. pin Gdańsk: chip TERAZ · Deszcz nad Tobą TERAZ Gdańsk Za ile teraz Szansa 90% 15:40 16:10 16:40 17:10 Idzie od połu
11. stopping on Gdańsk: live level chip TERAZ
12. auto-expanded: detent max-h-[45dvh] · height 374px · aria-expanded=true · chip TERAZ
13. auto-expanded: Za ile teraz @30px > Szansa 90% @18px
14. auto-expanded on a now/imminent pin; tap the handle back to peek
15. peek: detent max-h-[128px] · height 128px · aria-expanded=false · chip TERAZ
16. peek: Za ile teraz @30px > Szansa 90% @18px
17. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
18. peek text: Deszcz nad Tobą TERAZ Gdańsk Za ile teraz Szansa 90% 15:40 16:10 16:40 17:10
19. half: detent max-h-[45dvh] · height 374px · aria-expanded=true · chip TERAZ
20. half: Za ile teraz @30px > Szansa 90% @18px
21. half status row: Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕
22. half text: Deszcz nad Tobą TERAZ Gdańsk Za ile teraz Szansa 90% 15:40 16:10 16:40 17:10 Idzie od południowego zachodu na północny wschód · 45 km/h · echo 1 km Spodziewaj się: słabego deszczu Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Gdańsk"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Slice check — phone sheet unchanged (390×844)

Same slice, other viewport: the desktop card change must not touch the phone.
`doctor.json` for this run: `ok: true`, radar `sri` 4 min old; IMGW warnings and PERUN down.

- Live `TERAZ` pin (Gdańsk) auto-expanded to `max-h-[45dvh]` at `374px` — half, not full.
- Handle tap back to peek: `max-h-[128px]`, sheet height `128px`, `clipped 0px`,
  `nested scrollers 0`, `nested buttons 0`.
- Peek text is still the whole answer: `Deszcz nad Tobą TERAZ Gdańsk Za ile teraz Szansa 90%
  15:40 16:10 16:40 17:10`, with `Za ile @30px > Szansa @18px`.
- Handle tap again: half prints the `Idzie od` box, one caveat and the status row
  `Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕`, and no `Dane:` / `O danych` tail.
