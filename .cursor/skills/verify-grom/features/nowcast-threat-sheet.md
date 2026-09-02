# Nowcast threat sheet

The bottom card (`#grom-threat-sheet`) is the product: chance, ETA, and echo for the **pin**, plus a 0–90 min rain strip. Headline is nowcast-only (`Czysto` / `Opad nadciąga` / `… nad Tobą`); IMGW never occupies it (`nowcastHeadline` forces `Czysto` on `watch`).

## Sub-features

- Headline + place label (city / pinezka only — no TERYT)
- Stats `Szansa`, `Za ile` (`teraz` / `N min` / `minie` / `—`), `Echo` (`N km` + intensity)
- Copy block: `Idzie od … → na …`, `Spodziewaj się:`, `Komórka rośnie` / `Komórka słabnie`
- Timeline `role="img"` `aria-label="Oś czasu opadu"` (19 bars / 5 min) and caption `z ruchu echa` vs `bez ruchu — jak teraz`
- Radar age `Radar IMGW HH:MM · sprzed N min` (SRI) or `Radar HH:MM · …` (RainViewer)
- PERUN line: `Brak wyładowań w tej sesji` or `Wyładowania chwilowo niedostępne` (warn color when unavailable)
- `Pokaż ruch opadu na mapie` when tracks exist and nearest echo is > 25 km
- Mobile peek (collapsed): same three stats; drag/tap handle (`aria-expanded`)

## How to get to it (user POV)

Open `/`. On a viewport ≥ 640 px the full sheet is already open (`sm:block`). On a phone, tap the grab handle (headline is its `aria-label`) or wait for auto-expand only when level is `imminent` or `now`. Default first visit is Warszawa. Wait until the headline is no longer `Skanuję radar…` (and not `Brak danych` unless the snapshot failed).

## Driving it with Chrome CDP

1. `Page.navigate` `BASE/` at 1280×800. Poll `#grom-threat-sheet` `innerText` until it does **not** include `Skanuję radar…` (cap ~45 s; first SRI decode is slow).
2. Assert the sheet contains the current pin label (`Warszawa` unless you changed it), the words `Szansa`, `Za ile`, `Echo`, and a `%` chance. No `ETA`.
3. Acceptable headlines after a good snapshot: `Czysto`, `Opad w okolicy`, `Opad nadciąga`, `Opad oddala się`, `… nadciąga`, `… nad Tobą`. `Brak danych` + `Nie udało się pobrać radaru` is a failed snapshot — stop.
4. If `Opad nad pinezką · 90 min` is present, assert `[role="img"][aria-label="Oś czasu opadu"]` exists.
5. Screenshot the sheet, not just the map.

## Gotchas

- SSR HTML always shows `Skanuję radar…` / `Pobieram komunikaty…`. Hydration + `getSnapshot` must finish before you judge.
- `watch` (IMGW-only, no echo) still headlines `Czysto`. Look for the yellow IMGW lane under the title, not a storm headline.
- ETA is wall-clock (`radarAgeMin` subtracted). Do not compare it to raw `etaMin` from a stale mental model.
- Sheet auto-expand is mobile-only. Desktop tests must not tap the handle (it is `sm:hidden`).
- Attribution paragraph always mentions IMGW-PIB / not-RCB / local cell growth — that is static, not proof the radar loaded.
