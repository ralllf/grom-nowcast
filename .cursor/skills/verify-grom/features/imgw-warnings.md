# IMGW warnings

Official powiat storm warnings from `https://danepubliczne.imgw.pl/api/data/warningsmeteo`, matched to the pin by 4-digit TERYT. They sit **beside** the nowcast, never as the nowcast headline. The API is a real production boundary and is often unavailable (`warningsUnavailable`).

## Sub-features

- Desktop `aside` heading `Ostrzeżenia IMGW` with `N burzowych w kraju`
- Cards: `event`, `Badge` `stopień N`, time range via `formatImgwRange`, body; `Inny powiat — podgląd krajowy.` when TERYT misses
- Empty: `Brak aktywnych ostrzeżeń burzowych.`
- Failure: `Ostrzeżenia IMGW chwilowo niedostępne` (aside + optional sheet)
- Local lane on the sheet: `Ostrzeżenie IMGW: burze · … · powiat …` (`localImgwLane`)
- Map choropleth toggle `IMGW` (`aria-pressed`, default on) — only if `stormWarningDegrees` is non-empty
- Settings checkbox `Ostrzeżenia IMGW na mapie (powiat, stopień)`

## How to get to it (user POV)

On a wide window the IMGW card is to the right of the threat sheet. On a phone it is gone (`hidden sm:block`) — use the sheet’s yellow IMGW sentence if a warning matches the pin. If any storm warning is live in Poland, a left-side `IMGW` pill tints powiats; tap it to hide the tint.

## Driving it with Chrome CDP

1. Check `doctor.json` `warningsUnavailable`. If true, assert the aside (desktop) contains `Ostrzeżenia IMGW chwilowo niedostępne` and **stop** — do not invent warnings.
2. If false and `stormWarningCount === 0`: aside says `Brak aktywnych ostrzeżeń burzowych.` That is a valid clear day.
3. If count > 0: aside lists up to 4 `<li>` with `stopień`. Pick Kraków vs a quiet city and confirm `matchesPlace` copy (`Inny powiat` appears for non-local rows).
4. If the `IMGW` pill exists: click it, `aria-pressed` toggles, `localStorage.grom-settings-v1.imgwMap` matches.
5. Never assert that the nowcast `h2` equals an IMGW event name.

## Gotchas

- Doctor on 2026-09-01 against this checkout saw `warningsUnavailable: true` while SRI radar was fine. Treat that as expected, not a broken app.
- `watch` level still headlines `Czysto`. The IMGW lane is a separate muted/warn paragraph.
- Choropleth is powiat polygons from `powiaty.json` (~340 kB, lazy). First tint can lag a second after the pill appears.
- Filter is name-based (`burz` / `grad` / `silny deszcz`). Heat/fog warnings are dropped.
- Aside is desktop-only. A 390 px drive that “doesn’t see IMGW” is a viewport miss.
