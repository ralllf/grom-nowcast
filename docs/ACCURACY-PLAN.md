# Accuracy & reliability plan

*Written 2026-08-31 against `main` (post [PR #4](https://github.com/ralllf/grom-nowcast/pull/4)). English by request; product terms stay Polish (Szansa, ETA, Echo, tor komórki, Czysto, nadciąga / nad Tobą / przeszło, pinezka, promień alertu).*

The question this document answers: **how does GROM make fewer mistakes** — fewer false alarms, fewer missed cells, truer ETA, right place — **and how do we get there in tiny slices**, each shippable and visible the same day, on the existing stack (TanStack Start server functions + browser). No second backend, no ML-from-scratch, no new apps.

Method: the whole pipeline was read ([`server.ts`](../src/lib/weather/server.ts), [`threat.ts`](../src/lib/weather/threat.ts), [`alerts.ts`](../src/lib/weather/alerts.ts), [`palette.ts`](../src/lib/weather/palette.ts), [`teryt.ts`](../src/lib/weather/teryt.ts), UI, [`scripts/hindcast.ts`](../scripts/hindcast.ts)), and the candidate data sources were probed live on 2026-08-31 (results quoted below, with failures included). Guesses are labeled **hunch**.

---

## 1. Where GROM is wrong today — ranked failure modes

Ranked by (user harm × frequency), best evidence first. "The pipeline" = RainViewer tiles → exact palette ([`palette.ts`](../src/lib/weather/palette.ts)) → ~3 km grid capped at 9 000 samples ([`server.ts`](../src/lib/weather/server.ts) `aggregate()`) → masses + NCC motion → pin narrative & timeline in `computeThreat` ([`threat.ts`](../src/lib/weather/threat.ts)) → episode alerts ([`alerts.ts`](../src/lib/weather/alerts.ts)).

### F1. Growth and initiation are invisible → missed cells and late ETA

The nowcast is pure linear advection: `pinTimeline()` moves today's echo along one vector, with no intensity evolution (the `grow` term only widens the *search radius* by ≤6 km). The one hindcast we have ([`docs/HINDCAST.md`](HINDCAST.md), 31 VIII 2026, one frontal morning) puts numbers on it:

- POD 68 % at klasa ≥ 1 — **one third of rain events within 60 min were missed**;
- ETA error on hits: median **+5 min (klasa 1), +10 min (klasa 2)**, spread −20…+30 — "lekko za późno, bo ekstrapolacja liniowa nie widzi, że komórka rośnie";
- and that was a *front*, the easy case. HINDCAST.md itself warns: "konwekcja popołudniowa (komórki rosną in situ) — dużo gorzej" (stated, so far unmeasured — the whole point of Slice 0).

The UI is honest about it ("Komórka może też urosnąć na miejscu…"), but honesty doesn't recover the missed alert. Biggest single error mass in the product.

### F2. ETA is anchored to radar frame time, not the wall clock

`TimelinePoint.t` is "*Minutes from the latest radar scan*" ([`types.ts`](../src/lib/weather/types.ts)), the sheet labels t=0 "teraz" ([`threat-sheet.tsx`](../src/components/threat-sheet.tsx)), and `evaluateAlert` compares that same `eta` against `leadMin`. Nothing subtracts the age of the frame. The age at render oscillates: RainViewer publishes every 10 min (measured today: latest frame 1.4 min old right after publish; just before the next publish it is ~11 min), plus up to 90 s snapshot cache ([`server.ts`](../src/lib/weather/server.ts) `radarScanCache`) and 90 s poll interval ([`grom-app.tsx`](../src/components/grom-app.tsx)), plus POLRAD→RainViewer processing lag (ARCHITECTURE: "kilku–kilkunastu minut").

The error is **one-sided**: "Dojście nad Kraków: ok. 18 min" can mean 6 minutes of real time. The user thinks they have more time than they do — the worst direction for the take-the-jacket decision. The alert body already prints the radar clock (`radarSuffix` in [`alerts.ts`](../src/lib/weather/alerts.ts)), but the headline number does not use it. Note the existing hindcast **cannot see this error** — it compares frame times with frame times — which is why Slice 0 must log frame age separately.

### F3. Ostrzeżenia IMGW land in the wrong powiat, or not at all (TERYT)

Warning matching is exact TERYT equality (`warningMatches` in [`server.ts`](../src/lib/weather/server.ts)). The pin's TERYT comes from Nominatim `extratags["teryt:terc"]` (often absent — **hunch** on the exact rate) with a fallback that copies TERYT **from the nearest of 21 hardcoded cities within 30 km** ([`teryt.ts`](../src/lib/weather/teryt.ts), [`cities.ts`](../src/lib/weather/cities.ts)). Two failure shapes:

- A pin 10 km outside Kraków sits in **powiat krakowski (1206)** but inherits the city's **1261** → shows the wrong powiat's warnings and misses its own.
- A rural pin > 30 km from any listed city, with no Nominatim terc, gets **no TERYT** → `matchesPlace` is always false → the `watch` level and "Ostrzeżenie IMGW" never fire there, silently.
- Smaller (**hunch**, outbreak days only): the snapshot ships max 40 national storm warnings ([`server.ts`](../src/lib/weather/server.ts) `getSnapshot`); moving the pin client-side re-tags against that truncated list ([`grom-app.tsx`](../src/components/grom-app.tsx)).

This is the only *official* layer GROM shows; being quietly wrong about it costs more trust than a wrong nowcast.

### F4. "Burza" is a reflectivity guess — no lightning anywhere in the pipeline

Klasa 4 (≥ 10 mm/h ≈ 40 dBZ, [`palette.ts`](../src/lib/weather/palette.ts)) is verbalised as "Burza" (`noun()` in [`threat.ts`](../src/lib/weather/threat.ts)), "Gwałtowna burza" (`levelNounPl` in [`alerts.ts`](../src/lib/weather/alerts.ts)), and "możliwy grad" (`expectPl`). A non-electrified warm-rain downpour gets called a storm (false alarm on the word), and an electrified cell with a modest 35 dBZ core gets called "Ulewa" (miss on the word). Hail is inferred from ≥ 55 dBZ (`HAIL_RATE`) — a heuristic. The fix is a lightning feed, which IMGW publishes (PERUN, section 2) — with one access snag found in today's probe.

### F5. One upstream failure takes down the whole snapshot

`getSnapshot` runs `Promise.all([sampleRadar(), getImgwWarnings(), …])` ([`server.ts`](../src/lib/weather/server.ts)) — when the IMGW warnings API times out (it does have bad days — **hunch** on frequency), the *radar* dies with it: the sheet shows "Nie udało się pobrać radaru albo ostrzeżeń" and alerts stop evaluating. The reverse also holds. Related, smaller: frames with missing tiles are marked `degraded` and shown as "niepełne", but still feed motion estimation — a missing tile can amputate a mass and bend its vector (mechanism real, frequency **hunch**). Strategic layer of the same problem: RainViewer is a single source under a personal/educational license that already deleted `nowcast[]` on 2026-01-01 (verified again today: 0 nowcast frames).

### F6. Szansa % is a hand-tuned ladder, never calibrated

The chance number comes from a stack of `Math.max/min` rungs (25/40/55/60/70/80/90…) in [`threat.ts`](../src/lib/weather/threat.ts). It is honestly *worded* ("szansa", not "pewność"), but nobody has measured whether "70 %" verifies ~70 % of the time. Until a reliability table exists (Slice 0), every rung is a guess — and `minChancePct` filters alerts on top of it, so miscalibration leaks into missed/false alerts.

### F7. No-motion fallbacks invent precision

When no vector exists and echo is ≤ 20 km, ETA becomes `round(nearestKm × 1.5)` ([`threat.ts`](../src/lib/weather/threat.ts)) — an implicit ~40 km/h approach speed with **no direction at all**, shown in the ETA stat like any other number, and eligible to fire alerts via the `etaToLevel` fallback ([`alerts.ts`](../src/lib/weather/alerts.ts)). The timeline's persistence fallback is labeled ("bez ruchu — jak teraz") — the headline ETA is not. After the regional-NCC work this is ~13 % of echo cases (HINDCAST.md: vector present ~87 %). Related wrong-words path, verified in code: `closeLevel >= 3` forces `level = "imminent"` regardless of motion, so a strong cell 10–15 km away that is *receding* gets the headline "Ulewa nadciąga" while the detail below it correctly says "odchodzi" — headline and detail can contradict each other.

### F8. The grid coarsens exactly on the big days

The 9 000-sample cap ([`server.ts`](../src/lib/weather/server.ts) `MAX_RADAR_SAMPLES`) doubles the aggregation cell when exceeded. Rain over roughly a sixth of the domain already trips the first doubling to ~6 km (domain ≈ 495 000 km², 9 000 × 9 km² ≈ 81 000 km²) — common on frontal days; 12 km needs ~65 % coverage (rare). Meanwhile [`threat.ts`](../src/lib/weather/threat.ts) constants assume ~3 km spacing (`OVER_KM = 8` — "Samples are ~3 km apart"; timeline radius `OVER_KM * 0.75`). At 6 km the effect is mild smearing of `pinLevel` and ETA quantisation; at 12 km "nad Tobą" can literally miss rain over the pin (nearest cell centre up to ~8.5 km away). Frequency of real harm: **hunch** — Slice 0 logs `cellKm` to find out.

### F9. The map contradicts the numbers (overlay ≠ analysis)

Analysis decodes unsmoothed `2/0_0` tiles and drops sub-15 dBZ beige as noise; the map draws smoothed `2/1_0` tiles where that drizzle is visible ([`palette.ts`](../src/lib/weather/palette.ts) `ANALYSIS_COLOR_OPTIONS` vs `OVERLAY_COLOR_OPTIONS`, [`radar-map.tsx`](../src/components/radar-map.tsx) `syncRadar`). Users see paint over their city while the sheet says "Czysto" — a perceived false negative that erodes trust in the honest number (**hunch** on how often users notice; the mechanism is certain). Fully fixable only when we render our own overlay (Slice 7).

*Not on the list because recent PRs already fixed them (kept as regression guards in tests): pin-dependent arrows (now `sampleOrigin`/`PL_RADAR_ORIGIN`, tracks pin-free), the old 5 000-sample sort-and-truncate that dropped southern Poland (now grid aggregation), hue-guess palette (now exact table), centroid-based hit/miss (now sample advection), IMGW timezone parsing ([`imgw-time.ts`](../src/lib/weather/imgw-time.ts)).*

---

## 2. Data: what we have, what to add, what to refuse

Everything below was checked live on 2026-08-31 unless marked as repo-documented. Constraint honored: sources GROM can fetch from the browser or via the existing thin server functions — anything needing a real backend, paid key, or training set is called out.

### Already in the repo

| Source | What | Terms | State |
|---|---|---|---|
| RainViewer Public API | POLRAD composite, 10 min cadence, analysed at z=6 (~3 km samples) | personal/educational + attribution; `nowcast[]` removed 2026-01-01 | core of the pipeline ([`server.ts`](../src/lib/weather/server.ts)) |
| IMGW `warningsmeteo` | official powiat warnings, TERYT lists | open data, attribution | matched by TERYT; see F3 |
| Nominatim / OpenFreeMap / Esri fallback | geocoding, basemap | usage policies respected | working |
| Cities list + TERYT | 21 cities | — | fallback source of F3 |

### Worth adding (verified today, in slice order)

**IMGW PERUN lightning — the "to burza, nie ulewa" signal.** Published as open data on danepubliczne datastore: `Oper/Perun/1min_secondaire/` (1-min files, listing today showed `20260831-111500.Secondaire` at ~11:16 wall — **1–2 min behind real time**) and `Oper/Perun/PERUN_Polska/` (5-min `.ld` + `.ld.csv`). System accuracy per IMGW: 250–500 m, ~95 % detection of CG strokes. **Access snag found:** directory listings are public (POST `datastore/getFilesList`), but every scripted download of a Perun file via `…/pl/datastore/getfiledown/Oper/Perun/…` bounced to the datastore HTML page — with the *same URL scheme that serves POLCOMP radar files fine*. So: license open, data fresh, download path unproven. Slice 5 starts with a quick browser/DevTools check and, if the subtree is really gated, one email to IMGW open-data support. No paid key, no training set; needs the existing server function only (CORS + parsing).

**IMGW POLCOMP radar composite (SRI) — fresher, finer, license-clean radar.** Verified end-to-end today: listing via POST `datastore/getFilesList` with `path=Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri`; newest file `2026083111150000dBR.sri_echoOnly.png` at ~11:21 wall — **5-min cadence, ~6 min behind real time** (vs RainViewer's 10 min + lag); download works unauthenticated: e.g. `https://danepubliczne.imgw.pl/pl/datastore/getfiledown/Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri/<file>`. Formats measured: `_echoOnly.png` = 800×800 RGBA with a small discrete palette (~17 colours) — same decode strategy as today's palette table; `.sri.h5` = 114 kB ODIM HDF5 with `projdef = +proj=aeqd +lon_0=19.0926 +lat_0=52.3469 +ellps=sphere` embedded. The H5 carries **real mm/h values** — SRI is a surface-rain-intensity product, i.e. IMGW already applied Z–R and corrections, which retires Marshall–Palmer-from-colour (F-adjacent honesty win) and the RainViewer license risk (F5) in one move. Two cautions: [`DATA.md`](DATA.md) says 900×900/1 km while the PNG measures 800×800 — resolve against H5 grid attrs in the slice; and the mirror at `/api/data/product/id/COMPO_SRI.comp.sri` lags **hours** (verified) — use the datastore listing, not the product API. Retention is a rolling ~3 days, which also caps how far back hindcast can reach — same as RainViewer's 13 frames, only denser.

**Powiat boundaries (static, one-time).** Needed to fix F3 properly (point-in-polygon instead of nearest-city-TERYT) and reusable as the warning choropleth layer. Source: PRG / GUS open administrative boundaries, simplified to a few hundred kB of GeoJSON, shipped as a static asset (lazy-loaded). No server, no key, no license problem (public sector data).

### Deliberately later or refused

| Source | Verdict | Why |
|---|---|---|
| **Blitzortung** | **refuse** | Terms verified today: data "for private and entertainment purposes", explicitly **"not allowed to use our lightning data for storm warning systems"**, raw feed for participants only, no public API ([blitzortung.org/en/contact.php](https://www.blitzortung.org/en/contact.php)). GROM is literally a storm warning app. PERUN or nothing. |
| **EUMETSAT satellite** | later, maybe | Useful for convective initiation (F1) and radar-blind spots at night/mountains ([`IDEAS.md`](IDEAS.md) already says so), but ~3–5 km pixels add little to a 5-km pinezka ETA, and it's another projection/decode pipeline. Revisit only if Slice 0 shows a measurable class of misses that SRI + PERUN don't fix. Free registration; WMS access — still a new pipeline, so not now. |
| **NWP (COSMO/ICON/UM)** | later, as background only | IMGW even publishes COSMO 2.8 km GRIBs on the same product API (verified: `COSMO_HVD_*`) — but a 0–90 min radar nowcast gains ~nothing from a model in that window, GRIB decoding is a new pipeline, and [`IDEAS.md`](IDEAS.md) already scoped it as "tło 6–12 h, nigdy zamiast radaru". Out of this plan. |
| **Storm reports (ESWD / Łowcy Burz)** | manual only | No public API / restrictive terms; use manually when reviewing hindcast case days. Never an app layer here. |
| **IMGW synop stations** | verification aid at most | Hourly and sparse — useless for minutes-scale nowcast; could sanity-check hindcast someday. |
| **`meteo.imgw.pl/api/radars/…`** | refuse | Undocumented, watermarked; [`DATA.md`](DATA.md) already says "nie budować na nich". Stands. |
| **IMGW ZHAIL / CMAX products** | after Slice 6 | Same POLCOMP pipeline once SRI is in; ZHAIL turns "możliwy grad" from a dBZ guess into a product. Not before the SRI decode exists. |

---

## 3. Map: layers worth adding vs noise

Worth it (each is a slice below, each reuses data we already need):

1. **Wyładowania (PERUN)** — age-faded strike dots for the last ~15 min. Directly answers "czy to burza"; pairs with the copy change in F4. (Slice 5)
2. **Powiaty z ostrzeżeniem** — subtle shading of powiats with an *active* storm warning, stopień-coloured, toggleable. Makes the IMGW lane visible and honest; free once boundary polygons ship for F3. (Slice 4)
3. **Own radar overlay from SRI** — one small georeferenced PNG per 5 min (MapLibre image source, not a tile server), rendered in exactly the four legend classes. Kills F9 (map finally agrees with "Czysto"), enables the drizzle filter. (Slice 7)

Noise (explicitly not doing):

- Wind / temperature / pressure layers — Windy and Ventusky exist; zero value for a pin ETA.
- Satellite layer as a default — coarse, night-niche; see data table.
- More basemaps, dark map — readability was a founding decision ([`IDEAS.md`](IDEAS.md)).
- Long animation loops — the 13-frame scrub already exists ([`grom-app.tsx`](../src/components/grom-app.tsx)); RainViewer-the-app is that product.
- Województwo shading — coarser than powiat, contradicts "pinezka, nie powiat".
- A "przewidywana pozycja za 30 min" ghost contour — tempting, but it draws certainty we measurably don't have (F1's spread −20…+30 min). Reconsider only after Slice 9's gate passes.

---

## 4. User filters that reduce mistakes

The settings that exist already do the right job (leadMin, minLevel, minChancePct, ciche godziny, promień alertu as call range, dźwięk, "przeszło"). Missing are three filters that map 1:1 to failure modes — and nothing else:

1. **"Tylko burze z piorunami"** (after Slice 5) — one checkbox; alerts and the "Burza" noun require detected lightning in the cell. For the user who tolerates rain but not storms, this deletes the F4 false-alarm class.
2. **"Pokaż mżawkę"** on the map, default **off** (with Slice 7) — the map shows klasa ≥ 1 by default, exactly what the numbers count; F9 gone by construction.
3. **Presets over sliders** — "Czuły / Normalny / Tylko pewne" bundles for (leadMin, minLevel, minChancePct), raw sliders stay under "zaawansowane". Misconfigured sliders are a silent source of "GROM nie zadziałał" (**hunch**, cheap to ship alongside Slice 8's recalibration since it touches the same surface).

Refused: per-layer opacity, per-cell muting, custom palettes, anything that makes `promień alertu` an accuracy knob again (it is the alert *call range*, nothing else — README zasada 1).

---

## 5. Alert taxonomy: keep / change

**Keep (all of it is earning its keep):**

- The **episode machine** — idle → nadciąga → nad Tobą → przeszło, one alert per stage per episode, 45-min TTL, per-pin memory, reload-safe ([`alerts.ts`](../src/lib/weather/alerts.ts), tested in `alerts.test.ts`). A four-stage "zaraz (≤ 5 min)" extra ping was considered and **rejected**: it doubles notification volume for information the Slice-1 wall-clock fix delivers better.
- **Pin-based alerting only.** `evaluateAlert` never looks at the radius today — correct; stays. Promień = how far we *call* "opad w okolicy", never what we average.
- **No województwo alerts, ever.** That's RCB/IMGW's product; GROM alerting on a województwo would be a worse copy of it.
- **Stale-radar refusal** (> 30 min → no alerts) and quiet-hours banner-only behavior.

**Change (in slice order):**

1. **Two visible lanes: nowcast vs czuwanie.** Today `watch` sits inside the same `ThreatLevel` ladder as radar levels ([`threat.ts`](../src/lib/weather/threat.ts)), so the headline silently switches between "minutes, radar" and "hours, powiat" semantics. Keep the enum; in the UI make Ostrzeżenie IMGW a persistent, **time-boxed** second row — "Ostrzeżenie IMGW: burze · dziś 14:00–22:00" (`formatImgwWhen` already exists) — never the same visual slot as "nadciąga za 18 min". (Slice 4 ships it with the choropleth.)
2. **ETA becomes wall-clock and, later, a range.** First subtract frame age (Slice 1). Then, once Slice 0 gives percentiles, display "za 12–20 min" instead of "ok. 18 min" *if* the measured spread stays as wide as today's −20…+30 (copy change, gated on data).
3. **"Burza"/"Gwałtowna burza"/"możliwy grad" earned by measurement**, not reflectivity: lightning gates the storm noun (Slice 5), ZHAIL eventually gates grad (post-Slice 6). Until then wording stays but this plan marks it as a known lie of confidence.

---

## 6. The slices

Rules honored: each slice is one visible change a human ships in a day; each has who-sees-what, a success check, and an out-list; no slice grows the platform. **Slice 0 comes first because without it every later slice is a guess** — including "did this slice help".

### Slice 0 — Measure the errors (the ruler)

*The hindcast exists ([`scripts/hindcast.ts`](../scripts/hindcast.ts)) but has run on one morning, one front, and it scores a research config, not what users run: `leadMin: 60, minChancePct: 0` vs shipped defaults `leadMin: 30, minLevel: 2, minChancePct: 50` ([`alerts.ts`](../src/lib/weather/alerts.ts) `DEFAULT_ALERT_SETTINGS`). It also can't see F2 at all (frame-time vs frame-time).*

- **Ship:** a `docs/HINDCAST-LOG.md` error ledger — one row per run: date, regime tag (front / konwekcja / mieszane — typed by hand), POD/FAR/CSI per lead vs persistence, ETA bias percentiles, % advected vs persistence/crude-ETA cases, `cellKm` seen (F8), RainViewer frame age at run time (F2), scored **both** with shipped defaults and the research config. Plus the smallest script change that makes rows comparable: a `--json` summary flag and a Szansa calibration table (bucket `chancePct` vs observed outcome — F6's measuring stick). No product code touched.
- **Who sees what:** Rafał sees a table in the repo that grows by one honest row per stormy day; every later slice quotes it.
- **Success check:** ≥ 5 logged days including ≥ 2 convective ones; the log answers, with numbers: how many misses are initiation (F1), what the real ETA spread is, how often crude-ETA fires (F7), how often the grid coarsens (F8), and what the Szansa reliability curve looks like (F6).
- **Stays out:** dashboards or charts; any cron/CI automation; storing radar frames in the repo (rule stands).

### Slice 1 — ETA in wall-clock time

- **Ship:** subtract radar frame age everywhere a user sees minutes: ETA stat, "Dojście nad…", alert "za ok. X min", timeline axis (floor at 0 → "teraz"). Add a small "Radar 11:15 · sprzed 6 min" caption in the sheet (the alert body already prints the radar clock — surface the *age*).
- **Who sees what:** the same screen, but "18 min" now means 18 minutes from *now*; a storm that is effectively 7 minutes out stops claiming 18.
- **Success check:** invariant — frame-time hindcast skill unchanged (it must be, the shift is display/decision-side); live check on one storm day: alert fires earlier by ≈ the mean frame age logged in Slice 0; no new false alarms in the log.
- **Stays out:** interpolating between frames; polling faster than 90 s; touching the motion math.

### Slice 2 — A source outage degrades, not kills

- **Ship:** `getSnapshot` stops dying when one source dies ([`server.ts`](../src/lib/weather/server.ts) `Promise.all` → settled): warnings down ⇒ radar + "Ostrzeżenia IMGW chwilowo niedostępne" line; radar down ⇒ warnings + the existing stale-radar honesty (alerts already refuse stale radar on their own).
- **Who sees what:** during the next IMGW API hiccup the map and nowcast keep working with one small notice, instead of "Nie udało się pobrać radaru albo ostrzeżeń".
- **Success check:** dev-simulated 404/timeout on each source leaves the other fully functional; tests cover both directions; no behavior change when both are up.
- **Stays out:** retry queues / circuit breakers; a status page; changing how `degraded` frames feed motion (measure first — F5's smaller half stays open until Slice 0 says it matters).

### Slice 3 — Prawdziwy TERYT (powiat boundaries)

- **Ship:** static simplified powiat polygons (PRG/GUS, a few hundred kB, lazy-loaded), point-in-polygon → exact TERYT for any pin; the 30-km nearest-city fallback ([`teryt.ts`](../src/lib/weather/teryt.ts)) demoted to last resort.
- **Who sees what:** the TERYT chip in the sheet is right everywhere — a pin in Wieliczka shows powiat wielicki, not Kraków; rural pins finally get their Ostrzeżenie IMGW.
- **Success check:** 10 adversarial pins (city edges, rural gminy, tri-powiat corners) all match the official TERYT; unit test with known coordinates; bundle cost stays within the agreed lazy-loaded budget.
- **Stays out:** gmina-level matching; drawing the polygons (next slice); any server-side geo database.

### Slice 4 — Map lane for the IMGW warning (choropleth + time-boxed copy)

- **Ship:** reuse Slice 3 polygons: powiats with an active storm warning get a subtle stopień-coloured tint (toggle); the sheet's IMGW line becomes the two-lane, time-boxed form — "Ostrzeżenie IMGW: burze · dziś 14:00–22:00 · powiat X".
- **Who sees what:** one glance separates "IMGW czuwa nad powiatem od 14:00" from "radar widzi komórkę za 18 min" — the two horizons stop competing for one badge.
- **Success check:** shading matches the day's `warningsmeteo` list exactly; readable on a phone over the radar overlay; toggle state persists.
- **Stays out:** non-storm warnings (upały, mgła…); historical warnings; per-gmina shading.

### Slice 5 — Pioruny (PERUN): "Burza" becomes a measurement

- **Ship:** *step 1 is the access spike* — reproduce the Perun `getfiledown` bounce in a real browser; if it persists, one email to IMGW open-data support (the data is published under the open-data regime; POLCOMP serves fine over the same endpoint, so this smells like a config quirk, not policy — **hunch**). Once files flow: thin server fetch of the last ~15 min of strikes (5-min `PERUN_Polska` CSV first, 1-min feed if cheap), age-faded dots on the map, and the copy gate: "Burza"/"Gwałtowna burza" only with lightning near the cell; otherwise "Ulewa". Alert body gains "wyładowania w komórce".
- **Who sees what:** strike dots on the cell that's coming; the headline stops crying storm at electrically dead downpours.
- **Success check:** on a storm day, dots sit on radar cores (sanity); Slice-0 log adds a "Burza said / lightning present" column and the F4 false-rate drops; latency of newest strike ≤ ~3 min.
- **Stays out:** Blitzortung in any form (license); strike history/archive; lightning-jump nowcasting (a real idea — *after* this data has months of history).

### Slice 6 — Radar IMGW SRI 5 min: fresher, finer, license-clean analysis

- **Ship:** swap the **analysis** source from RainViewer tiles to COMPO_SRI (verified pipeline above; decode `_echoOnly.png` by palette table exactly like today's [`palette.ts`](../src/lib/weather/palette.ts) approach, or `.sri.h5` via `h5wasm` for true mm/h — decide in-slice against the H5 grid attrs; inverse aeqd is ~20 lines). RainViewer stays as the map overlay and as automatic fallback source. Timeline/ETA cadence becomes 5 min.
- **Who sees what:** "Radar IMGW 11:15 · sprzed 6 min" instead of a 10-min-stale composite; mm/h that are IMGW's product, not Marshall–Palmer-from-colour.
- **Success check:** hindcast (Slice 0 protocol) re-run on SRI frames beats the RainViewer baseline on ETA bias and short-lead POD; fallback proven by simulating a datastore outage; the 800×800-vs-900×900 grid question answered in `DATA.md`.
- **Stays out:** own overlay rendering (next slice); CMAX/ZHAIL/dual-pol products; re-tuning NCC parameters beyond the grid-spacing constant.

### Slice 7 — Own overlay from SRI (map = numbers) + drizzle filter

- **Ship:** serve the decoded national field as one small PNG per frame (MapLibre **image source** with corner coordinates — not a tile server), coloured in exactly the four legend classes; "pokaż mżawkę" toggle, default off.
- **Who sees what:** when the sheet says "Czysto", the map is clean too; the legend finally describes every pixel on screen (F9 dead).
- **Success check:** pixel-compare overlay vs analysis classes on a rainy frame — zero class disagreement; network cost ≤ one ~50–100 kB image per 5 min; RainViewer overlay remains as fallback.
- **Stays out:** a tile server / CDN; snow palette; animating *forecast* frames.

### Slice 8 — Szansa that means szansa (recalibration)

- **Ship:** re-map the chance ladder in [`threat.ts`](../src/lib/weather/threat.ts) to the empirical bins from the Slice-0 calibration table (SRI-era rows). Same UI, same word, truer number. Ship the settings presets ("Czuły / Normalny / Tylko pewne") in the same PR — same surface, and `minChancePct` only makes sense over a calibrated Szansa.
- **Who sees what:** nothing new — which is the point: "~70 %" starts happening ~7 times in 10.
- **Success check:** reliability curve within ±10 pts per bin on held-out log days; alert POD/FAR at shipped defaults not worse.
- **Stays out:** ML models; per-regime probability models; confidence intervals in the UI.

### Slice 9 — Growth/decay trend (the first licensed change to nowcast math)

- **Ship:** per-mass intensity/area trend over the existing 4-frame trail (`buildMassTrail` already tracks identity in [`threat.ts`](../src/lib/weather/threat.ts)): a "komórka rośnie / słabnie" line in the copy, and a *modest*, hindcast-gated adjustment of timeline levels / ETA-to-threshold for growing cells. This attacks F1 head-on — and it is last on purpose: it's the only slice that can silently make things worse, which is why it ships only over the Slice-0 gate.
- **Who sees what:** "Komórka rośnie" in the sheet; earlier "nadciąga" on deepening cells.
- **Success check:** on ≥ 3 convective log days: POD at +20…+40 min up, FAR up by < 3 pts, ETA median bias toward 0. If the gate fails, the copy line stays and the math adjustment reverts — that outcome is acceptable and cheap.
- **Stays out:** optical-flow rewrite (pysteps-style Lucas–Kanade stays an [`IDEAS.md`](IDEAS.md) direction for the 1-km era); per-pixel Lagrangian growth fields; NWP blending.

*After the sequence, unchanged from [`IDEAS.md`](IDEAS.md) and not re-planned here: GPS pathway on a real phone, Web Push in tle (needs a scheduler + subscription store — that's the platform line this plan refuses to cross), trasa / kilka pinezek.*

---

## 7. What we will NOT do

- **No ML black box.** No training set exists (frames are deliberately not stored), no verification culture existed until Slice 0, and an unexplainable nowcast can't say "to ruch echa, nie pewność" and mean it. The path here is measured physics-lite improvements — and if someday more, pysteps-style optical flow is still not "ML".
- **No second backend, no DB, no queues.** Every slice above runs in the existing TanStack Start server functions + browser + static assets. Push-w-tle explicitly waits because it breaks this rule.
- **No extra apps, bots, chat.** No Telegram/Discord/Messenger bots, no chat UI. GROM is one screen that answers skąd / za ile / czego się spodziewać.
- **No accounts, no cloud storage of location.** `localStorage` remains the only memory (README zasada; [`store.ts`](../src/lib/store.ts)).
- **No 7-day forecast, no drugi Windy.** Different product.
- **No undocumented endpoints** (`meteo.imgw.pl` watermark API) and **no license-violating feeds** (Blitzortung for warnings).
- **No radar frames in git** — hindcast keeps caching to the OS temp dir only.

---

## 8. Order recap

| # | Slice | Failure modes hit | New data? |
|---|---|---|---|
| 0 | Error ledger + hindcast routine | measures F1–F8 | no |
| 1 | Wall-clock ETA | F2 | no |
| 2 | Outage degrades, not kills | F5 | no |
| 3 | TERYT by boundary | F3 | static polygons |
| 4 | Warning choropleth + time-boxed IMGW lane | F3, taxonomy | reuses 3 |
| 5 | PERUN lightning + "Burza" gate | F4 | yes (access spike first) |
| 6 | IMGW SRI analysis source | F2, F5, F8, Marshall–Palmer honesty | yes (verified) |
| 7 | Own overlay + drizzle filter | F9 | reuses 6 |
| 8 | Szansa recalibration + presets | F6 | no (uses 0) |
| 9 | Growth/decay trend | F1, F7 | no (uses 0 as gate) |

Slices 1–2 need no new data at all. 3–4 need one static file. 5 has an access risk flagged honestly. 6–7 are the biggest edits but fully de-risked by today's probes. 8–9 are earned by the ledger, not by enthusiasm.
