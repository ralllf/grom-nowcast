---
name: verify-grom
description: Use when verifying GROM (grom-nowcast), the Polish storm nowcast web UI at `/` — after UI, map, nowcast, alert, or IMGW changes, or before claiming the Vite instance or https://grom-nowcast.vercel.app/ still works. Reach for this to drive the live page, not only `npm test`.
---

# Verify GROM

GROM is a single-route TanStack Start app (`/` → `GromApp`). The product is the map + threat sheet + settings dialog. Unit tests in `src/lib/weather/*.test.ts` do not prove the page.

Drive the instance **you** launched. Do not drive https://grom-nowcast.vercel.app/ unless the task is explicitly about production. Do not add packages.

## Isolation

Vite is pinned to `0.0.0.0:8080` with `strictPort: true` (`vite.config.ts`, `npm run dev`). A second `npm run dev` fails. One process holds the 90 s radar cache. Same-origin `localStorage` (`grom-settings-v1`, `grom-alerts-v1`, `grom-alert-memory-v1`) is shared across tabs.

**Refuse to start a second instance. Refuse to drive an instance you did not launch** (doctor-only reuse is allowed if `/` already serves this app and you will not click). If port 8080 is busy and it is not your PID, stop and report the occupant.

## Launch

Documented command (README):

```bash
npm install          # once, if node_modules is missing
npm run dev          # vite dev --host 0.0.0.0 --port 8080
```

From repo root. Record the PID of the npm/vite process you started (helper writes `/tmp/verify-grom/launch.json`).

**Ready when all of:**

1. Stdout contains `Local:   http://localhost:8080/` (Vite v8 prints this in ~1 s).
2. `GET http://127.0.0.1:8080/` → `200` and HTML includes `<title>GROM</title>` and `id="grom-threat-sheet"`.
3. First `getSnapshot` can take 10–20 s (SRI H5 decode). The SSR HTML still says `Skanuję radar…` until the client query lands. That is not failure.

**Teardown:** kill only the process group / PIDs in `/tmp/verify-grom/launch.json` (`vitePgid` plus optional `chromePid`). Never `pkill -f vite` / `pkill chrome`.

```bash
.cursor/skills/verify-grom/scripts/launch.sh
```

## Doctor

One read-only check: is this process worth driving?

```bash
.cursor/skills/verify-grom/scripts/doctor.mjs
# BASE=http://127.0.0.1:8080 .cursor/skills/verify-grom/scripts/doctor.mjs
```

It does `GET /` then POSTs the live `getSnapshot` server function (Warszawa pin: `52.2297, 21.0122`, TERYT `1465`, radius 25). CSRF requires `Origin: <base>` and `Sec-Fetch-Site: same-origin`. Dev function ids are base64url JSON in the Vite transform of `/src/lib/weather/server.ts` (`createClientRpc("…")`); the script extracts `getSnapshot`.

**Worth driving** if:

- HTML `200`, `<title>GROM</title>`, `#grom-threat-sheet` present.
- Snapshot `200`, `radarUnavailable === false`, `radar.latestTime` within 30 min (same stale gate as alerts), `analysisSource` is `sri` or `rainviewer`.

**Do not fail** if `warningsUnavailable` or `lightningUnavailable` is true — IMGW warnings and PERUN often bounce; the nowcast sheet still drives. Note them so you skip IMGW-tint / strike assertions.

**Not worth driving:** port closed, HTML error page `Coś poszło nie tak`, snapshot 403 (missing Origin), `radarUnavailable`, or radar older than 30 min.

## Drive

Harness: **Chrome CDP** via the shipped script (system `google-chrome`, no Playwright package). Desktop **1280×800** — below `640px` the sheet collapses to the peek card (`sm:hidden` handle) and the IMGW aside hides. At `1280` `location-pin` also measures the two-column pin card (`card.json`: inner scrollers, hero/strip boxes, tail behind `O danych ›`). `--feature nowcast-threat-sheet` is the exception: it drives that phone peek at **390×844**, and `--viewport WxH` overrides any feature's default. Chrome must be `--headless=new` plus `--remote-allow-origins=*` (without the latter, `/json/new` returns `Using unsafely HTTP…` instead of JSON).

```bash
.cursor/skills/verify-grom/scripts/drive.mjs --feature location-pin
# optional: --base http://127.0.0.1:8080 --out .cursor/skills/verify-grom/evidence/<id> --viewport 390x844
```

Recipes. Prefer ARIA / ids / visible Polish copy. There are almost no `data-*` hooks.

