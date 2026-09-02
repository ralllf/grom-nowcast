# Is the model good enough? Forecast beyond 90 min, and Poland vs Europe

Researched 2026-09-02. Web search was unavailable to the researcher, so numbers come from primary papers and data portals fetched directly; **UNVERIFIED** marks what could not be opened.

## 1. Where GROM's skill sits

Published, comparable numbers (radar-only, 1 km / 5 min):

| System | Metric | 30 min | 60 min | 90–120 min | Source |
|---|---|---|---|---|---|
| rainymotion Dense (DWD RY, 11 summer events) | CSI ≥1 mm/h | ~0.52 (5–30 min avg) | ~0.38 (35–60 min avg) | – | https://gmd.copernicus.org/articles/12/1387/2019/ |
| Eulerian persistence, same events | CSI ≥1 mm/h | ~0.35 | ~0.20 | – | same |
| DWD RADVOR operational | CSI ≥1 mm/h | ~0.50 | ~0.36 | – | same |
| pysteps S-PROG vs plain extrapolation (MeteoSwiss) | CSI ≥0.1 mm/h | – | – | +~20 % CSI at 2 h | https://gmd.copernicus.org/articles/12/4185/2019/ |
| pysteps deterministic (KNMI, 1,533 events) | decorrelation time vs persistence | 25 min (1 h rain) … 116 min (24 h rain) | | | https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2019WR026723 |
| DGMR (UK 2019) | CSI ≥1/4/8 mm/h to +90 min | DL and pySTEPS "perform similarly on CSI"; DGMR wins on CRPS/sharpness; ~0.5 at +30 → ~0.35 at +90 for 1 mm/h read off Fig. 2 (approximate) | | | https://arxiv.org/abs/2104.00954 |
| NowcastNet (2023) | CSI-neighbourhood ≥16/32/64 mm/h, 1–3 h | beats DGMR and pySTEPS at all thresholds (USA MRMS + China) | | | https://www.nature.com/articles/s41586-023-06184-4 |
| NowPrecip-2 (MeteoSwiss, 2026) | ensemble scores, 3.5 yr | "consistently outperforms PySTEPS"; beats NWP ensemble up to 4 h | | | DOI 10.1002/qj.70181 |
| MetNet-3 (Google) | CSI ≥1 mm/h vs HRRR/ENS to 24 h | operational in Google Search, 1 km / 2 min; weights not released | | | https://arxiv.org/abs/2306.06079 |

**Placement of GROM** (CSI 0.53 for "dry now → rain within 60 min" at ≥0.1 mm/h; timeline CSI 0.58 at +30 vs 0.53 persistence, 0.55 at +60 vs 0.43): plausible for an extrapolation scheme on stratiform days, and the +60 min gain over persistence (+12 points) matches the rainymotion/RADVOR gap (+16–18 points at 1 mm/h). Three caveats keep it from being comparable: (a) 0.1 mm/h is a lenient threshold, published work reports 1 mm/h and up; (b) two stratiform days is far below the 11-event or 1,533-event samples; (c) Imhoff et al. show summer convection has ~3× the error of winter stratiform rain and decorrelation times of 25–40 min, so the +60 min advantage will shrink to a few points on storm days, which is GROM's whole use case.

**Verdict:** good enough to ship for "rain arriving" on frontal days; not yet evidenced for thunderstorms; nothing published supports extrapolation-only skill beyond ~90–120 min for convection. Not "good enough" to market as a storm nowcast until verified on at least 10 convective days at ≥1 mm/h.

## 2. Upgrade paths for a solo developer

