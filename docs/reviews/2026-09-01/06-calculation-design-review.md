# GROM nowcast — calculation-design review (main @ ec7d59a)

Scope: the math in `src/lib/weather/threat.ts`, `alerts.ts`, `chance.ts`, `trend.ts`, the SRI input path, and `scripts/hindcast.ts` / `hindcast-summary.ts`. Numeric checks were run with node scripts in the scratchpad (noted inline).

## 1. Input field (SRI → 3 km grid)

**aeqd formulas.** `aeqd.ts:15-53` are the standard Snyder sphere forward/inverse. Checked numerically on 5 points: ρ equals R·(central angle) to < 1 mm, azimuth matches `bearingDeg` to 1e-6°, round-trip error 0.0000 m. Correct.

**Georeferencing scale error — real finding (1–2.7 km).** `sri.ts:91-92` places pixel centres at `x = (col+0.5−nx/2)·xscale`: a raster centred on the projection origin, scaled by the `xscale/yscale` attributes. I fetched the live file `2026090118350000dBR.sri.h5` and read `/where`: `UL=(11.6, 56.3)`, `LR=(25.3, 48.0)`, `LL=(12.88528, 48.000004)`, `UR=(26.58529, 56.29999)`, `xscale=1163.64`, `yscale=1153.65`. Projected with the code's own `aeqdForward`, the four corners form an exact rectangle (consistent to 1e-3 m) centred 3 m / 5 m from the origin — centring is right — but the rectangle implies pixels of **1154.40 m × 1159.81 m**, not 1163.64 × 1153.65. The attributes are nominal arc lengths (yscale = meridian arc of 8.3°/800 = 1153.65 m exactly; xscale ≈ parallel arc of 13.7° at lat_0 /800), not plane pixel sizes as ODIM defines them (LL/UL/UR/LR = outer corners of the corner pixels). The error grows from the centre: Łódź 0.4 km, Warszawa 1.0, Kraków 1.4, Szczecin 2.5, Świnoujście 2.7 km. `overlayCorners` (`sri-overlay.ts:78-81`) inherits it, so map and numbers agree with each other but both are shifted against the basemap and the pin. No half-cell error (edge and centre conventions are consistent between `sri.ts:91` and `sri-overlay.ts:78`); row 0 = north is right (`sri.ts:92`).
*Fix:* at decode (`sri-h5.ts:94-106`) derive `xscale = (x_LR − x_UL)/nx`, `yscale = (y_UL − y_LR)/ny` from the corner attrs and use `(x_UL, y_UL)` as the raster origin. ~10 lines; removes up to 2.7 km of systematic error against a 5 km hit radius. Effort XS.

**Max aggregation** (`radar-grid.ts:42-55`). Right for hit/ETA ("any rain in this cell"), biased high for classes: `pinLevel` = max within 8 km (`threat.ts:806`) = max of ~140 native pixels ≈ 200 km². The areal max of convective rain over 200 km² is typically 1.5–3× the point value, so "Ulewa nad Tobą" fires on 3–4 mm/h at the pin. The hindcast cannot see this because it verifies against the same max field (§9). *Fix:* keep max for detection, add a per-cell mean (or p75) for classes; `pack.ts` spends a u16 on the class and can carry a second rate. Effort S.

**Thresholds** 0.1/1/4/10 mm/h (`palette.ts:109`): 1 and 10 match WMO/Met Office bands (slight < 2.5, moderate 2.5–10, heavy ≥ 10); 4 mm/h for "silny" is low-ish but defensible. SRI floor 0.1 is fine (file minimum is 0.01).

**Domain clip.** `sri.ts:109` discards everything outside `PL_RADAR_BBOX` (13.8–24.6°E) although the composite spans 11.6–26.6°E. Weather comes from the west; Szczecin's upstream view is ~50 km, so a 60-min lead is impossible there, and a back-trajectory leaving the bbox reads as dry (`threat.ts:397`). *Fix:* clip to the composite and keep a coarse `nodata` mask so out-of-coverage steps return "unknown". Effort S.

**Coarsening.** 9 000 samples ≈ 16 % of the bbox triggers 6 km cells (`radar-grid.ts:57`) while `CELL_KM = 3` (`threat.ts:90`) and `OVER_KM = 8` assume 3 km; a 6 km field on the 3 km NCC grid is a checkerboard rescued only by the 7×7 box smooth. Raise the cap or tie `CELL_KM` to `cellKm`. Effort XS.

## 2. Fallback path

