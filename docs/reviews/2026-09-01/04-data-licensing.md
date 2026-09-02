# Data sources and licensing

Researched 2026-09-01; live endpoints probed with curl where noted.

## 1. IMGW-PIB open data

**Terms.** The governing text is the "Regulamin udostępniania danych" at https://danepubliczne.imgw.pl/regulations (header "Wszelkie prawa zastrzeżone", no CC label). Key clauses:
- Free use is limited to private purposes, BUT: "Korzystający może używać nieodpłatnie udostępnionych danych do celów prywatnych, a w przypadku danych o wysokiej wartości w każdym celu."
- Use "dla potrzeb działalności gospodarczej" requires a signed agreement with cost recovery, "chyba że są to dane o wysokiej wartości".
- "Dane o wysokiej wartości" are defined by reference to Commission Implementing Regulation (EU) 2023/138.
- EU 2023/138 Annex, Meteorological category, lists observations, climate data, weather warnings, radar data and NWP as HVDs that must be offered under CC BY 4.0 or less restrictive, via API and bulk download; obligations apply since mid-2024 (https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32023R0138).
- Conclusion: POLCOMP composites, warnings and lightning are HVD categories, so commercial and app use is free by law and by the regulamin's own HVD carve-out. Caveat: IMGW has published no HVD dataset list, the operational datastore shows no CC BY label, and the regulamin says using free data for business purposes outside the HVD carve-out "constitutes fraud". **Get written confirmation from IMGW that COMPO_* and PERUN are treated as HVD before go-live.**

**Attribution (mandatory, verbatim):** "Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy", and because GROM processes the data: "Dane Instytutu Meteorologii i Gospodarki Wodnej – Państwowego Instytutu Badawczego zostały przetworzone".

