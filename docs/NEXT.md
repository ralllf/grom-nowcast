# Next slices (after 0–9 + pin-only)

*2026-09-01, live [grom-nowcast.vercel.app](https://grom-nowcast.vercel.app/) 17:11–17:19 CEST, against `main` (`cbafda2`, post [#18](https://github.com/ralllf/grom-nowcast/pull/18) / [#16](https://github.com/ralllf/grom-nowcast/pull/16) / [#15](https://github.com/ralllf/grom-nowcast/pull/15)). English; product words stay Polish. Pick **#1** without reading the rest of the repo. Do not re-implement [ACCURACY-PLAN](ACCURACY-PLAN.md) 0–9.*

Already on `main` (code, not a guess):

- Slices 0–9 shipped. Slice 9 **copy only** (`GROWTH_MATH_ENABLED` false). Ledger: 2 `front` rows, **0** `konwekcja`.
- Pin-only (#18): no `radiusKm`, no Promień, no map circle; `CLOSE_KM` / `IMMINENT_KM` gone.
- PERUN point CSVs still **307**. Not a code slice. LTS2005 GIFs are maps, not lat/lon.
- `DEFAULT_ALERT_SETTINGS.enabled` is **false**. Hindcast force-enables. Live users toggle. Not a slice unless Rafał wants alerts on by default.
- Live SRI today was **fresh** (~3 min). `resolveAnalysis` still keeps any non-empty SRI even if the newest H5 is hours old; `canTrustRadar` still ignores age; alerts already no-op at `STALE_RADAR_MIN` 30. Real hole — **not this week’s #1**, because today’s feed was not stale. [DATA.md](DATA.md) already warns the product-API mirror lags hours.
- SRI listing is shared 90 s (Runtime Cache + single-flight), not a 7.7 s POST per cold isolate.

Parked: GPS-as-platform, Web Push, ML, second backend, Blitzortung, growth math, inventing strikes from GIFs.

---

## 1. Pin the radar clock to Europe/Warsaw

[`formatRadarClock`](../src/lib/weather/wall-clock.ts) is `toLocaleTimeString("pl-PL")` with **no** `timeZone`. [`radarAgeCaption`](../src/lib/weather/wall-clock.ts) shares the same unix seconds for the clock and for `sprzed N min`. IMGW warning times already pin `Europe/Warsaw` ([`imgw-time.ts`](../src/lib/weather/imgw-time.ts)).

**Live, not a hunch:** 17:18 CEST the sheet said `Radar IMGW 08:15 · sprzed 3 min`. Relative age was right. Feed ~3 min old. A Pacific browser prints 08:15 for a 15:15 UTC / 17:15 Warsaw frame — same **9 h** offset as the earlier `07:30` at ~16:37 Warsaw. A 07:30 *frame* at 16:37 would have printed ~547 min. It did not.

- **Who sees what:** anyone whose browser is not Warsaw, including our screenshots. A Warsaw browser is unchanged.
- **Success check:** at 17:18 CEST the caption is `Radar IMGW ~17:15 · sprzed N min`, N still 3–8. `TZ=America/Los_Angeles` unit: 15:15 UTC → **17:15**, never 08:15.
- **Out:** converting ETA to clock-of-day; 12-hour format; interpolating frames.

---

## 2. Cadence-aware hindcast scorer, then one SRI log row

[`firstObsLead`](../src/lib/weather/hindcast-summary.ts) / nowcast scoring uses `frames[i + lead / 10]`. Fine for RainViewer 10 min. On SRI 5 min, lead 30 looks **three** frames ahead (~15 min) and would overstate skill. **Do not** `hindcast --sri` a ledger row before this ships.

- **Who sees what:** Rafał in [HINDCAST-LOG.md](HINDCAST-LOG.md), not users. Live sheet unchanged.
- **Success check:** unit with 5 min `dt`; `+30` compares the frame ~30 min later, not ~15. RainViewer 10 min path unchanged. After that, one `--sri --json` row. `GROWTH_MATH_ENABLED` stays false. `konwekcja` rows only after the SRI row is honest.
- **Out:** remapping [`chance.ts`](../src/lib/weather/chance.ts) in the same PR; CI hindcast; frames in git.

---

## 3. Hail and 90 % on a weak echo

**Landed** on `main` in [#23](https://github.com/ralllf/grom-nowcast/pull/23) (`35932b5`). Lock: `src/lib/weather/threat.test.ts` — three **Gdańsk weak pin** tests (hail on `HAIL_RATE` at the pin; headline vs detail; Szansa 90 only under the cell). The 2026-09-01 17:18 CEST sheet is the fixture, not a new Szansa day.

**Live Gdańsk 17:18 CEST (the bug):** Echo `5 km · słaby` still said **możliwy grad**; headline **Opad nadciąga** vs detail **nad Gdańsk teraz**; Szansa **90 %**, ETA **teraz**.

Mechanism that shipped: hail only when pin rate (≤ 8 km) ≥ `HAIL_RATE`; `expectLevel` does not take a far klasa 4 while the pin is already under echo; `nearby` headlines „Opad nadciąga” only when `approaching && etaMin !== 0`; raw 70/80 (`overPinKlasa2` / `overPinNowKlasa2`) need klasa ≥ 2 at the pin, not any echo.

- **Who sees what:** a pin in weak rain next to a stronger cell — Gdańsk that afternoon.
- **Success check:** Echo `5 km · słaby` no longer says możliwy grad (gate hail on `HAIL_RATE` at the pin, not a distant klasa 4). Headline and detail agree: **nad Tobą** or **nadciąga**, not both. 90 % stays only if the pin is actually under that cell.
- **Out:** recalibrating Szansa from one new day; PERUN; growth math.

---

## 4. IMGW loading zero + radar-down copy

**Landed** on `main` in [#24](https://github.com/ralllf/grom-nowcast/pull/24) (`a87cf57`). Lock: `src/components/threat-sheet.test.ts` — `imgwAsideCountLine` (no `0 burzowych` while missing/unavailable), `grom-app` aside wiring (no `stormWarningCount ?? 0`), and `sheetSourceHonesty` (radar-only / IMGW-only, no combined „albo”).

**The bug (SSR/live before #24):** `{snapshot?.stormWarningCount ?? 0} burzowych w kraju` while the body still said **Pobieram komunikaty…**. Sheet error was „Nie udało się pobrać radaru **albo** ostrzeżeń”.

Mechanism that shipped: count line is null until a settled snapshot with `warningsUnavailable === false`. Radar down → `RADAR_UNAVAILABLE` („Nie udało się pobrać radaru. Spróbuj za chwilę.”). IMGW down → `IMGW_WARNINGS_UNAVAILABLE` in the aside. Not one combined string.

- **Who sees what:** first 10–20 s of every load (SSR/live already showed `0 burzowych` + Pobieram). A radar-only outage must not blame IMGW, and the reverse.
- **Success check:** never print `0 burzowych w kraju` while Pobieram or niedostępne. Radar down → radar honesty; IMGW down → the existing warn line; not the combined „albo”.
- **Out:** status page; retry queues; fetching warnings from the browser.

---

## 5. Sheet vs map chips, plus drop `leadMin` from user copy

Map pills **tor komórki** / **Pokaż mżawkę** sit `absolute` top-left (`z-10`); the sheet is the same `z-10` and grows without a desktop max-height, so at ~1280 px the left column covers the pills. Footer still says *„leadMin to czas, nie dystans”* (live HTML).

- **Who sees what:** desktop ~1280 px — chips that look clickable and are not; every sheet, an identifier in the honesty paragraph.
- **Success check:** **tor komórki** and **Pokaż mżawkę** both click at ~1280 px; no `leadMin` in the sheet. Declension table can wait.
- **Out:** new basemap; English tiles; GPS watch.
