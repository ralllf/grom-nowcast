# Next slices (after 0–9 + pin-only)

*2026-09-01 against `main` (`cbafda2`, post [#18](https://github.com/ralllf/grom-nowcast/pull/18) / [#16](https://github.com/ralllf/grom-nowcast/pull/16) / [#15](https://github.com/ralllf/grom-nowcast/pull/15)). English; product words stay Polish. This is the pick list. Do not re-implement [ACCURACY-PLAN](ACCURACY-PLAN.md) slices 0–9.*

Pick **#1**. It is one helper and one test. A human can ship it without reading the rest of the repo.

Already on `main` (verified in code, not guessed):

- Accuracy 0–9 shipped. Slice 9 is **copy only** (`GROWTH_MATH_ENABLED` is `false` in [`trend.ts`](../src/lib/weather/trend.ts)). Ledger: 2 `front` rows, **0** `konwekcja` ([HINDCAST-LOG](HINDCAST-LOG.md)).
- Pin-only (#18): `computeThreat` has no `radiusKm`; Promień slider and map circle are gone; `CLOSE_KM` / `IMMINENT_KM` are gone and must not come back.
- PERUN point CSVs still **307** (re-probed 2026-09-01 15:17 UTC: `2026.09.01.15.15.ld.csv` → `Location: /datastore`). LTS2005 GIFs remain maps, not lat/lon. Sheet already says „Wyładowania chwilowo niedostępne”.
- Live [grom-nowcast.vercel.app](https://grom-nowcast.vercel.app/) HTML already has the pin-only footer (including the `leadMin` leftover below). Newest datastore SRI `2026090115150000dBR.sri.h5` was ~2 min old at the probe — filenames are **UTC**, cadence 5 min.

Do not pick: growth math, optical flow, GPS-as-platform, Web Push, a second backend, ML, Blitzortung, inventing strikes from GIFs.

---

## 1. Radar clock is Europe/Warsaw

Leftover of Slice 1 (F2). [`formatRadarClock`](../src/lib/weather/wall-clock.ts) does `toLocaleTimeString("pl-PL")` with **no** `timeZone`. IMGW warning times already pin `Europe/Warsaw` ([`imgw-time.ts`](../src/lib/weather/imgw-time.ts)). Age (`radarAgeMin`) uses unix seconds and is fine.

**Hunch from live 2026-09-01 ~16:37 Warsaw — caption “IMGW 07:30 · sprzed 6 min”:** **clock TZ, not a hours-stale frame.** A frame ~6 min old at 16:37 CEST is 14:31 UTC. Same instant formats as `16:31` in Warsaw, `14:31` in UTC, **`07:31` in America/Los_Angeles**. Age “6 min” is the truth; the printed clock followed the host. Live SRI at 15:17 UTC was minutes old, not 9 hours old.

- **Who sees what:** the sheet caption and the alert suffix (`Radar IMGW HH:MM · sprzed N min`) always mean Poland time — US laptop, Vercel/agent Chrome, or a phone that travelled. Optional same-PR: the collapsed mobile peek today hides the caption; put one short line there so the jacket decision sees the age.
- **Success check:** `TZ=America/Los_Angeles npm test` (or a unit that freezes 14:31 UTC) prints **`16:31`**, never `07:31`. On live, at 16:37 Warsaw a minutes-old frame says `16:3x`, not `07:3x`.
- **Out:** interpolating frames; polling faster than 90 s; motion math; treating SRI filenames as Warsaw local (they are UTC).

---

## 2. Stale radar refuses the sheet, not only alerts

[`evaluateAlert`](../src/lib/weather/alerts.ts) already no-ops when the scan is > 30 min old. [`canTrustRadar`](../src/lib/weather/snapshot.ts) only checks `radarUnavailable`. A listing/cache that handed over a morning file would still run `computeThreat` and sell “nadciąga za 18 min” with a faint “sprzed 400 min”.

**Hunch:** rare. The hole is real; alerts already know.

- **Who sees what:** next stale scan — headline „Radar nieaktualny” (or the existing honesty line), ETA `—`, no incoming copy. Fresh scans unchanged.
- **Success check:** fixture `latestTime = now − 45 min` → no incoming (already true) **and** the sheet does not show a numeric ETA / `imminent` headline. `latestTime = now − 6 min` unchanged.
- **Out:** retry queues; changing the 30 min constant; interpolating; a status page.

---

## 3. Stop promising hail from reflectivity

[`expectPl`](../src/lib/weather/threat.ts) still says „możliwy grad” at klasa 4. That is the HAIL_RATE / ≥ 55 dBZ guess from F4. „Burza” is already strike-gated (and strikes never arrive). Hail is the leftover lie.

- **Who sees what:** a pin under a red core. „Spodziewaj się” is ulewa / wiatr, not grad, unless the IMGW lane already wrote „Burze z gradem”.
- **Success check:** unit — klasa 4, no strikes, no IMGW grad warning → `expect` / detail have no „grad”. IMGW time-boxed lane unchanged.
- **Out:** ZHAIL / CMAX decode; PERUN access; flipping `GROWTH_MATH_ENABLED`; new POLCOMP products.

---

## 4. The sheet still speaks engineer

Leftover of #18, **on live today.** Footer: *„leadMin to czas, nie dystans.”* Badge: raw English `{threat.level}` (`clear` / `watch` / `nearby` / `imminent` / `now`) next to the Polish headline ([`threat-sheet.tsx`](../src/components/threat-sheet.tsx)).

- **Who sees what:** every desktop sheet. One human sentence instead of `leadMin`. Badge is Polish or gone (colour can stay).
- **Success check:** view-source / phone / desktop — no user-visible `leadMin`, `imminent`, `nearby`, `clear`, `watch` as tokens. Settings can keep the Polish „wyprzedzenie” slider they already have.
- **Out:** renaming the TypeScript union; changing presets; bringing a radius back.

---

## 5. One convective hindcast row (the Slice 9 gate)

Not product code. F1 is still the biggest miss class; the plan will not move timeline / ETA for growing cells until **≥ 3 `konwekcja` days** beat POD/FAR/bias. Today: 0.

- **Who sees what:** Rafał sees a new row in [HINDCAST-LOG](HINDCAST-LOG.md). The live sheet already has „Komórka rośnie” / „słabnie”. Numbers do not change.
- **Success check:** after the next storm afternoon, `npm run --silent hindcast -- --sri --json`, regime typed `konwekcja`, one complete row (age_s, cellKm, shipped alerts). `GROWTH_MATH_ENABLED` stays **false**. Repeat until three such rows exist — *then* a later slice may open the math.
- **Out:** flipping the flag in this slice; optical flow; NWP; committing radar frames.

---

## Not a slice (blocked)

PERUN CSVs are gated on the datastore subtree. Same `getfiledown` scheme serves POLCOMP `.sri.h5` and (when present) LTS2005 GIFs at 200. One email to IMGW open-data is out-of-band, not a screen change. Keep the warn line; do not demote it to a quiet sky.
