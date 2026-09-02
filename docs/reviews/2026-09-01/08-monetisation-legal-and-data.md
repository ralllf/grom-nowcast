# Monetisation: legal set-up in Poland and commercial data terms

Researched 2026-09-02. This is a research summary, not legal advice; confirm with a Polish accountant and, for the IMGW question, get IMGW's answer in writing. Items marked **[unverified]** could not be confirmed from a primary source.

## Part A — Legal and tax set-up for a subscription or ad model

### 1. Business form

- **Działalność nierejestrowana 2026**: the limit is now **quarterly**: 225 % of the minimum wage = **10,813.50 PLN per quarter** (minimum wage 4,806 PLN). Not available if you had a JDG in the last 60 months. Register in CEIDG **within 7 days** of exceeding it. [biznes.gov.pl](https://www.biznes.gov.pl/pl/portal/00115) · [infakt](https://www.infakt.pl/blog/dzialalnosc-nierejestrowana-nowe-zasady-limitu-w-2026-r/)
- "Przychód należny" means amounts due, not cash received. Consumer law applies to you in full even under nierejestrowana. [prawo.pl](https://www.prawo.pl/biznes/dzialalnosc-nierejestrowa-jakie-sa-limity-i-obowiazki,531984.html)
- **Store sales**: you make a B2B supply to Apple Distribution International / Google Ireland. Whether the limit counts the gross sale or the net payout is **disputed** among Polish accountants; count gross to be safe. [ifirma](https://www.ifirma.pl/blog/sprzedaz-w-google-play-jak-rozliczyc-sprzedaz-aplikacji-mobilnych/) **AdMob/AdSense income** counts as revenue of the activity.
- **Trap even under nierejestrowana**: buying Supabase, Fly.io, Firebase or Google services from abroad is an "import usług". You must register **VAT-UE** and pay 23 % VAT on those invoices via **VAT-9M** even while VAT-exempt. [ifirma](https://www.ifirma.pl/blog/czy-rozliczac-import-uslug-z-faktur-od-facebooka-i-google-majac-dzialalnosc-nierejestrowana/)
- **JDG + ZUS 2026**: ulga na start = 6 months with only the health contribution (min. **432.54 PLN/mo**); then preferential ZUS **456.18 PLN/mo** social (24 months) + health; full ZUS social **1,926.76 PLN/mo** + health. [poradnikprzedsiebiorcy](https://poradnikprzedsiebiorcy.pl/-wskazniki-preferencyjne-skladki-zus)

### 2. VAT

- **Store subscriptions**: Apple and Google are merchant of record in the EU; they collect and remit consumer VAT. You issue a reverse-charge B2B invoice, need VAT-UE registration and file VAT-UE summaries; no consumer VAT on your side. [Apple tax docs](https://developer.apple.com/help/app-store-connect/manage-tax-information/manage-invoices-and-other-tax-documents/) · [podatkiprogramisty](https://podatkiprogramisty.pl/sprzedaz-aplikacji-w-app-store-jak-rozliczyc-przychod-i-vat/)
- **Web subscriptions**: Paddle or Lemon Squeezy as merchant of record = same model as Apple, about 5 % + $0.50 per transaction. **Stripe direct** makes you the seller of B2C electronic services; place of supply is the customer's country. Under the €10k EU-wide cross-border threshold Polish rules apply; above it you need **OSS** or the **EU SME scheme** (EX number, EU turnover < €100k). [accreo](https://accreo.pl/procedura-sme-czyli-zwolnienie-z-vat-dla-malych-przedsiebiorcow-w-ue/)
- Polish subjective VAT exemption limit is **240,000 PLN from 1 Jan 2026**. [poradnikprzedsiebiorcy](https://poradnikprzedsiebiorcy.pl/-limit-zwolnienia-podmiotowego-w-vat)

### 3. Consumer law (ustawa o prawach konsumenta, post-2023)

- A recurring alert subscription is a **usługa cyfrowa** (digital service), not one-off digital content. The consumer keeps the 14-day withdrawal right; if they asked for immediate start they pay pro rata for days used (art. 35). The full waiver (art. 38 pkt 13) applies only to one-off digital content. [legalniewsieci](https://www.legalniewsieci.pl/aktualnosci/tresci-cyfrowe--kiedy-klient-moze-odstapic-od-umowy) For IAP, Apple/Google handle refunds on the purchase; your regulamin still governs the service.
- **Auto-renewal**: no dedicated Polish statute yet. Art. 385³ pkt 18 KC treats renewal without a fair chance to object as abusive; UOKiK's position is that cancellation must be as easy as sign-up (T-Mobile decision, autumn 2025). [UOKiK](https://uokik.gov.pl/rekompensaty-za-subskrypcje-realizowane-tylnymi-drzwiami-decyzja-prezesa-uokik-wobec-t-mobile) EU **Digital Fairness Act** draft expected Q3 2026, not law yet. Practical: renewal reminder before charging, one-click cancel in-app, e-mail confirmation of termination.
- **Price change**: notify in advance and give a free termination right; unilateral change without cause is abusive (art. 385³ pkt 10, 20).
- **Omnibus**: any advertised discount must show the lowest price from the previous 30 days.
- **Mandatory info** (art. 5 and 8 UŚUDE; art. 12 UPK; art. 20 Prawo przedsiębiorców): name, address, e-mail, NIP, regulamin with complaints procedure, withdrawal form, price incl. VAT, subscription duration and how to cancel. Your home address becomes public unless you use a virtual office.

### 4. App store rules

- **Apple worldwide**: subscriptions must use IAP (Guideline 3.1.1); 30 %, or **15 % under the Small Business Program** (< $1M) and for subscriptions after year one. [SBP](https://developer.apple.com/app-store/small-business-program/)
- **Apple EU from 1 Oct 2026** (DMA settlement, Aug 2026): IAP 26 % (15 % SBP), alternative in-app payments 20 % (10 %), link-out to web 15 % (10 %), alternative distribution 5 % Core Technology Commission. [Apple newsroom](https://www.apple.com/newsroom/2026/08/apple-announces-changes-for-apps-in-the-european-union/)
- **Google Play, EEA from 30 Jun 2026**: 10 % service fee on subscriptions + 5 % billing fee with Play Billing (15 % effective); alternative billing or external web links carry no billing fee. [Android blog](https://android-developers.googleblog.com/2026/06/play-expanded-billing.html)
- **DSA trader status**: once you charge money you are a trader on both stores; verified **name, address, phone and e-mail are shown publicly** on the EU listing. [Apple](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)

### 5. GDPR / ePrivacy

- **Pins and push tokens** are personal data. Legal basis: art. 6(1)(b) (the service the user asked for), not consent. Keep precision minimal, allow deletion, state retention.
- **Privacy policy** must list: controller identity, purposes and bases, processors (Supabase, Fly.io, Firebase/FCM, APNs, ad networks), transfers, retention, rights, UODO complaint route. No UODO registration exists.
- **DPAs and transfers**: Supabase DPA uses SCCs, pick an EU region; Google LLC (Firebase) is DPF-certified (DPF upheld by the General Court Sep 2025, appeal pending, keep SCC fallback wording); Fly.io provides a DPA on request.
- **DPIA**: location data is on UODO's list; a DPIA is required when two criteria coincide. At GROM's scale probably not mandatory, but write a short documented assessment. [UODO list](https://archiwum.uodo.gov.pl/424)
- **Ads**: since 16 Jan 2024 AdMob/AdSense require a **Google-certified CMP on IAB TCF 2.2** for EEA personalised ads; Google's free UMP SDK qualifies. [Google](https://support.google.com/admob/answer/13554020?hl=en) Non-personalised ads still set identifiers, so consent under **art. 399 PKE** (in force since 10 Nov 2024) is needed anyway.

### 6. Ads specifics

- Weather apps are fine under AdMob policy; avoid ads that overlap the map (accidental clicks) and never put ads in notifications. [AdMob policies](https://support.google.com/admob/answer/2753860?hl=en)
- **PWA**: AdSense works in a browser-installed PWA; it is blocked inside store-wrapped WebViews (AdMob is for native builds only).
- **eCPM Poland**: no reliable public 2026 figures. Rough benchmarks: banners $0.2–0.8, interstitials $1–3, rewarded $4–10; one aggregator lists a blended AdMob CPM of ~$0.61 for Poland **[unverified]**. A storm app has spiky seasonal traffic, so ad income will be small and uneven.
- "Ad-free" upsell is allowed but must be sold via IAP on iOS and Play.

### 7. Liability

- You **cannot** exclude liability toward consumers for personal injury or for non-performance (art. 385³ pkt 1–2 KC), nor for intentional fault (art. 473 §2 KC); such clauses are void and land in the UOKiK register. What works: define the service honestly ("estimate from radar extrapolation, not an official warning, may be late or missed"), require users to follow official warnings, cap to the fee paid for ordinary negligence. Digital-service conformity liability (art. 43h ff. UPK) still applies.
- **Official warnings**: Alert RCB is statutory (art. 21a ustawy o zarządzaniu kryzysowym). No rule banning private storm warnings was found **[unverified negative]**. Do not use "RCB" or "Alert RCB" naming or look-alike styling; show IMGW warnings verbatim with source.

### 8. Checklists

**A. Free + ads only**
1. Start under nierejestrowana; register VAT-UE, file VAT-9M for foreign SaaS.
2. Publish privacy policy + regulamin + imprint.
3. Integrate Google UMP (certified CMP), Consent Mode v2, non-personalised fallback.
4. AdSense on web/PWA; AdMob only in native builds.
5. Sign DPAs (Supabase, Fly.io, Google), record a mini-DPIA.
6. Remove RainViewer; add IMGW attribution. Note: the IMGW regulamin (§2 pkt 3) explicitly counts an ad-supported site as business use, so the HVD question applies to ads too.
Cost: 0–400 PLN one-off; UMP free; accountant optional (150–350 PLN/mo).

**B. Subscription only**
1. Decide channel: store IAP (RevenueCat free < $2.5k/mo) or web via Paddle/Lemon Squeezy. Avoid Stripe-direct until revenue justifies OSS.
2. Apple Developer $99/yr; Google Play $25; enrol Small Business Program; complete DSA trader info.
3. Regulamin: subscription term, renewal reminder, one-click cancel, price-change notice, withdrawal rules (pro rata), complaints.
4. Move to JDG when quarterly revenue nears 10.8k PLN; ulga na start then preferential ZUS.
Cost: ~500 PLN/yr store fees; accountant 150–350 PLN/mo; ZUS 0 → 456 → ~1,930 PLN/mo social + ≥432 PLN health.

**C. Both**: do A + B; sell "ad-free" only via IAP in native apps; keep ads out of push and map hit areas.

## Part B — Which radars and data you can use, free or paid

### 1. IMGW-PIB in practice

- **No public price list for radar or real-time data.** The regulamin §10 says fees cannot be set in advance, depend on scope and preparation labour, and are capped at direct costs. For real-time system access (§8 ust. 2) IMGW may additionally charge for adapting its IT system, and no objection is possible against such an offer (§9 ust. 4). [Regulamin PDF](https://danepubliczne.imgw.pl/docs/regulamin_udostepniania_danych.pdf)
- **Process**: wniosek o ponowne wykorzystanie (form on [bip.imgw.pl](https://bip.imgw.pl/ponowne-wykorzystanie-danych/)) by post or e-mail **biznes@imgw.pl**; decision within 14 days, max 2 months; you get an "oferta" with 14 days to accept or object; refusal is an administrative decision appealable to the minister for informatyzacja. The wniosek must state commercial vs non-commercial purpose and name the product.
- **Key clauses**: free for private use; **HVD free "w każdym celu"**; other business use requires a signed umowa. §2 pkt 3 counts ad-supported websites as business use. §5 ust. 6: using free data for business purposes "stanowi oszustwo" (art. 286 KK). Attribution mandatory: "Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy", plus "Dane ... zostały przetworzone" if processed.
- **Which IMGW datasets are HVD**: IMGW publishes no list. EU Reg. 2023/138, Meteorological annex, names five datasets: station observations, validated climate data, **weather warnings, radar data, NWP model data**, to be free, via API, CC BY 4.0 or less restrictive. [EUR-Lex](https://eur-lex.europa.eu/eli/reg_impl/2023/138/oj/eng) On dane.gov.pl IMGW's NWP dataset is flagged HVD with CC0 1.0 and the datastore names products "COSMO HVD". Radar POLCOMP and PERUN carry **no HVD or CC marking**. So radar and warnings are HVD **by regulation** but IMGW has not labelled them; that is the lever to use in the wniosek. **[unverified: whether IMGW concedes this without a dispute]**
- **Ustawa o otwartych danych (2021)**: free by default; fees only for additional preparation costs, capped at direct costs; HVD must be free, machine-readable, via API. [ISAP](https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20210001641)
- **Lightning is not an HVD category**, so PERUN needs a paid umowa for a commercial app. No reseller or price found.

### 2. Alternative radar sources over Poland

| Source | Product | Res / cadence / latency | Licence | Cost | Notes |
|---|---|---|---|---|---|
| **OPERA via MeteoGate ORD API** ([docs](https://eumetnet.github.io/openradardata-documentation/1-ORD-API-overview/)) | ODYSSEY (max dBZ, rain rate, 1 h acc.) and CIRRUS max dBZ | ODYSSEY 2 km / 15 min; CIRRUS 1 km / 5 min; issued ~15 min after data time; ODIM HDF5 + COG | CC BY 4.0 for composites "with exceptions noted in metadata" | Free; API key at MeteoGate developer portal | **Polish radars' inclusion in the redistributable composite is not stated [unverified]**; check `OPERA_RADARS.csv` and composite metadata for "pl" sites first |
| **DWD RV / RY** ([geoportal](https://dwd-geoportal.de/products/RADAR_RV/)) | RV 5-min precip + 2 h nowcast | 1 km / 5 min | CC BY 4.0 | Free | Western wedge of Poland only |
| **ČHMÚ open data** ([licence](https://www.chmi.cz/-/jak-mohu-pou%C5%BE%C3%ADvat-otev%C5%99en%C3%A1-data-%C4%8Dhm%C3%BA-), [radar spec](https://opendata.chmi.cz/meteorology/weather/radar/radar_popis_cz.pdf)) | MAX_Z, PseudoCAPPI, MERGE, ECHO_TOP, FCT_MAX_Z nowcast | 1 km, 5 min; bbox to 19.6°E / 51.5°N | CC BY 4.0 | Free | Southern strip of Poland (Silesia, Lesser Poland) |
| **SHMÚ open data** ([opendata.shmu.sk](https://opendata.shmu.sk/)) | Merged max-reflectivity composite | 5 min | CC BY 4.0 | Free | Released 30 Jun 2025; southern border only |
| **RainViewer public API** ([api.html](https://www.rainviewer.com/api.html)) | Radar tiles | 10 min | Personal and educational only | Free; commercial case by case, no price | Not usable in a paid or ad-supported app without a contract |
| **Rainbow.ai Tiles API** ([developer.rainbow.ai](https://developer.rainbow.ai/)) | Nowcast tiles, 10 min | global | Attribution "Powered by Rainbow.ai"; commercial allowed | **$0.20 per 1,000 tiles, 30,000 free/month** | Overlay only; source for Poland unclear **[unverified]** |
| **Meteoblue Maps API** ([pricing](https://business.meteoblue.com/pricing)) | Radar composite + 2 h nowcast tiles | 15 min | Commercial | Maps Tile API base **€2,400/yr** | Overlay only |
| **Vaisala Xweather** ([pay-as-you-go](https://www.xweather.com/pricing/weather-api-pay-as-you-go)) | Radar tiles, MapsGL, lightning, 65 endpoints | 5–6 min | Commercial | 15,000 accesses/month free, "full access to every endpoint"; **€300/month for 1 M accesses** | Card billing US/CA only, others contact sales; free tier in a paid production app **[unverified]** |
| **Tomorrow.io** | Maps tiles incl. radar-derived precip | 5–10 min | Free plan for testing/small use | 500 calls/day free; paid via sales | Radar source for Poland unclear |
| **OpenWeatherMap** | Global Precipitation Map (radar + satellite blend) | 10 min | Free tier allows commercial use with attribution | Radar-ish layer only on Expert or above; prices behind 403 **[unverified]** | Not pure radar |
| **Weatherbit** | Maps tiles (precip) | 15 min | Free = non-commercial | Maps only in paid tiers | Model/satellite blend, not radar |
| **Windy API** ([pricing](https://api.windy.com/map-forecast/pricing)) | Map Forecast, Point Forecast | | Free tier development only | €990/yr each | **No radar overlay in the API** |
| **Meteomatics** ([pricing](https://www.meteomatics.com/en/pricing/)) | Radar + lightning imagery for Europe | | Commercial | Quote only; 14-day trial | No published price |

### 3. Lightning pricing

- **Xweather**: lightning endpoint included in the free 15k-access tier; standard = past 5 min, 100 km radius, 1,000 strikes/query; enterprise add-on for 24 h / 500 km / archive. [docs](https://www.xweather.com/docs/weather-api/endpoints/lightning)
- **nowcast.de LINET**: Europe, ~100 m accuracy; price on request.
- **Earth Networks / AEM Sferic API**: all tiers "contact us".
- **Meteomatics**: bundled, quote only.
- **IMGW PERUN commercially**: no price found; same wniosek route via biznes@imgw.pl. Not HVD, so a paid umowa is required.
- **Blitzortung**: forbids storm-warning use (see 04-data-licensing.md).

### 4. Official warnings

- IMGW warnings are "weather warnings" in the 2023/138 annex, hence HVD and free for any purpose. The live warningsmeteo API carries no explicit CC marking **[unverified as HVD-labelled]**.
- **MeteoAlarm** ([T&C](https://meteoalarm.org/en/page/terms-and-conditions)): redistributable under terms equivalent to CC BY 4.0, commercial included; if modified, the unmodified version must be shown alongside; operational redistribution must be real-time: delay on average under 5 minutes and never over 10.

### 5. Basemap and geocoding

| Provider | Terms | Cost |
|---|---|---|
| [OpenFreeMap](https://openfreemap.org/) | Commercial OK, no limits, no SLA, attribution required | Free |
| [Protomaps self-host](https://docs.protomaps.com/deploy/cloudflare) | Own PMTiles on Cloudflare R2 + Worker | ~$5/mo; real reports $2–3/mo |
| [MapTiler Cloud](https://www.maptiler.com/cloud/pricing/) | Free = non-commercial; Flex = commercial | Free 100k req; **Flex $30/mo** |
| [Stadia Maps](https://stadiamaps.com/pricing/) | Free tier non-commercial | Starter **$20/mo** |
| [Geoapify](https://www.geoapify.com/pricing/) | **Free tier allows commercial use** with attribution; caching allowed | 3,000 credits/day free; $59/mo next tier |
| [LocationIQ](https://locationiq.com/pricing) | Free tier commercial OK with prominent attribution link | 5,000 req/day free; $45–100/mo paid |
| Photon self-host | Open source; Poland extract on a small VPS ~€5–10/mo **[unverified estimate]** | |
| Nominatim public | Forbids heavy/commercial apps; dev only | |

**ODbL attribution**: "© OpenStreetMap" plus link to openstreetmap.org/copyright, visible on the map; identical for paid apps. [OSMF guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)

### 6. Summary

| Source | Gives | Free / cost | Commercial OK? | Fit | Risk |
|---|---|---|---|---|---|
| IMGW POLCOMP via datastore | 1 km PL composite | Free if HVD; else umowa, price on request | Only as HVD or with umowa | Analysis core | IMGW may dispute; fraud clause |
| IMGW warningsmeteo | Official PL warnings | Free | Yes (HVD) | Warnings | Low |
| IMGW PERUN | Lightning GIFs | Umowa | No without contract | Lightning | High for paid app |
| OPERA ORD (MeteoGate) | 1–2 km EU composite, ~15 min latency | Free | Yes | Fallback analysis + overlay | PL radars in composite unverified; latency |
| DWD RV | 1 km, 5 min + nowcast | Free | Yes | West-PL fallback | Partial coverage |
| ČHMÚ, SHMÚ | 1 km, 5 min | Free | Yes | South-PL fallback | Partial coverage |
| Rainbow.ai tiles | Nowcast tiles | $0.20/1k, 30k free | Yes | Overlay | Source opacity |
| Xweather | Radar tiles, lightning | 15k free; €300/mo 1 M | Yes (free-tier production use unverified) | Lightning + overlay | EU billing via sales |
| Meteoblue | Radar tiles | €2,400/yr | Yes | Overlay | Cost |
| RainViewer | Radar tiles | Free | **No** | Dev fallback only | Termination |
| MeteoAlarm | EU warnings CAP | Free | Yes, ≤10 min delay | Warnings | SLA obligation |
| OpenFreeMap / Protomaps | Vector basemap | Free / ~$5 | Yes | Basemap | No SLA |
| Geoapify / LocationIQ | Geocoding | Free tiers | Yes | Geocoding | Rate limits |

**Cheapest fully legal paid-app stack**: IMGW POLCOMP + warningsmeteo under the HVD clause, with a written wniosek to biznes@imgw.pl asking IMGW to confirm radar and warnings as HVD and to grant real-time datastore access (§8 ust. 2); OPERA ORD as automatic fallback and hindcast source; MeteoAlarm CAP for cross-border warnings; Xweather free tier for lightning (replacing PERUN); OpenFreeMap now, Protomaps on R2 later; Geoapify or LocationIQ free tier for geocoding with attribution. Cash cost ≈ $0–10/month plus attribution text.

**If IMGW says no**: OPERA CIRRUS 1 km / 5 min from MeteoGate as the analysis field (accept ~15 min latency), patched with DWD RV in the west and ČHMÚ/SHMÚ in the south; Rainbow.ai or Xweather tiles for the overlay; Xweather lightning; MeteoAlarm warnings (IMGW's own warnings stay HVD regardless). Budget ≈ Xweather €300/mo once past 1 M accesses, otherwise still near zero. Verify first that Polish radars are present in the CC BY OPERA composite metadata.
