# GROM reviews · 2026-09-01

Full-project analysis done on 1 September 2026 against `main` @ `ec7d59a`, with the live site checked at 20:04–20:07 CEST during a storm over Warsaw. English; product words stay Polish.

Two summary pages (private artifacts, share from the page menu):

- **Go-Live Plan** — state of the app, MeteoSwiss benchmark, go-live blockers, roadmap, Android/iOS strategy, push architecture, costs, first two weeks: https://claude.ai/code/artifact/50284580-2e2c-41b5-a779-2763db1bdc95
- **Engineering Review** — code quality, calculation design, interface design, one ranked worklist: https://claude.ai/code/artifact/c1a55def-293c-48a4-a013-41ac31cd421e

The detailed reports behind those pages:

| # | File | What it holds |
|---|---|---|
| 01 | [01-launch-readiness-audit.md](01-launch-readiness-audit.md) | Tests/typecheck state, docs inventory, server cost probe (cold snapshot ≈ 9 s), alert engine reusability, client/mobile readiness, bundle sizes, red flags, licensing exposure, and the live overlay-vs-sheet discrepancy analysis |
| 02 | [02-meteoswiss-and-competitors.md](02-meteoswiss-and-competitors.md) | MeteoSwiss feature set, rain-push reference apps (RainViewer, Windy, Buienalarm, Yr, DWD…), Polish competitors (IMGW Meteo, Burzowo, RSO, RCB), prioritised feature checklist |
| 03 | [03-mobile-strategy.md](03-mobile-strategy.md) | PWA vs Capacitor vs Expo, push backends, background evaluation hosting, store requirements, Live Activities/widgets, recommendation |
| 04 | [04-data-licensing.md](04-data-licensing.md) | IMGW regulamin and HVD carve-out, RainViewer 2026 terms, lightning options, official warnings feeds, basemap/geocoding policies, ranked go-live risks |
| 05 | [05-code-quality-review.md](05-code-quality-review.md) | Metrics table, architecture, component/effect hygiene, types and validation, error handling, tests, duplication, tooling, top-10 refactors, scores |
| 06 | [06-calculation-design-review.md](06-calculation-design-review.md) | aeqd/georeferencing check (verified scale error), aggregation, mass identification, NCC, advection, ETA edge cases, chance calibration, trend, alert engine holes, hindcast methodology, stage table, top-8 |
| 07 | [07-ui-design-review.md](07-ui-design-review.md) | Identity, hierarchy, sheet content, map layer, settings, states, accessibility measurements, copy, mobile-native readiness, 12 prioritised changes, wireframes, design tokens |

Screenshots used as evidence are in [screenshots/](screenshots/).

## Headline findings

- **Go-live blockers:** IMGW licence needs written HVD confirmation; RainViewer public API is personal/educational only and sits on the normal path; the Nominatim search proxy violates OSM policy; every cache is per-instance on Vercel.
- **Verified calculation bug:** the SRI decoder uses ODIM `xscale/yscale` as plane pixel sizes; the file's corner attributes imply 1154.40 × 1159.81 m, a 0.4–2.7 km shift across Poland.
- **Mis-tuned constants:** 15-min SRI motion base with gates tuned for 30 min; `CLEAR_KM` 20 lets all-clear fire while a cell is still inbound.
- **Interface:** sheet auto-expands over the pin at level `now`; city names undeclined ("nad Warszawa"); level badge prints the English enum; contrast and target-size failures measured.
- **Mobile path:** PWA + Web Push first, then a Capacitor 8 shell; alert engine moves to an always-on worker (≈€3–6/month) with Supabase Postgres.