`dbzFromRgba` → `rateFromDbz` (`palette.ts:98`, Z=200R^1.6) → same classes; edges land at 23/32.6/39 dBZ, consistent with ARCHITECTURE.md. Two inconsistencies with SRI: the 15 dBZ palette floor is 0.36 mm/h (klasa 1 starts 3.6× higher), and RainViewer is column-max-like while SRI is `PCAPPI` (from `dataset1/what`), so fallback classes run high. Acceptable for a fallback; tag `analysisSource` on hindcast rows so the two are never pooled.

## 3. Object identification and motion

**Linking.** `LINK_KM = 16` (`threat.ts:32`; the "z=5 ~12 km" comment is stale) bridges 5-cell gaps, so rainy days form one mega-mass that `splitOversizedMass` (`threat.ts:416-435`) cuts into 55 km tiles on a *fixed* lon/lat lattice. Consequences: tile centroids are pinned to the lattice, so a uniform front's trail speed ≈ 0 and `trailOk` fails (`threat.ts:642`); tile membership churns every frame, corrupting the area trend (§7); `cellLevel = mass.maxLevel` (`threat.ts:909`) is the max over a whole cluster, inflating "Spodziewaj się". *Fix:* link at 2 cells (≈ 6–7 km) for identity; track cores (local maxima ≥ klasa 3) rather than tiles. Effort S.

**NCC (TREC).** Structurally sound: Pearson NCC on the smoothed field (`threat.ts:156-187`), stride-2 search + ±1 refine (`189-216`), 3-point parabola `δ = ½(m−p)/(m−2c+p)` (`247-249`, correct). Weaknesses: correlation runs on the overlap only, so a 24-cell shift on a 40-cell window correlates ≤ 40 % of it and can win spuriously — add an overlap penalty or cap shifts at ~⅓ of `GRID_N`. Quantisation: on SRI a pair step is 5 min, so one 3 km cell = 36 km/h; only the 15-min first-last pair (weight 2.5, `threat.ts:293`) gives 4 cells for a 50 km/h storm. Run NCC at native 1.16 km (or 2 km) for SRI; cost stays in ms.

**Time base.** SRI keeps 4 consecutive 5-min frames (`server.ts:392`, `sri.ts:10`) = **15 min** base vs 30 min on RainViewer. All arithmetic uses real frame times (`threat.ts:275, 596, 691`) and failed frames are dropped (`server.ts:396`), so uneven spacing is handled. But the gates `moved ≥ 10` / `≥ 14` (`threat.ts:642, 669`) were tuned for 30 min: on 15 min they demand ≥ 40 / 56 km/h before a trail vector is trusted, and `MATCH_KM = 45` (`threat.ts:33`) is Δt-blind (540 km/h over one step). *Fix:* `SRI_HISTORY_FRAMES = 7` (30 min) and gates expressed as speed·Δt. Effort XS; probably the cheapest skill gain on SRI.

**Combination.** Bearing = weighted circular mean (`threat.ts:560-573`, atan2, no wrap bug); speed = weighted mean of pair speeds for NCC (`312`), endpoint speed for the trail (`694`), then a plain average of the two (`658`). Fine. The confidence formula (`317-321`, `648-655`, threshold 72 at line 48) is ad hoc with no error model; calibrate it in the hindcast by binning vector error (vs the t→t+30 NCC displacement) by confidence.

## 4. Advection

One vector per pin (`pinMotion`, `threat.ts:943-977`) is applied to *all* samples in `pinTimeline` (`381-401`): a second mass moving differently is advected with the wrong vector. Linear, no rotation/deformation, no growth. Versus pysteps' semi-Lagrangian backward scheme (Germann & Zawadzki 2002), the missing pieces are a spatially varying field and iterated back-trajectories. The query-radius growth (15 % of displacement, +6 km cap, `396-397`) is a fair poor-man's uncertainty cone; it also pulls ETA slightly earlier at long leads.

*Recommendation:* a dense field is cheap here. Cheapest: interpolate the per-mass vectors (inverse-distance, regional NCC as background) onto the 3 km grid and do 2–3 fixed-point iterations of the back-trajectory per timeline step — negligible cost. Fuller: block NCC every 30 km (≈ 250 blocks × ~300 shifts × 2 pairs ≈ 30 M MACs, ~50 ms) or a Lucas–Kanade port. Gain: correct ETA when two systems coexist, correct "minie bokiem" on curved fronts. Effort M.

## 5. ETA / willHit edge cases

`etaMin` is the first timeline step with klasa ≥ 1 (`threat.ts:979, 994`); `closestApproach` (2-min steps, `740-756`) only feeds `missKm`.

