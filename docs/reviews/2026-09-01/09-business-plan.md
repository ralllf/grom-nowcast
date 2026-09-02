# GROM business plan (side-project edition)

Written 2026-09-02. The premise is yours: this will not pay the bills, but it can pay for itself and maybe a bit more. Every number below is either a cited benchmark or an assumption marked as such. Change the assumptions and the scenarios move with them.

## 1. Summary

GROM is the only Polish app that tells a person, for their own pin, when rain reaches them and how hard, from radar, in minutes. The state app (IMGW Meteo, launched March 2026, 100k+ installs) alerts on storms entering a 50–200 km radius. Burzowo (100k+ installs, 3.7 stars, ad-supported, single developer) alerts on lightning within 20 km. Nobody does the pin-level radar ETA, and nobody publishes their own hit rate.

The plan: keep the core alert free for one pin, sell a **GROM Plus** subscription at about 50 zł per year for several pins, warning push, widgets and a Live Activity countdown, and add a tiny **B2B season licence** for clubs, marinas and event organisers. No ads.

| Scenario for the 2027 season | Installs | Payers | Net revenue | Net after costs |
|---|---|---|---|---|
| Cautious | 10,000 | 100 | ~3,500 zł | ~+1,700 zł |
| Base | 40,000 | 600 | ~21,000 zł | ~+15,000 zł |
| Upside | 150,000 | 3,000 | ~105,000 zł | ~+60,000 zł after JDG costs |

The base case is a nice hobby income that stays inside the unregistered-activity limit for most of the year. The upside needs a viral storm season and media pickup, and then it needs a registered business. RevenueCat's data says about 80 % of new subscription apps never pass $1,000 per month; the cautious case is the honest default.

## 2. Product and positioning

**One sentence.** *Skąd idzie, za ile dojdzie, czego się spodziewać. Na Twoją pinezkę, nie na cały powiat.*

**Who it is for.** People who make a decision in the next hour: parents at a playground, cyclists and runners, sailors on the Masurian lakes, allotment owners (there are about 966,000 ROD plots in Poland), roofers and construction crews, festival and match organisers, and the 1.5 million people who follow Polish storm-chaser pages on Facebook.

**Why GROM wins the moment.**
1. Pin-level ETA in minutes, not county warnings hours ahead.
2. Honest by design: a public verification score, a data-age badge, and copy that says a cell can form on the spot.
3. Polish-first, free of API keys, built on IMGW open data.

**Why GROM cannot win everything.** IMGW has better data, a free ad-free app, and a brand. If IMGW Meteo adds pin-level ETA, GROM's differentiator shrinks to speed, UX and transparency. That is a real risk and it is also fine: the point of the project is the alert, and the plan below does not assume beating IMGW at scale.

## 3. Market

| Fact | Value | Source |
|---|---|---|
| Polish internet users per month | 29.7 M | Mediapanel Jan 2025 |
| Android vs iOS by traffic | 69 % / 31 % | StatCounter Aug 2026 |
| Leading weather portal, record month | 7.4 M real users (Interia, Aug 2023) | Interia |
| Lightning-map site in a storm month | 0.54 M real users (blitzortung.org, May 2019) | Wirtualne Media |
| Thunderstorm days per year per station | ~24 mean; 15–20 NW, 30–35 SE | IMGW climatology |
| Season | June–August peak, July strongest, storms around 16–17 h | IMGW |
| Storm-chaser Facebook pages | Polscy Łowcy Burz 642k, Łowcy Burz Paweł i Marta 398k, Sieć Obserwatorów Burz 394k | Facebook page metadata |

**Addressable audience (assumption).** Weather content reaches roughly a quarter of Polish internet users monthly. The slice that cares about *minutes* rather than *tomorrow* is much smaller. The plan assumes a realistic ceiling of 100k–300k installs over three seasons for a Poland-only storm app, in line with Burzowo and IMGW Meteo today.

**Seasonality.** Nearly all installs and nearly all payments will happen May–September. Off-season retention will be low. This is the single biggest structural fact about the business: annual plans sold in June are the only way to carry revenue through winter.

## 4. Business model

### Free (the mission)
- Map, radar loop, timeline, IMGW warnings.
- **One pin with background push** on the Normalny preset, quiet hours, one alert per episode.
- The verification score, visible to everyone.

Keeping one-pin push free is deliberate. It is the product's promise and its marketing. A paywall in front of the core alert would raise conversion but kill word of mouth and invite the "IMGW is free" comparison.

### GROM Plus (assumption: 49,99 zł/year or 6,99 zł/month; launch price 39,99 zł/year)
- Up to 5 pins (dom, szkoła, działka, klub, trasa).
- Warning push per pin with a minimum IMGW level.
- Fine-tuned thresholds (lead time, intensity, chance).
- Widgets and a lock-screen countdown during an episode.
- Route mode ("czy komórka przetnie A4 między Gliwicami a Krakowem").
- Longer radar history and a per-pin alert log with hit/miss.

