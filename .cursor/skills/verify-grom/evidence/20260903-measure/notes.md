# Drive: desktop storm capture + card geometry (daylight redesign)

**Base:** http://127.0.0.1:8080 (local Vite, launched via the skill's launch.sh)
**When:** 2026-09-03 15:17–15:18 UTC
**Viewport:** 1280×800, deviceScaleFactor 1
**Pin:** Łódź, chosen through the real user path (Ustawienia → city chip), not seeded storage.

## State captured

Live storm over Łódź. Sheet text (quoted from the DOM):

> Ulewa nadciąga · ZARAZ · Łódź · Za ile 7 min · Szansa 90% · Opad nad pinezką · 90 min · z ruchu echa · Idzie od zachodu na wschód · 41 km/h · echo 16 km · Spodziewaj się: ulewy i porywistego wiatru

## Measured geometry (this capture)

| Element | Rect (px) | scrollHeight − clientHeight | overflowY / max-height |
|---|---|---|---|
| `#grom-threat-sheet` | 416×619, top 161, bottom 780 | 0 | hidden / none |
| scrollable descendants inside the sheet | — | 0 elements | — |
| IMGW `aside` (IMGW warnings down → one-line state) | 336×80, top 700 | 0 | visible / none |
| `#grom-map-chrome` dock | bottom 392 | 0 | — |
| radar slider pill | bottom 144 | 0 | 17 px clear of the sheet top |

## Revision disclosure

This screenshot is one branch revision behind the final push. After it was taken, three
desktop-only tweaks landed: map chrome `sm:bottom-[25.5rem]` → `sm:bottom-[22rem]`, sheet
`sm:p-6` → `sm:p-5`, radar slider `sm:top-28` → `top-24`, IMGW lane cap 3 → 2 clamped rows.
The nowcast content, card composition, and phone rendering are unchanged. Final-code
geometry and screenshots: `../20260903-measure-final/`.

Mocks: none. Live IMGW SRI radar (analysisSource `sri`, scan age ~4 min). IMGW warnings and
PERUN were down at capture time (doctor flags), so the status row reads `IMGW ✕ · wyładowania ✕`.