- **Stationary (< 4 km/h):** persistence timeline, `tlFirst = null` → never `willHit` unless ≤ 8 km. Correct, silent on in-situ growth.
- **Over pin, decaying:** `etaMin = 0` forced (`982-985`). Fine for the sheet; alert consequence in §8.
- **Two masses:** `primary` = nearest confident mass (`924-925`) but its vector advects everything (§4).
- **Speed 4–8 km/h:** `closestApproach` clamps to 8 km/h (`749`), so `missKm` copy assumes 2× the speed.
- **"Spodziewaj się" level:** `threatCellLevel = tlMaxLevel` (`995`) is the max over 90 min; an ulewa at +85 headlines "Ulewa nadciąga" with ETA 10. Use max over [eta, eta+30] as `alerts.ts:269-275` already does.
- **Domain edge:** dry beyond the bbox (§1). **Azimuth wrap:** handled by circular mean / `angleDiffDeg` (`555-558`).

## 6. Chance %

The ladder (`threat.ts:1024-1040`) is geometry-only: willHit, ETA bin, distance, receding. It ignores `cellTrend`, motion confidence, timeline rate, and lead-dependent skill (CSI 47 at +30 vs 32 at +60 on the SRI day, yet one rung spans ETA 20–45). The remap (`chance.ts:58-62`) keys on the *raw number*, but the ladder changed after calibration: the 50–59 bin (n = 28, 18 % observed) was filled by the removed close-echo rung, while today's raw 50 is "willHit, ETA 20–45, klasa 1" (`threat.ts:1034`) — a different population wearing the old bin's frequency. Calibrate on rung identity.

Statistically the table is not yet defensible: 2 days, both stratiform/leftover; cases are pin×frame at 5–10 min spacing, so bins of n = 100–460 hold perhaps 10–30 independent events. ±10 pt at 90 % around p = 0.5 needs ≈ 70 *independent* cases per bin, i.e. ≥ 10 days across regimes with day-level block bootstrap. Add a reliability diagram with Wilson intervals, Brier score with reliability/resolution decomposition, and Brier skill vs the base rate (≈ 10–25 % for echo ≤ 100 km).

## 7. Trend

`cellTrendFromSnaps` (`trend.ts:49-74`) compares first vs last snapshot on max level, mean level and sample count. Level steps are coarse, area is confounded by tile churn (§3), mm/h `rate` is unused, and the measure is whole-mass rather than the part heading for the pin. Gating (`GROWTH_MATH_ENABLED=false`, `trend.ts:32`) is right: intensity-trend extrapolation is weakly predictable beyond ~20–30 min (Tsonis & Austin 1981; Wilson et al. 1998). To make it usable: Lagrangian ΔR (sum of `rate` over matched cells along the trail); apply the fitted change for 15–20 min then damp to zero with ~30 min e-folding (S-PROG/STEPS spirit); verify only on `konwekcja` rows with the +20…+40 POD / FAR < 3 pt gate already written. Effort M.

## 8. Alert engine

`evaluateAlert` (`alerts.ts:223-377`) is clean and idempotent per frame. Holes:

1. **False "przeszło" + chatter around leadMin.** `looksClear` (`339-342`) is true when `nearestKm > 20`. A cell 35 km out at 60 km/h flips ETA across `leadMin` 30: when it reads 32 min the poll stops qualifying, the pin "looks clear", 3 min later "minęła bokiem" fires (`372-374`), and the next poll opens a new episode and fires "incoming" again. `CLEAR_KM` (20 km) is smaller than leadMin × speed. *Fix:* for episodes with `hit=false`, no all-clear while `frameEta ≤ leadMin + 15` or approaching; add hysteresis (qualify at `leadMin`, drop at `leadMin + 10`). Effort XS.
2. **Decayed in place → no all-clear.** After "now", when the cell dies over the pin, qualification ends but light echo within 20 km keeps `looksClear` false (`344-348`) until the 45-min TTL silently resets memory (`260-267`). Treat "pinLevel < minLevel for ≥ 10 min and nothing incoming" as clear.
3. **Jump > leadMin → 0 in one refresh:** handled — `overPin` fires "now" from any stage (`297`).
4. **Radar cadence slower than refresh:** re-evaluating one frame is idempotent, and wall-clock ETA shrinking with age (`244-246`) correctly lets "incoming" fire without new data. At 25 min age the title can say "teraz" from a 25-min-old frame; degrade when age > 2 × cadence.
5. **Multiple cells:** `receding` reflects the primary mass only; a second approaching cell without a confident vector can trigger "przeszło" then a new episode. Tolerable once 1 is fixed. Quiet hours, TTL and the 30-min staleness gate are fine.

