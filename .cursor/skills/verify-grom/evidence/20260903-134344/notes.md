# Drive: location-pin

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260903-134344
**OK:** true
**When:** 2026-09-03T13:43:44.843Z → 2026-09-03T13:43:49.522Z

## Action → state

Clicked Ustawienia, chose Kraków chip, threat sheet shows Kraków without TERYT; localStorage still has terc 1261. Card 512x433 at 1280x800: 0 inner scrollers (overflow 0px, overflow-y auto), strip beside the hero (hero right 228px, strip left 357px), map keeps 704px on the right, no drag handle, and the tail (Szansa, Za ile i alert są dla pinezki / Dane: IMGW-PIB) only after clicking O danych ›.

## Steps

1. viewport 1280x800
2. navigate http://127.0.0.1:8080/
3. timeline ticks: 15:40 · 16:10 · 16:40 · 17:10
4. timeline aria: Opad od 15:40 do 17:10, najsilniej ok. 16:15
5. trio labels: Za ile · Szansa
6. status row: Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕
7. sheet ready, starts with pin copy: Deszcz nad Tobą | TERAZ |  | Gdańsk
8. map chrome on screen: zoom Przybliż/Oddal, locate, legend, credit "OpenFreeMap / OSM"
9. Warszawa sheet scrolled to status row
10. localStorage place.label before=Gdańsk
11. click button[aria-label="Ustawienia"]
12. dialog open: Lokalizacja i alerty · Miejsce · Alerty; aria-modal=true
13. click city chip "Kraków"
14. sheet shows Kraków (no TERYT); dialog closed
15. Kraków status row: Radar 15:40 · 4 min · IMGW ✕ · wyładowania ✕
16. Kraków timeline ticks: 15:40 · 16:10 · 16:40 · 17:10
17. Kraków timeline aria: Brak opadu od 15:40 do 17:10
18. card 512x433 at 64..576 of 1280: overflow 0px, 0 inner scrollers, overflow-y auto, map keeps 704px on the right
19. two columns: hero {"left":85,"right":228,"top":414,"bottom":450,"w":143,"h":36} · strip {"left":357,"right":555,"top":368,"bottom":556,"w":198,"h":188} · radius 28px 28px 28px 28px
20. first screen has no tail copy (["Szansa, Za ile i alert są dla pinezki","Dane: IMGW-PIB"]), O danych › collapsed
21. open O danych ›
22. O danych open: card 512x512 from 268px, overflow 157px, tail quoted on screen

## Side effects

- `grom-settings-v1` {"storage":"grom-settings-v1","place":{"lat":50.0647,"lon":19.945,"label":"Kraków","instrumental":"Krakowem","city":"Kraków","terc":"1261"}}

## Screenshots

- `01-warszawa-sheet.png` — sheet after snapshot, default / prior pin
- `01b-warszawa-status-row.png` — sheet scrolled to the grey status row
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open with `Miejsce` / `Alerty`
- `03-krakow-sheet.png` — sheet after Kraków chip
- `03b-krakow-status-row.png` — Kraków sheet scrolled to the status row
- `03c-krakow-card.png` — desktop card: two columns, no inner scrollbar (skipped below 640px)
- `03d-krakow-o-danych.png` — same card with `O danych ›` opened
- `card.json` — card box, inner-scroller count, hero/strip boxes, tail copy before and after the disclosure

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.

## Slice check — desktop card uses the page (1280×800)

`doctor.json` for this run: `ok: true`, radar `sri` 4 min old, `radarUnavailable: false`;
`warningsUnavailable: true` and `lightningUnavailable: true`, so IMGW-tint and strike
assertions are skipped and the status row correctly reads `IMGW ✕ · wyładowania ✕`.

- **No inner scrollbar on the card.** `card.json` → `cardOverflowPx: 0`, `innerScrollers: 0`
  for a 512×433 card whose guard is `overflow-y: auto`. The scroller exists and does not engage.
- **Strip beside the hero.** `hero` right edge `228px`, `strip` left edge `357px`, and the two
  overlap vertically (`hero` 414–450, `strip` 368–556) — one row, two columns.
- **Map still open on the right.** Card spans `64..576` of `1280` (`mapRightPx: 704`), and all
  four corners are `28px` (`sm:rounded-3xl`). No drag handle (`handleVisible: false`).
- **Tail behind the disclosure.** First screen text ends at `… Pokaż ruch opadu na mapie · 35 km
  O danych ›`; neither `Szansa, Za ile i alert są dla pinezki` nor `Dane: IMGW-PIB` is on it
  (`detailsOpen: false`). Clicking `O danych ›` reveals both, the card clamps to 512px from
  `top: 268px` — below the radar pill and the chip stack — and scrolls inside itself there.
