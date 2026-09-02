# MeteoSwiss benchmark, reference apps, Polish competitors

Researched 2026-09-01. Facts that could not be verified are flagged inline.

## 1. MeteoSwiss app (v3.5.x, 2025–2026)

**Cost / platforms.** Free, no ads. Only paid item is an aviation-weather subscription ($46.99/yr). iOS 16+, iPadOS, macOS (Apple silicon), watchOS 10+ (a Watch app exists), Android. Version 3.5.6 (July 2025). https://apps.apple.com/us/app/meteoswiss/id589772015 · https://play.google.com/store/apps/details?id=ch.admin.meteoswiss

**Scale.** 4.8 M installs, 0.7–1.8 M daily users (developer Ubique). https://www.ubique.ch/stories/meteoswiss

**Nowcast / radar.** "Animations" section with playable precipitation, precipitation-type, wind, temperature, cloud and satellite animations (Meteosat Third Generation since 3.5.5). The precipitation animation shows precipitation type, hail reports and lightning measurements. Official page: https://www.meteoswiss.admin.ch/services-and-publications/service/weather-and-climate-products/meteoswiss-app.html. The exact in-app horizon (hours back/ahead) is NOT stated on official pages; the underlying INCA-CH nowcast runs up to 6 h ahead, 1 km grid, 5-min precipitation steps, refreshed every 5–10 min. https://opendatadocs.meteoswiss.ch/e-forecast-data/e1-short-term-forecast-data

**Location timeline.** "Weather on-site" gives a 5-hour forecast for the current location, plus 8-day forecasts for every Swiss place/postcode, with uncertainty bands for temperature and precipitation (since v2.0). Not verified: whether the app shows a minute-resolution "rain starts in X min" bar for a point.

**Lightning / hail.** Lightning measurements and hail reports drawn on the precipitation animation. Crowdsourcing: hail reports since 2015; lightning, wind, rain, snow, fog reports with photos since 2021, auto quality-checked. https://www.ubique.ch/stories/meteoswiss

**Warnings + push.** All federal natural-hazard warnings (severe weather/thunderstorm, wind, rain, snow, heat, frost, floods, avalanches, earthquakes, forest fire). Push is subscribed per favourite location and per warning type, with individual thresholds; default is level 3 and above, adjustable. Warnings can be shared (v3.5.5). Alertswiss integration. https://www.meteoschweiz.admin.ch/ueber-uns/meteoschweiz-blog/de/2023/07/so-koennen-sie-in-der-meteoswiss-app-die-pushmeldungen-fuer-warnungen-verwalten.html

**Precipitation nowcast push ("rain will start in X min").** Not found. Every official source only describes hazard-warning push. Treat as absent in MeteoSwiss; it is a differentiator for GROM.

**Favourites / GPS / widgets.** Ordered list of favourite locations; current location when location services are on; widgets for local forecast, measurement stations, precipitation animation and webcams (iOS widgets since v2.0, 2016–17). Apple Watch: app exists (watchOS 10+), complication details unverified. Dark mode and offline behaviour: not verified from official sources.