Price anchoring on the Polish App Store: Windy Premium 99,90 zł/yr, CARROT 72,99 zł/yr, Meteo ICM Plus 99,99 zł/yr, IMGW Meteo free. GROM sits below all paid peers because it does one thing and because its main competitor is free. Global median annual price is about $38 (Adapty 2026); 50 zł is roughly a third of that, matching Polish price sensitivity.

### B2B season licence (assumption: 199–499 zł per season)
- A named pin or route with push to a group of recipients: a sailing school, a football academy, a ROD board, a marina, a festival site, a construction site manager.
- Same engine, one settings page, an invoice. Ten to thirty customers is the realistic first-year range and it is worth more per customer than a hundred consumers.

### What the plan does not do
- **No ads.** Polish banner CPMs are under a dollar, a storm app has spiky traffic, ads need a consent platform, and the IMGW regulamin counts an ad-supported service as business use anyway. Ads would earn less than the base-case subscription while costing the map its space.
- **No accounts required for free.** Subscriptions go through App Store, Play, and a web merchant of record, so GROM never stores payment data.

## 5. Unit economics (assumptions, 2027 season)

| Item | Value | Basis |
|---|---|---|
| Install-to-paid | 1.0 % / 1.5 % / 2.0 % | RevenueCat 2026 freemium median 2.1 %; Polish price sensitivity and a generous free tier pull it down |
| Plan mix | 55 % annual, 45 % monthly | RevenueCat: annual 34 %, monthly 42 % of subs sold; storm seasonality pushes toward annual if the June offer is annual-only |
| Monthly subscribers' average life | 4 months | season length, monthly retention 17 % at one year |
| Store commission | 15 % | Apple Small Business Program, Google Play EEA 15 % effective |
| Net per payer per year (blended) | ~35 zł | 0.55 × 42.5 zł + 0.45 × 24 zł |
| Year-2 retention of annual payers | ~44 % | RevenueCat 2025 |
| Cost per install | 0 zł | organic only |

Fixed costs: worker hosting about 520 zł/yr, store fees about 500 zł/yr, domain and mail about 150 zł/yr, geocoding and push free tiers 0 zł. Total about 1,200 zł/yr while under unregistered activity. With a JDG: accountant 2,400–4,200 zł/yr plus ZUS (0 for six months, then about 456 zł/month social, then full).

## 6. Scenarios (season 2027, net of store commission)

| | Cautious | Base | Upside |
|---|---|---|---|
| Installs by September 2027 | 10,000 | 40,000 | 150,000 |
| Install-to-paid | 1.0 % | 1.5 % | 2.0 % |
| Consumer payers | 100 | 600 | 3,000 |
| Consumer net revenue | 3,500 zł | 21,000 zł | 105,000 zł |
| B2B licences | 0 | 10 × 300 zł = 3,000 zł | 30 × 300 zł = 9,000 zł |
| Total net revenue | 3,500 zł | 24,000 zł | 114,000 zł |
| Business form | nierejestrowana | nierejestrowana, borderline in Q3 | JDG from spring |
| Fixed + legal costs | 1,200 zł | 1,200 zł + accountant from Q3 ≈ 3,000 zł | ~1,200 + 4,000 accountant + ~8,000 ZUS (ulga na start then preferential) |
| Net | ~+2,300 zł | ~+21,000 zł | ~+100,000 zł before income tax |

The 2026 quarterly limit for unregistered activity is 10,813.50 zł. In the base case, June–August revenue lands around 10,000–12,000 zł in Q3, so plan to register a JDG the week the limit is crossed, not after. Income tax applies in all cases.

Year 2 (2028) in the base case: 44 % of annual payers renew, installs grow from a full-season app in the stores, B2B doubles. Roughly 35,000–45,000 zł net. That is the "maybe something".

## 7. Go-to-market with no budget

**Season timing.** Everything user-facing launches in May. A storm app launched in November launches to nobody.

1. **Storm communities first.** Offer the five largest storm-chaser pages a free embed of the pin timeline for their city posts, with attribution. Their audience is exactly the people who will pay for five pins.
2. **The verification score as the story.** "Jedyna apka pogodowa w Polsce, która publikuje własną skuteczność" is a pitch Spider's Web, Antyweb and android.com.pl can write from. Publish the hindcast numbers monthly.
3. **City landing pages.** One page per major city ("burza Kraków: za ile dojdzie"), server-rendered with the live timeline. Search for "gdzie jest burza" peaks in July; the pages are free traffic every summer.
4. **Embeddable widget.** A free iframe for local news sites, ROD boards, marinas and running-event pages, with a GROM link. Distribution in exchange for attribution.
5. **B2B by hand.** Ten emails to sailing schools on the Masurian lakes and ten to football academies in the spring. A season licence is cheaper than one cancelled training session.
6. **Open source as trust.** The repo, the hindcast log and the honesty rules are the credibility a one-person weather app otherwise lacks.
7. **Store listing basics.** Polish screenshots showing an actual storm, the verification badge, and the one-sentence promise. A closed test with 12 testers for 14 days is required on a personal Google Play account, so recruit them from the storm groups in April.

## 8. Timeline

