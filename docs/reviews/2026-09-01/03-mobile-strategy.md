# Mobile strategy: PWA, Capacitor, Expo, push backend, stores

Researched 2026-09-01. Context: TanStack Start (React 19, Vite 8, SSR via nitro on Vercel), MapLibre GL JS v6 with a canvas overlay, Zustand, TanStack Query polling every ~90 s, in-tab alerts via Notification API + Web Audio. No service worker, no manifest, no push.

## 1. Three routes compared

### (a) PWA + Web Push
- iOS: Web Push works only for web apps added to the Home Screen, iOS 16.4+, permission must be requested from a user gesture; no install prompt exists, users add it manually via the Share sheet (https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/). Apple reversed its plan to drop Home Screen web apps in the EU before iOS 17.4 shipped (March 2024), so push works for Polish users. iOS 18.4 added Declarative Web Push, which needs no service worker to show a notification (https://webkit.org/blog/16535/meet-declarative-web-push/).
- Limits on iOS: no background geolocation, no Background Sync, tight cache storage; a normal Safari tab never gets push.
- Android Chrome: push works in the browser tab, no install needed; installability needs a manifest (name, 192/512 icons, start_url, display) and HTTPS (https://web.dev/articles/install-criteria).
- Effort: ~2–4 days (manifest, service worker, subscribe UI, VAPID keys). Code reuse: 100%. Store risk: none. Cost: €0.

### (b) Capacitor wrapping the existing web app
- Capacitor 8 (SPM default for iOS, 8.5 adopts UIScene) (https://ionic.io/blog/announcing-capacitor-8). Push: @capacitor/push-notifications returns an APNs token on iOS and an FCM token on Android (https://capacitorjs.com/docs/apis/push-notifications); @capacitor-firebase/messaging gives one FCM token on both platforms, so one FCM HTTP v1 sender covers everything (https://www.npmjs.com/package/@capacitor-firebase/messaging).
- Geolocation: @capacitor/geolocation is foreground only; background needs @capacitor-community/background-geolocation, @capgo/background-geolocation or Capawesome's plugin.
- Live Activities: @capgo/capacitor-live-activities, iOS 16.1+, JSON layouts, requires a hand-added Widget Extension in Xcode; no ActivityKit push-token API found, so server-pushed updates are not supported as far as verified; 6 stars, last push 2026-08-20 (https://github.com/Cap-go/capacitor-live-activities).
- MapLibre GL JS in WebView: WebGL works in WKWebView and Android WebView, but there are long-standing reports of fullscreen maps not holding 60 fps and iOS out-of-memory crashes (https://github.com/maplibre/maplibre-gl-js/issues/7667). No 2025–26 benchmarks found. Must be measured on a mid-range Android before committing.
- Build note: TanStack Start is SSR via nitro; the Capacitor shell needs a client-only SPA bundle (or capacitor server.url pointing at the deployed site) while server functions keep calling the Vercel origin over HTTPS. Budget 1–2 days.
- Store risk: guideline 4.2 says the app must "elevate it beyond a repackaged website"; 4.2.2 rejects web clippings (https://developer.apple.com/app-store/review/guidelines/). Mitigations reviewers reward: push with a real purpose, native location, cached last radar frame for offline, haptics/share sheet. With alerts as the core feature, risk is low-moderate.
- Effort: 1–3 weeks. Reuse: ~90%. Cost: $99/yr Apple + $25 Google.

### (c) React Native / Expo rewrite
- Expo SDK 57 (30 June 2026, RN 0.86). Maps: @maplibre/maplibre-react-native v11 is New-Architecture only, API renamed to match GL JS. The canvas radar overlay must be rebuilt as an image source or a native custom layer.
- Push: expo-notifications + Expo Push Service, free, 600 notifications/s, Android and iOS only, no web. Background location: expo-location startLocationUpdatesAsync + TaskManager, geofencing (20 regions iOS, 100 Android), dev builds required.
- EAS: Free plan 15 Android + 15 iOS low-priority builds/month; Starter $19/mo; per-build $1–4 (https://expo.dev/pricing). Local builds free.
- Effort: 4–8 weeks (all UI, map, sheet, overlay rewritten; only the TS domain logic ports as-is). Store risk: low. Cost: same store fees, EAS optional.

## 2. Push delivery backend

| Option | Web | Android | iOS | Free tier | Notes |
|---|---|---|---|---|---|
| Web Push (VAPID, web-push npm) | yes | Chrome | Home Screen app | free | web-push v3.6.7, slow maintenance |
| FCM HTTP v1 | yes (Firebase JS SDK) | yes | yes (relays to APNs) | no-cost on Spark and Blaze | one firebase-admin messaging.send() covers all three |
| APNs direct | no | no | yes | free | required for Live Activity pushes |
| OneSignal | yes | yes | yes | Free plan capped at <1,000 mobile MAU from 1 Sep 2026 (new accounts); Growth $19/mo | vendor lock-in, MAU cliff |
| Expo Push | no | yes | yes | free, 600/s | Expo apps only |

Least code covering web + Android + iOS: FCM HTTP v1 via firebase-admin, with @capacitor-firebase/messaging on native. If PWA-only, plain web-push with VAPID is enough and has no Firebase dependency; Safari accepts standard VAPID pushes.

## 3. Background alert evaluation (every 1–5 min for all pins)

- Vercel: Hobby crons run at most once per day with ±59 min precision and Hobby is non-commercial only; Pro ($20/seat/mo) gives per-minute crons, 300 s default / 800 s max duration on Fluid compute (https://vercel.com/docs/cron-jobs/usage-and-pricing). Hobby is unusable for this; Pro exceeds the budget.
- Cloudflare Workers: Free plan gives 10 ms CPU per cron invocation, far too little to decode an HDF5 in WASM. Paid ($5/mo) gives 30 s CPU per cron trigger, 128 MB memory, 10 MB gzipped script (https://developers.cloudflare.com/workers/platform/limits/). Feasible if h5wasm + nowcast fits; unverified bundle size.
- Tiny VPS: Hetzner CX23 €5.49/mo ex VAT after the 15 June 2026 increase, IPv4 extra. Fly.io shared-cpu-1x 256 MB $2.02/mo, 512 MB $3.32/mo in AMS (https://fly.io/docs/about/pricing/). Railway Hobby $5/mo.
- Supabase: pg_cron on all plans incl. Free, pg_net calls Edge Functions, fire-and-forget (https://supabase.com/docs/guides/cron). Free projects pause after 7 days without activity. Edge Function CPU limits make the HDF5 decode per tick risky; unverified.
- Subscription storage: Supabase Postgres 500 MB free; Upstash Redis 256 MB / 500k commands/mo free; Turso free 5 GB.

**Recommended stack (≈€3–8/month):** one long-running Node process (the existing TS decode + nowcast + alert engine, unchanged) on Fly.io 512 MB or Hetzner CX23, looping on the radar refresh cadence; subscriptions and pins in Supabase Postgres Free (pinged by the worker so it never pauses); sending via web-push (VAPID) now and firebase-admin FCM v1 when native apps ship. Cloudflare Workers Paid is the runner-up.

## 4. Store and publishing requirements

- Apple Developer Program $99/yr. Google Play $25 one-time, government ID required.
- Google Play personal accounts created after 13 Nov 2023 must run a closed test with 12 testers opted in continuously for 14 days before production access; organisation accounts are exempt (https://support.google.com/googleplay/android-developer/answer/14151465).
- Apple privacy: PrivacyInfo.xcprivacy required since 1 May 2024; privacy-impacting SDKs must ship their own manifest since 12 Feb 2025. Nutrition labels: Precise Location = 3+ decimal places, otherwise Coarse; push tokens count as Device ID identifiers.
- Background location: Apple 2.5.4 and 5.1.5 require it to be directly relevant with consent. Google Play requires a permission declaration form, a video under 30 s, a prominent in-app disclosure and a privacy policy URL (https://support.google.com/googleplay/android-developer/answer/9799150). "Rain reaches your pin" needs no background location at all, since pins are static server-side. Ship without it.
- Weather attribution: IMGW regulations require the wording "Źródłem pochodzenia danych jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy", plus "…zostały przetworzone" when data is processed.
- EU DSA: Apple makes every developer declare trader status; monetised apps are traders and must show address, phone and email on the EU App Store; a hobbyist free app may declare non-trader. Google Play has an equivalent declaration.

## 5. iOS nice-to-haves: Live Activities and widgets

- Server-driven Live Activities need ActivityKit push tokens sent with APNs push type liveactivity over token-based auth; iOS 17.2+ supports push-to-start.
- Capacitor: @capgo/capacitor-live-activities can start/update an activity while the app runs, but no push-token support was found, so a server-updated countdown needs custom Swift. Live Activity timers can count down locally without pushes.
- Expo: expo-widgets (SDK 57) writes widgets and Live Activities as React components rendered to SwiftUI, supports Dynamic Island slots, push-to-start and per-activity push tokens; iOS only; alpha since March 2026 (https://docs.expo.dev/versions/latest/sdk/widgets/). The one feature where Expo is clearly ahead.

## Recommendation

1. Now (€0, ~1 week): ship the PWA path. Manifest, service worker, Web Push with VAPID, a subscribe button that stores the pin plus subscription in Supabase, and the alert engine in a small always-on Node worker on Fly.io (≈$3/mo) that reuses the current server code.
2. Next (1–3 weeks, $124/yr): wrap the same bundle with Capacitor 8. Use @capacitor-firebase/messaging so one FCM v1 sender serves web, Android and iOS. Add foreground geolocation, offline last-frame cache and haptics to clear guideline 4.2. Register Google Play as an organisation if possible. Measure MapLibre frame rate in the Android WebView before release.
3. Defer the Expo rewrite. It only wins if server-pushed Live Activities become a headline feature; then evaluate expo-widgets once out of alpha, or add a hand-written Swift Widget Extension to the Capacitor app.
4. Skip background location entirely in v1.
