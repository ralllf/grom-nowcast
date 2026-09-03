# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260903-110854
**OK:** true
**When:** 2026-09-03T11:09:59.461Z → 2026-09-03T11:10:22.121Z

## Action → state

Peek at 390x844: max-h-[128px], 128px, no nested scroller or button, Za ile teraz @30px over Szansa 10% @18px, chip CZYSTO. Handle tap → max-h-[45dvh] at 380px with the status row "Radar 13:05 · 5 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 13:05 · 13:35 · 14:05 · 14:35
5. timeline aria: Opad od 13:05 do 13:20, najsilniej ok. 13:05
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Kraków
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. Ustawienia tap 1 did not open the dialog (hydration?)
11. pin Kraków: chip CZYSTO · Czysto CZYSTO Kraków Za ile teraz Szansa 10% 13:05 13:35 14:05 14:35
12. pin Katowice: chip CZYSTO · Czysto CZYSTO Katowice Za ile minie Szansa 10% 13:05 13:35 14:05 14:35
13. pin Poznań: chip CZYSTO · Czysto CZYSTO Poznań Za ile 30 min Szansa 50% 13:05 13:35 14:05 14:35
14. pin Gdańsk: chip CZYSTO · Czysto CZYSTO Gdańsk Za ile 60 min Szansa 10% 13:05 13:35 14:05 14:35
15. no live level chip; going back to Kraków, the one pin with a real Za ile
16. pin Kraków: chip CZYSTO · Czysto CZYSTO Kraków Za ile teraz Szansa 10% 13:05 13:35 14:05 14:35
17. peek: detent max-h-[128px] · height 128px · aria-expanded=false · chip CZYSTO
18. peek: Za ile teraz @30px > Szansa 10% @18px
19. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
20. peek text: Czysto CZYSTO Kraków Za ile teraz Szansa 10% 13:05 13:35 14:05 14:35
21. tap the grab handle
22. half: detent max-h-[45dvh] · height 380px · aria-expanded=true · chip CZYSTO
23. half: Za ile teraz @30px > Szansa 10% @18px
24. half status row: Radar 13:05 · 5 min · IMGW ✕ · wyładowania ✕
25. half text: Czysto CZYSTO Kraków Za ile teraz Szansa 10% 13:05 13:35 14:05 14:35 Idzie od zachodu na wschód · 25 km/h · echo 1 km Spodziewaj się: słabego deszczu Komórka słabnie Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 13:05 · 5 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Kraków"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Addendum (by hand)

Doctor for this run: `doctor.json` — SRI fresh (`latestAgeMin` 5.4, `analysisSource` sri),
`warningsUnavailable` and `lightningUnavailable` both true, so IMGW-tint and strike
assertions were skipped and the status row honestly reads `IMGW ✕ · wyładowania ✕`.

Live weather during the run: no pin in the first 12 `CITIES` was at `now`/`imminent`
(every chip read `CZYSTO`), so the driver fell back to the one pin with rain in the
90-min window — Kraków, echo 1 km, `Za ile teraz`, `Komórka słabnie`. An earlier pass
on the same branch (~12:52 CEST, before the shared-answer refactor) did catch Kraków at
`now`: chip `TERAZ`, `Deszcz nad Tobą`, `Za ile teraz` @30px, `Szansa 90%`, auto-expanded
to `max-h-[45dvh]` at 380px, peek 128px with 0 clipping.

Against the three 3 Sep "before" screenshots:

| Before (live 3 Sep) | Now (this run) |
|---|---|
| Peek/half card with an inner scrollbar | peek `nestedScrollers: 0`, `sheetClippedPx: 0`; half scrolls 21px on this busy card (was 86px before the density pass) |
| `SZANSA` / `ZA ILE` / `ECHO` boxed tiles, 10px caps | one unboxed pair: `Za ile` 30px mono hero + `Szansa` 18px; no `ECHO` anywhere in the DOM |
| Grey paragraph repeating `Idzie od …`, `echo ok. 13 km`, `Dojście … 8 min`, `Szansa ~90%` | one caveat: `Komórka może też urosnąć na miejscu — tego radar nie zapowie.` |
| Echo distance as a third KPI | folded into `Idzie od zachodu na wschód · 25 km/h · echo 1 km` |
| Two-line `NOWCAST PL / GROM` tile | bolt + `GROM` pill |

Sheet DOM guard: `ENGLISH_LEAK_RE` (`NOW|IMMINENT|NEARBY|ETA|TERYT|ECHO`) was checked at
peek and at half — no match either time.
