# Drive: final-code desktop geometry + current-state capture (daylight redesign)

**Base:** http://127.0.0.1:8080 (local Vite, launched via the skill's launch.sh)
**When:** 2026-09-03 15:21–15:24 UTC
**Viewport:** 1280×800, deviceScaleFactor 1
**Pin:** Warszawa, chosen through the real user path (Ustawienia → city chip).

## State captured

The Łódź cell from the 15:16 runs had decayed and its track missed Warszawa by ~46 km, so the
pin reads honest clear-sky-with-context:

> Czysto · CZYSTO · Warszawa · Za ile — · Szansa 10% · strip shows rain later in the window ·
> Echo 15 km · Tor minie Warszawa ok. 46 km obok. · Radar 17:20 · 3 min · IMGW ✕ · wyładowania ✕

The radar cell is still visible on the map southwest of the pin — the map stays useful even
when the answer is "Czysto".

## Measured geometry (final code, `geometry.json`)

| Element | Rect (px) | scrollHeight − clientHeight | overflowY / max-height |
|---|---|---|---|
| `#grom-threat-sheet` | 416×627, top 153, bottom 780 | 0 | hidden / none |
| scrollable descendants inside the sheet | — | 0 elements | — |
| IMGW `aside` | 336×80, top 700 | 0 | visible / none |
| `#grom-map-chrome` dock | bottom 448 (`sm:bottom-[22rem]`) | 0 | — |
| radar slider pill | bottom 128 (`top-24`) | 0 | 25 px clear of the sheet top |

No inner scrollbar anywhere in the primary desktop view: the sheet is content-sized
(`sm:max-h-none`, no `sm:overflow-y-auto`), and the IMGW lane is capped at two clamped rows
instead of a `max-h-72` scroller. Worst-case lane height (2 warnings × clamped body + notes
≈ 315 px) still clears the dock by ~17 px.

## Files

- `02-desktop-warszawa-1280x800.png` — the state above (renamed: the sky was no longer stormy).
- `geometry.json` — the measured DOM geometry quoted above.
- `doctor.json` — instance health at capture time.

Mocks: none. Live IMGW SRI radar (analysisSource `sri`, scan age ~4 min). IMGW warnings and
PERUN were down (doctor flags) — hence `IMGW ✕ · wyładowania ✕` and the one-line aside.