**Rate limits / fair use.** None documented. Observed: after a burst of 4 rapid requests, danepubliczne.imgw.pl and meteo.imgw.pl refused TCP connections for about a minute, then recovered (unverified throttle). Home Assistant users report intermittent 403s and missing data (https://github.com/home-assistant/core/issues/133600).

**API vs scraping.** Documented API (https://danepubliczne.imgw.pl/pl/apiinfo) covers synop, hydro, meteo, warningsmeteo, warningshydro and a product list. `api/data/product` lists 42 file products including COMPO_SRI.comp.sri_h5, COMPO_CMAX_250, COMPO_PAC, COMPO_CAPPI, COMPO_EHT, but the per-product URL returns 404 "Product could not be found". So the getFilesList HTML scrape remains the only working radar path. `api/data/warningsmeteo` returns HTTP 404 `{"status":false,"message":"No products were found"}` when no warnings are active (verified). **The app must treat that 404 as "no warnings", not as an outage.**

**Paid/formal feed.** The regulamin provides for agreements (real-time direct access is applied for by wniosek). No price list is public. History: IMGW cut radar data to radareu.cz in 2013 and later refused daneradarowe.pl/wxradar.eu renewal citing "risk of destabilising critical services" (date unverified).

**PERUN.** The datastore folder Oper/Perun/PERUN_Polska lists per-minute `*.ld.csv` point files, but downloading any of them 307-redirects to the datastore landing page (verified), so only the GIFs are usable. No open lightning point data.

## 2. RainViewer (2026)

Since 2026-01-01: nowcast, satellite IR and all colour schemes except Universal Blue removed, max zoom 7, 100 req/IP/min (https://www.rainviewer.com/api/transition-faq.html). The API page states "The API is free for personal or educational use only"; commercial or production use is bespoke, case-by-case via support@rainviewer.com, no published prices; attribution required; no availability guarantee (https://www.rainviewer.com/api.html). A fallback in a public app is still production use, so it is not OK without a written agreement.

## 3. Lightning for Poland

- Blitzortung: data CC BY-SA 4.0 but "the project may not represent commercial interests", apps must serve from their own server, and "It is not allowed to use our lightning data for storm warning systems" (https://www.blitzortung.org/en/contact.php). Excluded for GROM alerts.
- IMGW PERUN: GIF only (see above).
- Vaisala Xweather: Developer tier 15,000 accesses/month free, then €300/month for 1M accesses; lightning endpoints exist, but whether they are in the free tier is not stated (https://www.xweather.com/pricing/weather-api-pay-as-you-go).
- Meteomatics: quote only, 2-week trial. nowcast.de LINET: quote only. Earth Networks ENTLN: "contact us".
- Realistic path: Xweather pay-as-you-go for strikes, with IMGW thunderstorm warnings as the free proxy and PERUN GIF for the visual layer.

## 4. Official warnings

- IMGW: `api/data/warningsmeteo` (danepubliczne) and `https://meteo.imgw.pl/api/meteo/messages/v1/osmet/latest/osmet-teryt` (keys `warnings`, `teryt`, `program{ExportTime, LastChange}`); updates are event-driven, cadence undocumented. Warnings are an HVD category, so redistribution is fine with attribution.
- MeteoAlarm: Poland Atom feed with CAP fields is live (https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-poland; API at https://api.meteoalarm.org/). Licence "equivalent to CC BY 4.0" plus extra rules: show the national service (IMGW-PIB) as source, include issue time, link to meteoalarm.org, and operational redistribution must average under 5 min delay, never over 10 min (https://meteoalarm.org/en/page/terms-and-conditions).
- Alert RCB: SMS only, no public feed, CAP or archive (https://www.gov.pl/web/rcb/alertrcb). Cell broadcast still not live; a reform was announced August 2026 with no date.
- RSO: open XML/JSON endpoints at komunikaty.tvp.pl (verified live, no auth: `/komunikatyxml/wszystkie/wszystkie/0?_format=xml`, with lat/lon, valid_from/to, provinces); CAP needs a token from the RSO administrator; page carries "© TVP Technologie" and no licence, so redistribution rights are unclear (https://komunikaty.tvp.pl/Info/Integration).

## 5. Basemap and geocoding

- OpenFreeMap: "no limits on the number of map views or requests", commercial use allowed, no SLA, donation-funded; attribution "OpenFreeMap © OpenMapTiles Data from OpenStreetMap"; self-hosting needs a dedicated server and ~300 GB (https://openfreemap.org/).
- Nominatim: max 1 req/s, identifying User-Agent, results must be cached, no autocomplete, and services whose primary function is geocoding must run their own instance; violations get banned (https://operations.osmfoundation.org/policies/nominatim/). A public app with search-as-you-type violates this.
- Alternatives: Photon public instance is a throttled demo; Geoapify 3,000 credits/day free; LocationIQ 5,000 req/day free; MapTiler 100k req/month free. OSM data needs "© OpenStreetMap contributors" (ODbL).

## 6. Nowcast quality upgrades from open sources

- IMGW datastore also has COMPO_CMAX_250 (reflectivity max), COMPO_PAC (1 h accumulation), COMPO_CAPPI and COMPO_EHT (echo top). SRI is rain rate at 1 km AGL; CMAX is better for cell tracking, SRI for "will it rain on me".
- OPERA: Open Radar Data API on MeteoGate went live May 2026, CC BY 4.0 (HVD), ODYSSEY composites every 15 min at ~15 min latency, CIRRUS 5 min (https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/). Useful for cross-border context and as a licensed fallback; coarser than POLCOMP.
- DWD: RV 5-min, 2 h nowcast on open data under CC BY 4.0 (https://opendata.dwd.de/weather/radar/composite/rv/). DE1200 grid covers a western wedge of Poland (roughly to Poznań in the north, to about Zielona Góra in the south). Good for validating GROM's extrapolation on the border.
- pysteps/rainymotion: no JS or WASM port found; the practical route is OpenCV.js (Farneback/DIS optical flow) in a worker.

## Risks before go-live (ranked)

1. **IMGW licence ambiguity (high).** Commercial use is only free under the HVD carve-out, radar files carry no licence label, and IMGW has a record of cutting off third parties. Obtain written confirmation and keep the exact attribution strings.
2. **Radar path is a scrape with no API (high).** getFilesList HTML can change without notice; the per-product API is dead. Add monitoring, staleness alerts and a legal fallback.
3. **RainViewer fallback is not licensed for production (high).** Sign a commercial deal or replace with OPERA/DWD composites.
4. **Nominatim in a public app (medium-high).** 1 req/s and no autocomplete; a ban would break search. Move to Geoapify/LocationIQ or a self-hosted Photon with a Poland extract.
5. **Lightning has no open source (medium).** Blitzortung forbids warning use; PERUN points are gated. Budget for Xweather or Meteomatics, or ship lightning as visual-only.
6. **Warnings semantics (medium).** warningsmeteo 404 means "none"; push logic must not treat it as failure. MeteoAlarm redistribution requires under 10 min delay, issue time and source display.
7. **IMGW availability (medium).** Undocumented throttling and sporadic 403s; PERUN listing works while downloads bounce.
8. **OpenFreeMap has no SLA (low-medium).** Fine for launch; plan a MapTiler or self-host fallback.
9. **RSO/RCB redistribution rights unclear (low).** RSO XML is open but unlicensed; RCB has no feed at all.

Unverifiable: IMGW throttling thresholds, date of the daneradarowe.pl refusal, whether Xweather's free tier includes lightning, RSO update cadence.
