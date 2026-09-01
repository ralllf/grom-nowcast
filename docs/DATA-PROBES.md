# Data-source probes (2026-09-01)

Researcher slice. Question: **does any live feed beat what GROM already has** (COMPO_SRI mm/h + own advection + 4-class overlay + RainViewer fallback + `warningsmeteo` + PERUN client that 307s)? This is not a product ranking and does not change nowcast math.

**Window:** 2026-09-01 **17:13–17:24 CEST** (15:13–15:24 UTC). Host `danepubliczne.imgw.pl`, unauthenticated, `User-Agent: GROM-nowcast-research/1.0`. Listing = `POST /pl/datastore/getFilesList`. File = `GET /pl/datastore/getfiledown/…` with `redirect: manual` unless noted. Filename clocks treated as UTC (matches ODIM `/what` on the H5s).

License for every IMGW datastore/API row: [ustawa o otwartych danych](https://bip.imgw.pl/ponowne-wykorzystanie-danych/) + [regulamin](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf). Auth: none. Tech bounce → `reklamacje@imgw.pl`. Reuse wniosek → `biznes@imgw.pl`. Buying Météorage is out unless a live probe shows it beats PERUN/SRI — none did.

---

## Verdict table

| Verdict | Source | License / auth | Live GET/POST (this window) | Cadence | Resolution | vs current SRI + advection | Blocker |
|---|---|---|---|---|---|---|---|
| **keep** | IMGW `COMPO_SRI.comp.sri` `.sri.h5` | Open data, no auth | **17:22 CEST:** `POST` listing **200** `text/html` (2616+ files). Newest `2026090115200000dBR.sri.h5` → **GET 200** `application` 86 799 B, age **2.2 min**. Earlier **17:15 CEST** newest `…15100000…sri.h5` **200** 86 330 B, age **6.5 min**. H5: `quantity=RATE`, `gain=1`, 800×800, `xscale` 1163.64 m / `yscale` 1153.65 m, aeqd `+lon_0=19.0926 +lat_0=52.3469`, phys 0.01–55 mm/h, 10 POLRAD nodes. | 5 min (stamps :00/:05/…); retencja ~3 d | ~1.16 km, 800×800 | Already the analysis. Fresh enough (2–7 min behind wall). Product API mirror of the same id is **not** this — see refuse. | — |
| **keep** | Own 4-class SRI PNG | Derived from the H5 above | Same decode as analysis. **17:15 CEST** sibling `…15100000…sri_echoOnly.png` **GET 200** `image/png` 50 118 B (IMGW paint — we do not use it). | 5 min | 800×800, 4 legend classes | Map = numbers. Not a new feed. | — |
| **keep** | RainViewer public tiles | Personal/educational + attribution. Official API page lists **past** tiles only ([api.html](https://www.rainviewer.com/api.html)). No auth. | **17:15 CEST** `GET https://api.rainviewer.com/public/weather-maps.json` **200** `application/json`: `radar.past.length=13`, **`radar.nowcast=[]`**, latest frame age **6.6 min**. **17:18 CEST** overlay tile `…/256/6/35/21/2/1_0.png` **200** `image/png` 2 126 B. Re-check **17:24 CEST**: `nowcast []`, `past` 13. | 10 min | z=6 stride 2 → ~3 km | Fallback only. Does **not** beat SRI (coarser, Marshall–Palmer, emptier nowcast). | — |
| **keep** | IMGW `warningsmeteo` | Open data, no auth | **17:18 and 17:22 CEST** `GET /api/data/warningsmeteo` **404** `application/json` 51 B `{"status":false,"message":"No products were found"}`. Same host, same minute: `synop` **200** 62 stations; `warningshydro` **200** 89 rows. Trailing slash and `/format/json` also 404. | event-driven | powiat TERYT | Official lane, already in. Today looks like an **empty product**, not a dead host. GROM already treats non-OK as “ostrzeżenia niedostępne”. | Empty-day 404 is a quirk, not a buy/email gate. Re-probe on an outbreak day. |
| **keep** | PERUN LTS2005 GIFs | Open data, no auth | **17:15 CEST** `POST` `/Oper/Perun/LTS2005` `productType=oper` **200**, 13 134 names. **17:18 CEST** `DISCH_20260901_151900.gif` **GET 200** `image/gif` 124 828 B, age **1.0 min**. | 1 min | GIF map, not points | Control that `getfiledown` works. GROM must not invent lat/lon from pixels. | — |
| **try** | IMGW `COMPO_CMAX_250.comp.cmax` `.cmax.h5` | Open data, no auth | **17:15 CEST** listing **200**, newest `2026090115100000dBZ.cmax.h5` + echoOnly PNG **GET 200** `image/png` 66 552 B, age **6.6 min**. **17:22 CEST** `2026090115200000dBZ.cmax.h5` **GET 200** `application` 69 938 B, age **2.3 min**. H5: `product=MAX`, `quantity=DBZH`, uint8 `gain≈0.502 offset≈−32`, 900×900, `xscale` 1007.53 m / `yscale` 994.96 m, **same aeqd origin as SRI**, phys −23…54 dBZ. Same 10 nodes, same 15:20 stamp as SRI. | 5 min | ~1.00 km, 900×900 (not the SRI 800×800) | Column-max dBZ. SRI is *surface rain*; CMAX sees elevated cores SRI can understate. Gates “Burza” / hail-aloft without a new backend (same `getFilesList` + `h5wasm` + inverse aeqd, different `xscale`). Does not replace SRI rates. | — |
| **try** | IMGW `COMPO_ZHAIL.comp.zhail` `.zhail.h5` | Open data, no auth | **17:15 CEST** listing **200**, echoOnly PNG **GET 200** `image/png` 8 866 B, age **6.6 min**. **17:22 CEST** `2026090115200000Prob.zhail.h5` **GET 200** `application` 16 679 B, age **2.5 min**. H5: `product=ZHAIL`, `quantity=PROB`, uint8 `gain≈0.395 offset≈−0.395`, 900×900 **same grid as CMAX**, phys ~2–45 %, **16 pixels > 0** on this quiet frame (product is live, not an empty field). Not in `/api/data/product` (**404**). | 5 min | ~1.00 km, 900×900 | Turns “możliwy grad” from ≥55 dBZ guess into IMGW’s hail-probability field. Same pipeline as SRI/CMAX. Best hail gain measured today. | — |
| **try** | IMGW `COMPO_CAPPI.comp.cappi` `.cappi.h5` | Open data, no auth | **17:18 CEST** listing **200**. **17:22 CEST** `2026090115200000dBZ.cappi.h5` **GET 200** `application` 59 420 B, age **2.6 min**. H5: `product=CAPPI`, `quantity=DBZH`, 900×900, same ~1.00 km grid as CMAX (lat0 52.3468 vs 52.3469). | 5 min | ~1.00 km, one height | Single-level dBZ. **Does not beat CMAX** for hail/Burza (CMAX is the column max). Only useful if CMAX is already decoded and a height slice is cheap. | — |
| **try** | IMGW `COMPO_EHT.comp.eht` | Open data, no auth | **17:15 CEST** listing **200**, 2616 names, newest `2026090115100000Height.eht.h5` / echoOnly PNG. **GET echoOnly 307** `text/html` `Location: /datastore` 0 B. **17:22 CEST** **GET** `…15200000Height.eht.h5` **307** same bounce. | 5 min (listing) | unknown (file gated) | Echo-top height would mark tall convective cells SRI mm/h cannot. Same tree as SRI — no new backend **if** the 307 lifts. | **307 on the whole EHT subtree.** Email `reklamacje@imgw.pl` (POLCOMP SRI/CMAX/ZHAIL 200 on the same host/scheme). |
| **try** | PERUN `PERUN_Polska` `.ld.csv` | Open data *listed*; download gated | **17:15 CEST** `POST` `/Oper/Perun/PERUN_Polska` `productType=oper` **200**, newest `2026.09.01.15.12.ld.csv` (age **4.6 min**). **GET** that CSV **307** 0 B `Location: /datastore`. `.ld` sibling **307**. **17:18 CEST** `redirect: follow` → **200** `text/html` 33 114 B (datastore homepage — not a CSV). | listing ~1 min | strike points (unseen) | Would make “Burza” a measurement (already parsed in-repo when a real CSV arrives). Does not change advection. | **307 / HTML bounce on point files.** Email `reklamacje@imgw.pl`. LTS2005 GIF + SRI H5 were 200 in the same minute — not a typo. |
| **try** | PERUN `1min_secondaire` | same | **17:15 CEST** listing **200**, newest `safir260901-151300.txt`. **GET 307**. **17:18 CEST** newest name `safir260901-151600.txt` (~2 min behind wall). | 1 min (listing) | point-ish (unseen) | Fresher than 5-min `PERUN_Polska` *if* ungated. Same “Burza” gate. | Same **307**. Same email. |
| **try** | PERUN `TLP/ld/{combined,lf_stroke,vhf_event}` | same | Listings **200**, only **daily** `2026.08.29–31.ld` (no 1 Sep file at 17:15). All three **GET 307**. | daily | points (unseen) | Too coarse for a 15-min layer. Same client if Polska is ungated. | **307** + stale daily files. |
| **refuse** | Blitzortung | Terms ([contact.php](https://www.blitzortung.org/en/contact.php), read 2026-09-01): private/entertainment; **“not allowed to use our lightning data for storm warning systems”**; raw feed for participants only. | Not fetched (license). | — | — | GROM is a storm-warning app. PERUN or nothing. | License. |
| **refuse** | Commercial RainViewer / paid nowcast | Public API is personal/educational. Official docs advertise *past* tiles. Third-party notes claim paid nowcast after 2026-01-01. **No commercial API to buy for GROM.** | Public `nowcast[]` empty (live, above). Paid feed not purchased — would not beat 5-min SRI + own advection on a live probe we can run. | — | — | Fallback tiles already kept. | Do not buy. |
| **refuse** | Météorage | Commercial. | No live GET (no key). Not measured as better than PERUN/ZHAIL. | — | — | Buying is out until a probe shows a beat. | No measurement. |
| **refuse** | `meteo.imgw.pl/api/radars/v1/…` | Undocumented, watermarked (`DATA.md`). | **17:15 CEST** `GET …/composite` **404**. | — | — | — | Undocumented. |
| **refuse** | `/api/data/product/id/COMPO_SRI.comp.sri` (and CMAX) | Open data, but **hours-late mirror**. | **17:15 CEST** SRI product API **200** 833 876 B. **17:18 CEST** newest name in body `2026090104250000dBR.sri_echoOnly.png` (**04:25 UTC / 06:25 CEST**) vs datastore `15:20 UTC` — **~11 h lag**. CMAX product API newest also `…04250000…`. ZHAIL/EHT product ids **404**. | stale | — | Loses to datastore listing by half a day. | Do not use for live. |
| **refuse** | POLCOMP `COMPO_DPSRI`, `COMPO_RTR`, `HSHEAR`, `VSHEAR`, `HWIND_120`, `PAC`, `Compo_Extended` | Open data listed | All **list 200** with fresh stamps (RTR 31 k files; HSHEAR newest `…15223000…` ~2.5 min). **Every GET 307** (PAC_1d H5 **303**). Empty live dirs: `COMPO_SRI_250`, `COMPO_MAX`, `COMPO_MAX_250`, `COMPO_CMAX_250_QCR`, `COMPO_ET_BMRC`. | — | — | Dual-pol SRI / IMGW RTR nowcast / shear could matter **if** 307 lifts — RTR would still be a nowcast-math change (out of this slice). PAC is accumulation, not 90-min ETA. | **307** (email only if EHT/PERUN email already open). Do not buy a workaround. |
| **refuse** | COSMO / synop / EUMETSAT | COSMO on product API; synop **200** hourly 62 stations (17:18 CEST). | Wrong horizon or new pipeline. | hours | station / km-scale | Nothing for 0–90 min pin ETA. | Out of scope. |

---

## Required probes (checklist)

| Probe | Result | Age vs now (CEST) |
|---|---|---|
| COMPO_SRI freshness vs wall | `2026090115200000dBR.sri.h5` **200**, ODIM time 15:20 UTC = **17:20 CEST**, fetched **17:22 CEST** | **2.2 min** (earlier file in the same hour was 6.5 min) |
| PERUN point-file GET | `…/PERUN_Polska/2026.09.01.15.12.ld.csv` **307** → `/datastore`; follow = HTML 33 kB | listing file age **4.6 min**; body is not a CSV |
| CMAX on the POLCOMP tree | `COMPO_CMAX_250.comp.cmax` (not `COMPO_CMAX.comp.cmax` — that dir is empty). H5 **200**, DBZH, 900×900 ~1 km | **2.3 min** |
| ZHAIL on the POLCOMP tree | `COMPO_ZHAIL.comp.zhail` H5 **200**, PROB, same 900×900 grid | **2.5 min** |
| Other POLRAD for hail/Burza, no new backend | **CAPPI 200** (weaker than CMAX). **EHT listed, 307**. DPSRI/RTR/shear **307**. | CMAX/ZHAIL/CAPPI share SRI’s 15:20 stamp |

`COMPO_CMAX.comp.cmax` without `_250` is a dead name. Live product is **`COMPO_CMAX_250`**.

---

## What actually beats SRI + advection

Measured today, free, same thin server:

1. **ZHAIL** — hail probability, not a dBZ threshold. 200.
2. **CMAX_250** — elevated reflectivity SRI (surface RATE) cannot see. 200. Different grid (900×900 / ~1 km) — resample, do not assume SRI indices.
3. **PERUN points** — only feed that makes “Burza” electrical. Listed, **307**. Email IMGW; do not substitute Blitzortung or buy Météorage off a brochure.

Nothing paid was live-better. RainViewer nowcast is still empty. IMGW RTR (their nowcast) lists but 307s — even if it opened, swapping advection is Analizor / nowcast math, not this slice.

---

## Method notes

- Parent `POST path=Oper/Polrad/Produkty/POLCOMP` **200** — folder names include SRI, CMAX_250, ZHAIL, EHT, PAC, CAPPI, DPSRI, RTR, HSHEAR, VSHEAR, HWIND, plus empty/test dirs.
- Listing HTML hrefs omit the slash after `getfiledown` (`getfiledownOper/…` → **404**). The working URL is `getfiledown/Oper/…` (same as production SRI/PERUN code).
- Product API `/api/data/product` is a **lagging catalog**, not the oper tree. Confirmed ~11 h behind datastore for SRI and CMAX.
- H5 decode: Python `h5py` on the bytes from the 200s above (`/tmp/{sri,cmax,zhail,cappi}.h5` — not committed).