**(a) pysteps worker** (BSD-3, https://github.com/pySTEPS/pysteps). Lucas–Kanade ~0.5 s and DARTS ~0.4 s on a 1226×760 grid on a 2010-era Xeon; Poland's 800×800 SRI grid is smaller. A €5 VPS (2 vCPU, 4 GB) runs LK + deterministic extrapolation + S-PROG every 5 min comfortably; a 20-member STEPS ensemble at 1 km takes minutes per run and more RAM, so run STEPS at 2 km or 10 members, or use a €15–25 box. Expected gain: S-PROG gives ~+20 % CSI at 2 h vs plain advection; the ensemble gives calibrated "chance" instead of a heuristic ladder. Importers exist for ODIM HDF5; IMGW's .sri.h5 is ODIM, so wiring is small.

**(b) rainymotion** (MIT): 6–12 s per 1 h nowcast on an i7; Imhoff found pysteps beats it. Only a lighter fallback.

**(c) Open ML nowcasts**: DGMR snapshots CC BY 4.0 (https://github.com/google-deepmind/deepmind-research/tree/master/nowcasting), trained on UK radar; NowcastNet code + weights on Code Ocean (DOI 10.24433/CO.0832447.v1), trained on MRMS/China; LDCast (MeteoSwiss, Apache-2.0, https://github.com/MeteoSwiss/ldcast) trained on Swiss radar, GPU recommended; Earthformer (Apache-2.0, SEVIR weights). None is trained on Polish data; all need a GPU at 5-min cadence (a cloud T4 kept warm ≈ €250/month). Retraining on the IMGW archive is a multi-week project. Skill gain over pysteps at ≥1 mm/h is modest; the gain is at heavy rain and realism. Not a first step.

**(d) NWP blending for 1–6 h.** Best open source for Poland: DWD **ICON-EU** (≈6.5 km, hourly precipitation to +78 h, 8 runs/day, CC BY 4.0) at https://opendata.dwd.de. ICON-D2 (2.2 km) covers only western Poland (east edge ~20°E, **UNVERIFIED**; Warsaw likely outside). IMGW's own COSMO/ALARO: per DATA-PROBES.md, only on the hours-late product API; not usable live. ECMWF open data is 0.25°, 3-hourly; too coarse except as last resort. Open-Meteo: free tier non-commercial only; paid tiers exist, prices not on page (**UNVERIFIED**, roughly €29/€99/€499 per month from memory). Recommendation: pull ICON-EU GRIB from DWD and use pysteps' blending module (Imhoff et al. 2023, https://pysteps.readthedocs.io/en/stable/generated/pysteps.blending.steps.forecast.html), weighting NWP in from ~60 min and fully by ~3–4 h, which is what NowPrecip-2 verifies against.

## 3. "Is it a storm" without a lightning feed

Cheapest signal, already probed in the repo: IMGW **COMPO_CMAX_250** (column-max dBZ, 1 km, 5 min, downloads OK) and **COMPO_ZHAIL** (hail probability, downloads OK); COMPO_EHT and PERUN points are 307-gated. Practical convective flag: CMAX ≥40 dBZ core with ≥10 mm/h in SRI, or ZHAIL > 0 anywhere in the cell, plus cell size and shape from the existing tracker. Blitzortung forbids storm-warning use. EUMETSAT MTG Lightning Imager near-real-time access for a private app: **UNVERIFIED**.

## 4. What people pay for

RainViewer's own paywall (https://www.rainviewer.com/): free = 30-min nowcast; Essential = 120-min radar nowcast, 48 h playback, 72 h forecast, ad-free, faster updates; Pro adds raw per-station radar. The market's number one paid lever is "future radar frames beyond 30 min". RevenueCat 2025: 82 % of trials start the day of install; yearly plans retain ~44 % vs 17 % monthly; utility apps skew annual. Takeaway: sell (1) a 90 → 120/180 min timeline with NWP blend, (2) multi-location + widgets, (3) storm/hail alerts from CMAX/ZHAIL, (4) ad-free, on an annual plan shown at first launch.

## 5. Europe radar data (2026)

| Country | Radar open? | Licence | Res / cadence | Notes |
|---|---|---|---|---|
| Poland | Yes (IMGW datastore, no auth) | open-data act + regulamin | 1 km / 5 min | SRI, CMAX, ZHAIL OK; EHT, RTR, PERUN gated |
| Germany | Yes, opendata.dwd.de/weather/radar (RV every 5 min, RADOLAN, RADVOR to +2 h) | CC BY 4.0 | 1 km / 5 min | Best open set in Europe |
| Czechia | Yes, https://opendata.chmi.cz/meteorology/weather/radar/composite/ (maxz, pseudocappi2km, echotop, merge1h, fct_maxz forecast) | CC BY 4.0 (**UNVERIFIED** on page) | 1 km / 5 min | Includes ČHMÚ's own forecast composite |
| Slovakia | **UNVERIFIED** (cert error) | | | Likely via OPERA only |
| Austria | INCA nowcast 1 km / 15 min open on data.hub.geosphere.at; radar composite not seen | CC BY 4.0 | 1 km / 15 min | Nowcast product itself is open |
| Switzerland | Partly: precipitation + CombiPrecip open; reflectivity "expected 2026" (https://opendatadocs.meteoswiss.ch/d-radar-data) | open (BY) | 1 km / 5 min | |
| Netherlands | Yes, KNMI Data Platform, free keys | CC BY 4.0 (**UNVERIFIED**) | 1 km / 5 min | 2 h radar_forecast product (**UNVERIFIED**) |
| Belgium, Denmark, Ireland, France, Spain, Italy | **UNVERIFIED** (portals JS-only, 404 or timed out) | | | |
| Norway | Images only (PNG/GIF, 5 min) via api.met.no | CC BY 4.0 / NLOD | image | raw data on thredds **UNVERIFIED** |
| Sweden | Yes, composite H5/PNG/TIF every 5 min | CC BY 4.0 (**UNVERIFIED**) | ~2 km / 5 min | archive since 2008 |
| Finland | Yes, composite GeoTIFF via WMS/WFS, ~5 min | CC BY | | quotas 20k/day |
| UK | Paid DataHub: free 1 GB/month, £15/10 GB … £690/600 GB | DataHub terms | | radar redistribution **UNVERIFIED** |
| Hungary | odp.met.hu composite netCDF, cadence unclear | not stated | | portal "under development" |
| Romania, Ukraine, Lithuania | No open radar found | | | |
| Pan-EU OPERA | CIRRUS max-reflectivity 1 km / 5 min (since 2024), NIMBUS rain rate; ODYSSEY off Oct 2024 | CC BY 4.0 via MeteoGate ORD API (key) | 1 km / 5 min | per-country redistribution exclusions **UNVERIFIED** |
| Warnings | MeteoAlarm Atom + api.meteoalarm.org, 38 services | CC BY 4.0 | | RSS deprecated 14 Jan 2026 |

## 6. Competition in Europe (**UNVERIFIED**, general knowledge)

Strong incumbents: NL (Buienalarm, Buienradar), DE (RegenRadar, DWD WarnWetter, RainToday), CH (MeteoSwiss), Nordics (Yr, 90-min nowcast), UK (Met Office, RainToday), AT (GeoSphere, wetter.at), HU (Időkép, dominant), CZ (Meteoradar.cz, ČHMÚ app, and Windy is Czech). Thin: SK, RO, Baltics, UA, but those have no open radar, which is the binding constraint.

## 7. Verdict, roadmap, markets

**(a) Verdict.** The shipped model is a fair extrapolation nowcast on stratiform days, roughly where rainymotion/RADVOR sit versus persistence. It is verified at a lenient threshold on two days and has no evidence for convection, which is the product's promise.

**(b) Roadmap.**
- Step 1 (weeks, €0): keep the TS engine; add the CMAX/ZHAIL convective flag; extend the hindcast to ≥1 mm/h and convective days; add growth/decay from the SRI trend. Expected: honesty, small CSI gain.
- Step 2 (1–2 months, €5–25/month VPS): Python pysteps worker with LK + S-PROG + a 10–20-member STEPS ensemble at 1–2 km. Expected: ~+20 % CSI at 2 h and calibrated probabilities.
- Step 3 (2–3 months, same VPS plus GRIB storage): ICON-EU blending via pysteps out to 6 h. NowPrecip-2 shows this class beats NWP to 4 h.
- ML (LDCast/NowcastNet retrain) only after that, with a ~€250/month GPU budget.

**(c) Poland first.** Second markets by openness × incumbents × language: 1) Czechia (CC BY radar including a forecast composite, Slavic UI; Windy and Meteoradar present); 2) Germany + Austria (best data, INCA nowcast open, large paying market; saturated, so only with a differentiated storm/hail alert); 3) Sweden/Finland (open 5-min data, weak paid-nowcast competition, small). Skip Hungary (Időkép), Baltics/Romania/Ukraine (no data) and the UK (paid data).
