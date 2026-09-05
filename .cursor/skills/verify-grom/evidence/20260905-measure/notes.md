# Drive: desktop geometry + obstruction probe (daylight redesign, final code)

**Base:** http://127.0.0.1:8080 (local Vite, launched via the skill's launch.sh)
**When:** 2026-09-05 19:06–19:08 UTC
**Pin:** Warszawa, chosen through the real user path (Ustawienia → city chip).

## State captured

Live storm over Warszawa. Sheet text (quoted from the DOM):

> Deszcz nadciąga · ZARAZ · Warszawa · Za ile 14 min · Szansa 90% ·
> Opad nad pinezką · 90 min | z ruchu echa · Idzie od zachodu na wschód · 65 km/h · echo 17 km ·
> Spodziewaj się: deszczu i mokrej jezdni · Radar 21:00 · 4 min · IMGW ✓ · wyładowania ✕

## Measured geometry, 1280×800 (`geometry.json`)

| Element | Rect (px) | scrollHeight − clientHeight | overflowY / max-height |
|---|---|---|---|
| `#grom-threat-sheet` | 416×631, top 149, bottom 780 | 0 | hidden / none |
| scrollable descendants inside the sheet | — | 0 elements | — |
| IMGW `aside` (feed up, 0 storm warnings) | 336×80, top 700 | 0 | visible / none |
| `#grom-map-chrome` dock | bottom 448 (`sm:bottom-[22rem]`) | 0 | — |
| radar slider pill | y 96–128 (`top-24`) | 0 | 21 px clear of the card top |
| layer-chip row (`tor komórki`, `Pokaż mżawkę`) | x 487–793, y 24–60 | 0 | header band, 89 px above the card top |

## Obstruction hit-tests (the fix for the review's point 1)

`elementFromPoint` at each element's own center must resolve inside `#grom-threat-sheet`:

| Target | Center (px) | Topmost node | Inside sheet |
|---|---|---|---|
| headline "Deszcz nadciąga" | (206, 184) | H2 | ✓ |
| place "Warszawa" | (120, 211) | P | ✓ |
| Za ile hero "14 min" | (146, 251) | DD | ✓ |

The same assertion runs in drive.mjs for every feature and, at 390×844, per detent
(`obstruction-*.json` in `../20260905-190417/`).

## Strip rows (the fix for the review's point 2)

`strip-rows.json` (in `../20260905-190439/`): label row `display: flex`,
"Opad nad pinezką · 90 min" and "z ruchu echa" separated; legend row `display: flex`,
"słaby <1 · umiarkowany 1–4 · silny 4–10 · ulewny >10" separated; `glued: false`.
Root cause was the `hidden sm:block` gate clobbering `flex` in tailwind-merge; the gate is
now `max-sm:hidden`, locked by `peek-card.test.ts`.

## 640×800 band check (`03-tablet-640x800.png`, `geometry-640x800.json`)

Same probe at 640×800: chip row x 167–473 in the header band (clear of wordmark and buttons),
all three hit-tests inside the sheet. The full-width card's top edge sits a few px under the
centered slider pill in the richest state — padding/wash area only, no content covered.

Mocks: none. Live IMGW SRI radar (analysisSource `sri`, scan age ~4 min). IMGW warnings feed
was up (0 active storm warnings — the lane shows the settled zero state); PERUN was down, so
the status row reads `wyładowania ✕`.