**Data model.** INCA-CH (deterministic, 6 h, being replaced 2027–28); NowPrecip (probabilistic radar-tracking nowcast, operational since 2020; NowPrecip 2 ensemble published 2026, https://rmets.onlinelibrary.wiley.com/doi/10.1002/qj.70171); CombiPrecip (hourly radar+gauge merge, https://www.meteoswiss.admin.ch/services-and-publications/service/weather-and-climate-products/combiprecip.html). New in summer 2026: a deep-learning thunderstorm-hazard model that scores heavy rain, hail and lightning probability for the next hour every 5 min from radar+lightning, feeding app warnings with longer lead time and fewer false alarms. https://www.watson.ch/schweiz/wetter/477559856-meteoschweiz-setzt-auf-ki-fuer-praezisere-gewittervorhersagen

## 2. Reference apps for minute-scale rain push

- **RainViewer** — Alerts per location by precipitation type and intensity (down to "Drizzle"), start/end, in-radius, daily cap (3/6/unlimited), "Mute for today"; national CAP warnings; 2-h nowcast updated every 10 min; up to 20 favourites; Live Activities on Lock Screen/Dynamic Island/Watch with "Outdated" label when data >15 min old; standalone Watch app with complications. Alerts and most extras are paid (tiers quoted from $2.99/mo to $39.99/yr, region-dependent). https://apps.apple.com/us/app/rainviewer-live-weather-radar/id980123924 · https://www.rainviewer.com/premium-features.html
- **Windy Live Alerts** — Free, mobile only, current GPS location only (not favourites). Storm alert: ≥2 strikes within 2.5 km in 15 min and storm <1 h away, 5–30 min heads-up. Heavy-rain alert: 1-h extrapolated radar with fixed dBZ threshold (not user-tunable), only where Windy has radar coverage. CAP official warnings and hurricanes for chosen places; separate "Forecast alerts" on model thresholds. https://community.windy.com/topic/40542/how-to-activate-your-live-storm-and-heavy-rain-alerts · https://www.windy.com/articles/43906
- **Meteoblue** — Push of official national warnings for a chosen location; rainSPOT (local precipitation map) and rainNOW (2 h in 15-min steps); Apple Watch; premium $6.99/yr. No radar-based rain-start push verified. https://www.meteoblue.com/en/blog/article/show/40172_meteoblue+Weather+Apps+now+send+warnings+via+push-notifications · https://apps.apple.com/us/app/meteoblue-weather-radar-maps/id994459137
- **Apple Weather (ex Dark Sky)** — Minute-by-minute next-hour chart, map and "rain starting in 2 min, stopping 12 min later" notifications, but only in US, UK, Ireland; Poland gets only severe-weather alerts. https://support.apple.com/en-us/102594 · https://www.idownloadblog.com/2021/10/05/apple-weather-precipitation-notifications-availability/
- **RegenRadar (WetterOnline)** — 90-min radar film past and future, favourites, widget, DE/AT/CH. https://play.google.com/store/apps/details?id=de.wetteronline.regenradar
- **RainToday (DTN/WeatherPro)** — Rain warnings up to 60 min ahead, push for current or a selected location, widget, DE+CH only. https://apps.apple.com/de/app/raintoday/id326461840
- **Rain Alarm (mdiener)** — Radar-proximity alerts with user radius and intensity, background alarm, 30+ countries incl. Poland, Watch app; one-off IAPs ($1.99–2.99) or Pro+ $11.99. https://apps.apple.com/us/app/rain-alarm-live-weather-radar/id397676100 · https://play.google.com/store/apps/details?id=de.mdiener.rain.usa
- **DWD WarnWetter** — Free: official warnings to municipality level, favourites, configurable warning elements and levels, push, widgets, dark mode. One-time €2.49 unlocks radar/model maps (rain, snow, hail, lightning), thunderstorm-cell tracks, thunderstorm monitor. https://www.dwd.de/DE/leistungen/warnwetterapp/warnwetterapp.html
- **Buienalarm (NL)** — GPS-based push; user chooses light rain / heavy showers / storm and can pause; servers look 30 min ahead, alert lands a few to 15 min before drops; per-5-min timeline; widget, Watch, offline map cache; Ad-dropper €1.99, Super €3.99, Family €6.99. https://apps.apple.com/be/app/buienalarm-live-rain-radar/id598509141
- **Yr (Norway)** — Radar nowcast 90 min ahead, 1 km, refreshed every 5 min, shown on the front page for GPS or searched places; notifications for favourites and aurora; Nordics only. https://hjelp.yr.no/hc/en-us/articles/209295525-Live-precipitation-forecast-only-for-the-Nordic-countries · https://www.yr.no/en/widget

## 3. Polish competitors

- **IMGW Meteo (new app, Google Play March 2026, v2.0.26 May 2026; iOS id6760625988)** — Free, no ads. Map layers: radar (CMAX, SRI), lightning, satellite, warnings, SYNOP, pollution. 3-level meteo + hydro warnings, KOMET messages, filtering by voivodeship and level. Storm alerts when a storm enters a user-set 50–200 km radius, with distance, direction and ETA. Push for storm alerts, warnings, aurora, 07:00/18:00 daily report. Widgets, offline mode. No Apple Watch. https://aplikacjameteo.imgw.pl/ · https://apps.apple.com/pl/app/imgw-meteo/id6760625988 · https://play.google.com/web/store/apps/details?id=pl.imgw.pogoda. Older "Meteo IMGW Prognoza dla Polski" still listed (radar 7 h back, push for forecast and warnings per favourite). https://apps.apple.com/pl/app/meteo-imgw-prognoza-dla-polski/id1530352176
- **Burzowo.info** — Free. Blitzortung lightning map, push when strikes within 20 km of current location (background geofencing), also SMS/Messenger alerts; radar overlay from RainViewer, Windy maps. https://burzowo.info/o-nas
- **Blitzortung Lightning Monitor** (Android/F-Droid) — Alarm radius 1–300 km, distance and bearing, background service, manual location. https://f-droid.org/en/packages/org.blitzortung.android.app/
- **Meteo ICM** — UM-model forecast maps (~20), GPS, favourites, widgets, synoptic commentary, notifications; forecast-oriented, no radar ETA. https://apps.apple.com/pl/app/meteo-icm-prognoza-pogody/id6745146552
- **RSO (MSWiA)** — Free app; IMGW meteo/hydro warnings plus local threats, geolocation targeting by voivodeship crisis centres, also on MUX-3 TV. https://www.gov.pl/web/mswia/regionalny-system-ostrzegania
- **Alert RCB** — SMS since Dec 2018; voivodeship-wide storm/heat alerts, criticised for SMS latency and overuse; no cell broadcast in Poland as of Aug 2026. https://spidersweb.pl/2026/08/alert-rcb-problem-dzianie-cell-broadcast-rozwiazanie.html · https://cert.orange.pl/aktualnosci/jak-dziala-alert-rcb-i-dlaczego-polska-wciaz-nie-korzysta-z-cell-broadcast/

**Gap GROM fills.** Nobody in Poland delivers a radar-based, minute-scale "rain reaches your pin in X min" alert with a user threshold and verification. IMGW's ETA is lightning/storm based at 50–200 km; Burzowo is lightning only; Windy's heavy-rain alert is GPS-only with a fixed threshold; Buienalarm, RainToday and Apple next-hour don't cover Poland; RainViewer charges for alerts and is not county-warning aware. GROM = free, Polish, pin-level radar ETA + IMGW county warnings + hindcast honesty.

## 4. Prioritised checklist

**MVP live**
1. Radar loop 1–2 h back + nowcast ≥60 min at 5–10 min steps — table stakes in every peer.
2. Pin rain timeline (minute bars, start/stop, intensity) — Apple/Buienalarm/RainViewer UX users expect.
3. IMGW county warnings (3 levels) on map and for the pin — MeteoSwiss/DWD core; already in GROM.
4. Favourites (≥3) + GPS follow — every peer; needed for push targeting.
5. Rain-start push per pin with intensity threshold + quiet hours (Web Push in PWA now) — the differentiator; Buienalarm/Windy prove demand.
6. Warning push per favourite with minimum level (default level 2 or 3) — MeteoSwiss default is level 3; DWD/IMGW similar.
7. Data-age badge ("outdated >15 min") + no-coverage state — RainViewer/Windy do it; protects trust.
8. Lightning layer + strike-within-X-km alert — Burzowo 20 km, Windy 2.5 km/15-min rule. (See 04-data-licensing: Blitzortung is not usable for warnings.)
9. PL/EN, dark mode, installable PWA — cheap, expected.

**v1.0**
10. Native iOS/Android shells (Capacitor) with FCM/APNs — Web Push is less reliable on iOS; Burzowo/IMGW alerts work in background.
11. Home/lock-screen widgets: rain timeline + radar thumb — MeteoSwiss, IMGW, Buienalarm all ship them.
12. Live Activity / Android ongoing notification during an active rain event — RainViewer's most praised recent feature.
13. Alert hygiene: dedupe, daily cap, "mute for today", pause — RainViewer/Buienalarm; prevents uninstalls.
14. Storm-cell tracking with direction/speed/ETA — IMGW and DWD show it; complements pixel ETA.
15. Public verification score ("alerts last 7 days: hit rate") — no competitor shows it; GROM already has hindcast.
16. Offline cache of last frames — IMGW, Buienalarm.
17. Share warning/alert deep link — MeteoSwiss 3.5.5.

**Later**
18. Apple Watch / Wear OS app + complications.
19. Crowdsourced hail/rain reports.
20. Probabilistic nowcast (ensemble, NowPrecip-2 style) with probability in push.
21. ML thunderstorm-hazard probability (heavy rain/hail/lightning next hour) — MeteoSwiss 2026.
22. Hydrological warnings, Alert RCB mirror, aurora — IMGW parity.
23. Optional premium (ad-free, 20 favourites, longer archive) — peers charge €2–10/yr; keep alerts free.

Unverified: MeteoSwiss in-app animation horizon, its dark mode/offline behaviour, Watch complication details, and absence of a rain-start push.