| When | What | Revenue |
|---|---|---|
| Sept–Dec 2026 | Hardening (licence letter to IMGW, drop RainViewer, geocoder swap, worker, monitoring); PWA with Web Push; georeferencing and alert-engine fixes; verification score in the UI | 0 |
| Jan–Apr 2027 | Capacitor apps, closed test, Plus tier via RevenueCat, regulamin and privacy policy, VAT-UE registration, DSA trader info; city pages and embed widget | 0 |
| May 2027 | Public launch of Plus at 39,99 zł/yr launch price; press and community push | first payers |
| June–Aug 2027 | Season. Weekly hindcast numbers, B2B outreach, react to feedback | main revenue |
| Sept 2027 | Decision point (section 10) | |

## 9. KPIs that matter

- **July MAU** and installs by store.
- **Alert quality**: POD and FAR from the hindcast, and the user-reported hit/miss on each alert. A false-alarm ratio above about 35 % will show up as uninstalls before it shows up anywhere else.
- **Push opt-in rate** on first run (target above 60 %).
- **Day-7 retention** in season (target above 25 %).
- **Install-to-paid** at 35 days (target 1.5 %).
- **Refund and cancellation reasons.** Google Play billing failures cause a third of cancellations on Android; watch them.

## 10. Decision point, September 2027

| Outcome | Signal | Do |
|---|---|---|
| Hobby | under 10,000 installs, under 100 payers | Keep it free and open, stop paying for stores after year one, no JDG. It still does what it was built for. |
| Side income | 30,000+ installs, 400+ payers, B2B customers exist | Register JDG on ulga na start, add the lightning feed, invest in B2B and route mode for 2028. |
| Surprise | 100,000+ installs, 2,000+ payers, media coverage | JDG immediately, consider a part-time year, negotiate a formal IMGW real-time feed, price Plus at 59,99 zł for 2028. |

## 11. Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| IMGW disputes the high-value-dataset status or cuts datastore access | medium | Written wniosek before launch; OPERA composite as fallback; IMGW warnings stay free regardless |
| IMGW Meteo adds pin-level ETA | medium | Speed, honesty score, five pins, route mode; accept that the mission is served either way |
| A quiet summer | recurring | Annual plans sold in June; B2B licences are season-based, not weather-based |
| One wrong alert in a viral storm | medium | Verification score, data-age badge, "cell can form on the spot" copy, one alert per episode |
| Solo-developer time | high | The hardening phase is the only part that cannot slip; everything else is optional |
| App store rejection (web wrapper) | low | Push, native location, offline cache and haptics in the Capacitor build |

## 12. What this plan assumes you decide

- Pricing at 49,99 zł/yr and 6,99 zł/month, with a 39,99 zł launch price.
- One-pin background push stays free.
- No ads, ever, and no donation button until the IMGW licence question is answered.
- Launch of Plus in May 2027, not earlier.
- B2B is done by hand, ten emails at a time.

Change any of these and the scenario table changes with them. The spreadsheet behind section 6 is four multiplications; it is meant to be redone every month of the season.

## Sources

- RevenueCat, State of Subscription Apps 2025 and 2026: https://www.revenuecat.com/state-of-subscription-apps
- Adapty, State of In-App Subscriptions 2026: https://adapty.io/state-of-in-app-subscriptions/
- Mediapanel January 2025 via Interaktywnie: https://interaktywnie.com/najpopularniejsze-portale-i-aplikacje-w-polsce-oto-wyniki-badania-mediapanel-za-styczen-2025-roku/
- StatCounter Poland mobile OS share: https://gs.statcounter.com/os-market-share/mobile/poland
- Interia Pogoda record month: https://firma.interia.pl/aktualnosci/interia-pogoda-z-rekordowym-wynikiem-74-mln-ru/
- Wirtualne Media weather TOP10 (2019): https://www.wirtualnemedia.pl/pogoda-interia-pl-przed-accuweather-na-czele-mocno-w-gore-dzis-net-i-blitzortung-org-top10-serwisow-pogodowych,7171051078088321a
- IMGW storm climatology: https://obserwator.imgw.pl/2022/08/26/klimat-dla-burz/
- Play install brackets via APKCombo: Windy https://apkcombo.com/windy-com/com.windyty.android/ · RainViewer https://apkcombo.com/rainviewer/com.lucky_apps.RainViewer/ · Burzowo https://apkcombo.com/burzowo-info/info.burzowo/
- IMGW Meteo on the App Store: https://apps.apple.com/pl/app/imgw-meteo/id6760625988
- Polish App Store prices: Windy https://apps.apple.com/pl/app/windy-com-weather-radar/id1161387262 · CARROT https://apps.apple.com/pl/app/carrot-weather-alerts-radar/id961390574 · Meteo ICM https://apps.apple.com/pl/app/meteo-icm-prognoza-pogody/id6745146552
- Windy company results: https://www.lupa.cz/aktuality/lukacovicovo-windy-vytahlo-trzby-na-stovky-milionu-prioritou-je-kvalita-sluzeb-ne-zisk/
- ROD allotments: https://pl.wikipedia.org/wiki/Rodzinny_ogr%C3%B3d_dzia%C5%82kowy
- Legal and data terms: see 08-monetisation-legal-and-data.md
