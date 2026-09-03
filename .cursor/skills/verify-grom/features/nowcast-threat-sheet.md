# Nowcast threat sheet

The bottom card (`#grom-threat-sheet`) is the product: when the rain reaches the **pin**, how likely it is, and a 0–90 min rain strip. Headline is nowcast-only (`Czysto` / `Opad nadciąga` / `… nad Tobą`); IMGW never occupies it (`nowcastHeadline` forces `Czysto` on `watch`).

## Sub-features

- Headline + place label (city / pinezka only — no TERYT) + Polish level chip (`TERAZ` / `ZARAZ` / `BLISKO` / `CZYSTO`, uppercased by the Badge)
- Two numbers only: **`Za ile`** (`teraz` / `N min` / `minie` / `—`) as the hero, `Szansa` smaller. There is no `Echo` tile — the echo distance rides the `Idzie od` line (`· echo N km`)
- Copy block: `Idzie od … na …  · N km/h · echo N km`, `Spodziewaj się:`, `Komórka rośnie` / `Komórka słabnie`
- One caveat paragraph (`sheetCaveat`): only what the box does not print (`To ruch echa, nie pewność.`, in-situ growth, miss distance). Never the arrival minute, chance or direction a second time
- Timeline `role="img"` with a clock sentence (`Opad od HH:MM do HH:MM, najsilniej ok. HH:MM` or `Brak opadu od HH:MM do HH:MM`), Warsaw axis ticks, a now-cursor, and tap-to-read bars. Caption `z ruchu echa` vs `bez ruchu — jak teraz`
- One grey status row: `Radar HH:MM · N min · IMGW ✓/✕ · wyładowania ✓/✕` (amber only when radar is stale or down; stale also says `alert wstrzymany`)
- Offline: `Bez sieci · ostatni radar HH:MM` (or `Bez sieci` with no last scan) — grey unless that last scan is itself stale
- Map chip (not the sheet) names the painted source (`Radar IMGW` / `Radar`)
- `Pokaż ruch opadu na mapie` when tracks exist and nearest echo is > 25 km (full detent / sm+)
- Mobile peek (collapsed, 128px) is the whole 3-second answer: headline, level chip, place, hero `Za ile`, small `Szansa`, and a **static** 90-min strip with `HH:MM` ticks. No nested scroller and no nested button inside the drag handle (`aria-expanded`). Stale/down/offline status rides the place line, not only the expanded sheet.
- Mobile detents: **peek** `max-h-[128px]` · **half** `max-h-[45dvh]` · **full** `max-h-[85dvh]`. Auto-expand at `now`/`imminent` goes to **half**, not 70dvh.
- Detent ladder (`sheetExtrasClass`): `half` adds the box, one caveat and the status row; the `O danych ›` disclosure and the rain legend wait for `full`. The pin-honesty paragraph and `Dane: IMGW-PIB …` live **inside** that disclosure, so they are one tap away at `full` and on the card
- On sm+ the pin card is two columns of the page, not a phone sheet: headline, chip, `Za ile`, `Szansa` and the `Idzie od` box on the left, the 90-min strip on the right, caveat / IMGW lane / status row across both. It sizes to its content — no detent height, no scroller of its own, no drag handle (`sm:hidden`)

## How to get to it (user POV)

Open `/`. On a viewport ≥ 640 px the card is already open, laid out in its two columns. On a phone, tap the grab handle (headline is its `aria-label`) or wait for auto-expand to the **half** detent only when level is `imminent` or `now`. Default first visit is Warszawa. Wait until the headline is no longer `Skanuję radar…` (and not `Brak danych` unless the snapshot failed).

## Driving it with Chrome CDP

Driver: `drive.mjs --feature nowcast-threat-sheet` (390×844 phone; `--viewport WxH` overrides any feature's default).

1. `Page.navigate` `BASE/` at 1280×800. Poll `#grom-threat-sheet` `innerText` until it does **not** include `Skanuję radar…` (cap ~45 s; first SRI decode is slow).
2. Assert the sheet contains the current pin label (`Warszawa` unless you changed it), the words `Szansa` and `Za ile`, and a `%` chance. No `ETA`, no `Echo` tile, no English `NOW` / `IMMINENT`.
3. Acceptable headlines after a good snapshot: `Czysto`, `Opad w okolicy`, `Opad nadciąga`, `Opad oddala się`, `… nadciąga`, `… nad Tobą`. `Brak danych` + `Nie udało się pobrać radaru` is a failed snapshot — stop.
4. If the strip is present, assert `[role="img"]` has a clock sentence (`Opad od …` / `Brak opadu od …`), `[data-timeline-axis]` ticks are `HH:MM` (not `24 min`), and `[data-now-cursor]` exists. On a phone the peek strip is the first of the two; the expanded one adds the caption `Opad nad pinezką · 90 min`.
5. On a phone (390×844) the peek block is the handle body: measure it (`scrollHeight` ≤ 128 + no descendant with `scrollHeight > clientHeight`) and compare the `Za ile` font size against `Szansa` — the hero must be strictly larger. Tap the handle to reach `half`.
6. Screenshot the sheet, not just the map.

## Gotchas

- SSR HTML always shows `Skanuję radar…` / `Pobieram komunikaty…`. Hydration + `getSnapshot` must finish before you judge.
- `watch` (IMGW-only, no echo) still headlines `Czysto`. Look for the yellow IMGW lane under the title, not a storm headline.
- ETA is wall-clock (`radarAgeMin` subtracted). Do not compare it to raw `etaMin` from a stale mental model.
- Sheet auto-expand is mobile-only. Desktop tests must not tap the handle (it is `sm:hidden`).
- The collapsed handle keeps its own copy of the answer. On sm+ it is `display: none`, so measure the **visible** `Za ile` / `[data-timeline-axis]` (`offsetParent !== null`) or you will read zero-size boxes.
- `sheetExtrasClass` contributes `hidden`, and `cn()` (tailwind-merge) resolves that against `flex`. Gated flex rows (strip caption, rain legend, `Pokaż ruch opadu na mapie`) re-assert `sm:flex`; if one loses it, the card silently lays that row out as a block.
- Visible credit is `Dane: IMGW-PIB · mapa OpenFreeMap/OSM`. POLRAD / dBZ / Marshall–Palmer / COMPO_SRI live behind `O danych ›` (`<details>`). That copy is static, not proof the radar loaded.