## 9. Hindcast methodology

POD/FAR/CSI (`hindcast-summary.ts:120-127`) are standard; persistence = Eulerian `pinLevel` (`285`) is the right baseline.

- **Self-consistency.** Observation = max within 8 km on the same 3-km-max grid (`188`); forecast = max within 6–12 km of the back-trajectory (`threat.ts:389-397`). Both neighbourhoods and the max aggregator inflate POD and hide §1's intensity bias. Add a strict variant (nearest cell only) and verify classes against the native field or a cell mean.
- **ETA sign and quantisation.** `etaMin − first` (`299, 320`): positive = late, as documented. But `first` is the first *10-min* lead with rain (`HINDCAST_LEADS`, line 15) even on 5-min SRI: the true onset lies in (lead−10, lead], so the measured bias is shifted ≈ −5 min; the logged SRI medians of 0 mean ≈ +5 min late. Score at 5-min leads on SRI.
- **Independence.** ~182 lattice pins (`hindcast.ts:217-220`) × every frame are strongly autocorrelated; bootstrap by day.
- **Per-frame alert scoring** counts an alert that fires one frame after the "dry now" frame as a miss. Add event-based scoring: per pin and onset, the earliest alert lead and the share of onsets warned ≥ 10 / 20 min ahead.
- **Add:** FSS at 5/10 km on the whole field (much larger sample than pins), reliability + Brier (§6), CSI-vs-lead per regime and season, vector error vs confidence (§3), `analysisSource` per row.

## 10. Summary

| Stage | Current | Weakness | Recommended change | Expected gain | Effort |
|---|---|---|---|---|---|
| Georef | origin-centred, attr scales (`sri.ts:91`) | 1–2.7 km scale error vs ODIM corners | pixel size from UL/LR corners | removes systematic offset vs 5 km hit radius | XS |
| Domain | clip 13.8–24.6°E (`sri.ts:109`) | west blind, back-trajectory reads dry | composite-wide clip + nodata mask | 60-min leads for western pins | S |
| Aggregation | max per 3 km cell | classes biased high over 200 km² | add mean/p75 rate for classes | fewer false "Ulewa nad Tobą" | S |
| History | 4 × 5 min SRI (`server.ts:392`) | 15-min base, gates tuned for 30 | 7 frames, gates as speed·Δt | steadier vectors, slow systems tracked | XS |
| Identity | 16 km link, fixed 55 km tiles | pinned tile centroids, level inflation | 2-cell link, core tracking | honest trail speed and cellLevel | S |
| NCC | 3 km, overlap-only NCC | 36 km/h quantum per 5 min, edge bias | native grid on SRI, overlap penalty | smoother speeds | S |
| Advection | one vector per pin | wrong for 2nd mass, no deformation | interpolated dense field, iterated back-trajectory | correct multi-cell ETA | M |
| Chance | raw-value remap, geometry only | bin/rung mismatch, tiny effective n | rung-keyed calibration, reliability + Brier | trustworthy % | S + data |
| Trend | first-vs-last level/area | tile churn, no mm/h | Lagrangian ΔR, damped, gated | earlier alerts on deepening cells | M |
| Alerts | `CLEAR_KM` 20 all-clear | false "przeszło", chatter | hysteresis; no all-clear while ETA ≤ leadMin+15 | fewer wrong alerts | XS |
| Hindcast | 10-min leads, per-frame, same field | −5 min ETA artefact, inflated POD | 5-min leads, strict variant, event-based, FSS | comparable numbers | S |

**Ranked top-8 (cheap-and-large first):** 1) all-clear hysteresis (§8.1–8.2); 2) corner-derived pixel size (§1); 3) 7-frame SRI history + Δt-aware gates (§3); 4) composite-wide domain + nodata mask (§1); 5) rung-keyed chance calibration with reliability/Brier and 5-min ETA scoring (§6, §9); 6) mean-rate classes for "nad Tobą" (§1); 7) dense interpolated motion field with iterated back-trajectory (§4); 8) Lagrangian damped trend behind the existing gate (§7).

**Good and defensible as-is:** the aeqd implementation and its edge/centre conventions; sample-level hit/ETA via backward advection instead of centroid geometry; real-time-based motion arithmetic tolerant of missing frames; circular-mean bearings with pair-agreement QC; sub-pixel parabola and coarse-to-fine NCC; the regional NCC fallback; the query-radius growth as an uncertainty proxy; ETA to *threshold* intensity in alerts; wall-clock ETA; the episode state machine with staleness gate; keeping growth math off until convective days exist; verifying against persistence with both shipped and research configs.