| Control | Selector / copy |
|---|---|
| App | `/` only. Wordmark is a bolt glyph + `h1` `GROM` (no eyebrow) |
| Threat sheet | `#grom-threat-sheet`. Mobile handle: `button[aria-controls="grom-threat-sheet"]` (`aria-label` = headline) |
| Locate | `button[aria-label="Wybierz lokalizację"]` |
| Settings | `button[aria-label="Ustawienia"]` → `[role="dialog"][aria-labelledby="settings-title"]` title `Lokalizacja i alerty`; headings `Miejsce` / `Alerty` |
| Close dialog | `button[aria-label="Zamknij"]` |
| Search | `input[placeholder="Szukaj miasta w Polsce"]` + submit `Szukaj` (≥2 chars, Nominatim `countrycodes=pl`) |
| City chips | unlabeled `<button>` whose text is exactly `Warszawa`, `Kraków`, … (first 12 of `CITIES`) |
| Alert radius | label starts with `Promień alertu:` — `input[type=range]` min 15 max 80 step 5 |
| Enable alerts | button `Włącz` / `Włączone` under `Alerty na pinezkę` |
| Presets | `Czuły`, `Normalny`, `Tylko pewne` (visible only when alerts on) |
| Test alert | button `Testuj alert` → banner `[role="status"][aria-live="assertive"]` title `Deszcz za ok. 18 min` |
| Dismiss banner | `button[aria-label="Zamknij alert"]` |
| Radar time | `input[aria-label="Czas radaru"]` (only after ≥2 overlay/past frames) |
| Drizzle | button whose text is `Pokaż mżawkę` (`aria-pressed`) — only if SRI overlays exist |
| IMGW tint | button whose text is `IMGW` (`aria-pressed`) — only if any live storm warning has a TERYT |
| Rain motion | `tor komórki` chip (`aria-pressed`, **false** on fresh load) draws arrows when on; `pokaż` on that pill, or `Pokaż ruch opadu na mapie` in the sheet, pans |
| IMGW list | `aside` `h3` `Ostrzeżenia IMGW` (desktop only) |
| Map pick | MapLibre canvas (not the `aria-hidden` overlay canvas). Click → place label `Punkt na mapie` |

**Default pin** (empty `localStorage`): Warszawa, TERYT `1465` in settings. After a chip click the dialog closes; sheet shows the new label (no `TERYT`); `localStorage.grom-settings-v1.place.label` matches. TERYT stays in settings / nowcast matching, not on the sheet.

Feature files: [features/README.md](features/README.md). Drive **one** mapped feature per run unless asked otherwise.

Production boundaries you must not mock: IMGW SRI datastore, RainViewer tiles, `danepubliczne.imgw.pl` warnings, PERUN CSVs, Nominatim, OpenFreeMap. If a source is down, record the doctor flags and drive a feature that does not need it (location chips and `Testuj alert` are local).

## Evidence

Write under **`.cursor/skills/verify-grom/evidence/<run-id>/`**. This directory survives cleanup. `run-id` = `YYYYMMDD-HHMMSS` UTC.

Required in that folder:

| File | What |
|---|---|
| `doctor.json` | doctor stdout object (pass/fail, radar age, source, IMGW/PERUN flags) |
| `notes.md` | feature id, base URL, steps, action → resulting state, side effects |
| `NN-<state>.png` | desktop screenshots: before action, after action (not a single pretty shot) |

Proof standard:

1. Real user path on `/` (click / type), not `page.setContent`.
2. Every action paired with the resulting DOM or `localStorage` state (quote the text).
3. Side effects: `grom-settings-v1` place change; alert banner + `grom-alerts-v1` after `Testuj alert`.
4. Mocks only at real production boundaries (if you stub, say so and do not claim nowcast correctness).

A screenshot of SSR `Skanuję radar…` is not proof the nowcast works.

## Cleanup

```bash
.cursor/skills/verify-grom/scripts/cleanup.sh
```

Kills only PIDs recorded in `/tmp/verify-grom/launch.json` (vite + optional Chrome). Does not delete `.cursor/skills/verify-grom/evidence/`. Does not wipe the user’s `localStorage` on a machine you do not own; the drive script uses a throwaway Chrome `--user-data-dir` under `/tmp/verify-grom/chrome-profile` and cleanup removes that profile only.

After cleanup: `ls` the evidence dir and confirm `notes.md` + PNGs still exist.

## Helpers

All executable; invoke from repo root.

| Script | Role |
|---|---|
| `.cursor/skills/verify-grom/scripts/launch.sh` | `npm run dev`, wait until `/` is 200, write `/tmp/verify-grom/launch.json` |
| `.cursor/skills/verify-grom/scripts/doctor.mjs` | read-only worth-driving check → JSON on stdout, exit 0/1 |
| `.cursor/skills/verify-grom/scripts/drive.mjs` | Chrome CDP; `--feature location-pin` / `nowcast-threat-sheet`, `--viewport WxH` (see `--help`) |
| `.cursor/skills/verify-grom/scripts/cleanup.sh` | SIGTERM recorded PIDs only |

```bash
.cursor/skills/verify-grom/scripts/launch.sh
.cursor/skills/verify-grom/scripts/doctor.mjs
.cursor/skills/verify-grom/scripts/drive.mjs --feature location-pin
.cursor/skills/verify-grom/scripts/cleanup.sh
ls .cursor/skills/verify-grom/evidence/*/notes.md
```
