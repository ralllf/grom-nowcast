# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260903-110854
**OK:** true
**When:** 2026-09-03T11:16:28.396Z → 2026-09-03T11:16:59.997Z

## Action → state

Peek at 390x844: max-h-[128px], 128px, no nested scroller or button, Za ile teraz @30px over Szansa 10% @18px, chip CZYSTO. Handle tap → max-h-[45dvh] at 374px with the status row "Radar 13:15 · 2 min · IMGW ✕ · wyładowania ✕" and no Dane:/O danych tail. No NOW/IMMINENT/ETA/TERYT/ECHO in the sheet DOM.

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/
3. sheet is collapsed (max-h-[128px]); expanded-only checks deferred
4. timeline ticks: 13:10 · 13:40 · 14:10 · 14:40
5. timeline aria: Brak opadu od 13:10 do 14:40
6. trio labels: Za ile · Szansa
7. status row: null
8. sheet ready, starts with pin copy: Czysto | CZYSTO |  | Kraków
9. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
10. Ustawienia tap 1 did not open the dialog (hydration?)
11. pin Kraków: chip CZYSTO · Czysto CZYSTO Kraków Za ile minie Szansa 10% 13:15 13:45 14:15 14:45
12. pin Katowice: chip CZYSTO · Czysto CZYSTO Katowice Za ile — Szansa 10% 13:15 13:45 14:15 14:45
13. pin Poznań: chip CZYSTO · Czysto CZYSTO Poznań Za ile teraz Szansa 10% 13:15 13:45 14:15 14:45
14. pin Gdańsk: chip CZYSTO · Czysto CZYSTO Gdańsk Za ile 43 min Szansa 50% 13:15 13:45 14:15 14:45
15. pin Wrocław: chip CZYSTO · Czysto CZYSTO Wrocław Za ile — Szansa 10% 13:15 13:45 14:15 14:45
16. no live level chip; going back to Poznań, the one pin with a real Za ile
17. pin Poznań: chip CZYSTO · Czysto CZYSTO Poznań Za ile teraz Szansa 10% 13:15 13:45 14:15 14:45
18. peek: detent max-h-[128px] · height 128px · aria-expanded=false · chip CZYSTO
19. peek: Za ile teraz @30px > Szansa 10% @18px
20. peek fits: clipped 0px, nested scrollers 0, nested buttons 0
21. peek text: Czysto CZYSTO Poznań Za ile teraz Szansa 10% 13:15 13:45 14:15 14:45
22. tap the grab handle
23. half: detent max-h-[45dvh] · height 374px · aria-expanded=true · chip CZYSTO
24. half: Za ile teraz @30px > Szansa 10% @18px
25. half status row: Radar 13:15 · 2 min · IMGW ✕ · wyładowania ✕
26. half text: Czysto CZYSTO Poznań Za ile teraz Szansa 10% 13:15 13:45 14:15 14:45 Idzie od zachodu na wschód · 37 km/h · echo 2 km Spodziewaj się: słabego deszczu Komórka może też urosnąć na miejscu — tego radar nie zapowie. Radar 13:15 · 2 min · IMGW ✕ · wyładowania ✕

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","pin":"Poznań"}

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Addendum (by hand)

Doctor for this run (`doctor.json`): SRI fresh (`analysisSource: sri`, radar ~5 min old),
`warningsUnavailable` and `lightningUnavailable` both **true** — so IMGW-tint and strike
assertions were skipped, and the status row honestly reads `IMGW ✕ · wyładowania ✕`.

Live weather: no pin in the first 12 `CITIES` was at `now`/`imminent` when this run
landed (every chip read `CZYSTO`), so the driver fell back to the one pin with rain in
the 90-min window — **Poznań**, echo 2 km, `Za ile teraz`, strip aria
`Opad od 13:15 do 14:40, najsilniej ok. 14:30`. An earlier pass on this branch
(~12:52 CEST, before the shared-answer commit) did catch **Kraków at `now`**: chip
`TERAZ`, headline `Deszcz nad Tobą`, `Za ile teraz` @30px, `Szansa 90%`, auto-expanded
to `max-h-[45dvh]` at 380px, peek 128px with 0 clipping and 0 nested scrollers, and the
half caveat was the single sentence `Komórka może też urosnąć na miejscu — tego radar
nie zapowie.`

Measured (`peek.json`):

| | peek | half |
|---|---|---|
| detent | `max-h-[128px]` | `max-h-[45dvh]` |
| sheet height | 128px | 374px (cap 380px) |
| clipped inside the detent | 0px | 0px |
| inner scroller overflow | none (no scroller in peek) | 0px |
| `Za ile` / `Szansa` font size | 30px / 18px | 30px / 18px |

Against the three 3 Sep "before" screenshots:

| Before (live 3 Sep) | Now (this run) |
|---|---|
| Card with an inner scrollbar | peek has no scroller at all; half fits (0px overflow; 21px on a busier `Komórka słabnie` card) |
| `SZANSA` / `ZA ILE` / `ECHO` boxed tiles, 10px caps | one unboxed pair: `Za ile` 30px mono hero + `Szansa` 18px |
| Grey paragraph repeating `Idzie od …`, `echo ok. 13 km`, `Dojście … 8 min`, `Szansa ~90%` | one caveat sentence, nothing the box already said |
| Echo as a third KPI | folded into `Idzie od zachodu na wschód · 37 km/h · echo 2 km` |
| Two-line `NOWCAST PL / GROM` tile | bolt + `GROM` pill |

Sheet DOM guard `ENGLISH_LEAK_RE` (`NOW|IMMINENT|NEARBY|ETA|TERYT|ECHO`) was evaluated at
peek and at half — no match either time.

Desktop regression for the same change: `../20260903-111147/` (`location-pin` at 1280×800,
Warszawa → Kraków chip, status row and clock ticks intact, no TERYT).
