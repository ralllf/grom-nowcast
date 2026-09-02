# GROM Code Quality Review

Scope: code quality only (architecture, types, tests, error handling, readability, tooling). Not ops/launch, not nowcast algorithm math, not UI design. Reviewed at `ec7d59a` (main).

## 1. Metrics

| Metric | Value |
|---|---|
| Source lines (excl. tests, excl. generated) | 7,605 |
| Test lines | 3,763 |
| Test : source ratio | 0.49 |
| Files > 400 lines | `threat.ts` (1,147), `grom-app.tsx` (966), `threat.test.ts` (951), `radar-map.tsx` (605), `server.ts` (494), `alerts.test.ts` (424), `hindcast-summary.ts` (414) |
| `computeThreat` (threat.ts:790) | 358 lines, one function |
| `evaluateAlert` (alerts.ts:223) | 155 lines, one function |
| `GromApp` component (grom-app.tsx:95–951) | 857 lines, one function |
| `any` (real TS type usage) | 0 — the naive grep hit 6 identifier/comment matches (`const any =`, doc comments), not the type |
| `as X` casts (excl. `as const`) | 64, concentrated in `radar-map.tsx` (15, MapLibre API surface), `snapshot.ts` (7), `hindcast-summary.ts` (5) |
| Non-null assertions (`!`) | 14, mostly `Map.get(k)!` right after a guaranteed insert in `hindcast-summary.ts` and `threat.ts` |
| `@ts-*` suppressions | 0 |
| `eslint-disable` | 0 (no ESLint config exists, so this is moot — see §9) |
| `console.log` | 15, all in `scripts/hindcast.ts` (CLI tool — legitimate) |
| `console.error`/`warn` | 1, also in `hindcast.ts` — **zero in app/server code**, see §5 |
| `TODO`/`FIXME` | 0 |
| Test run | 239 tests, 238 pass, 1 fail, 706 ms wall time |
| `tsc --noEmit` | 1 error (`threat-sheet.test.ts:133`) |

## 2. Architecture and module boundaries

`src/lib/weather` is a genuinely clean domain layer: grep confirms **zero** imports from `@/components` or `@/lib/store` anywhere under `lib/weather`. Data flows one way — domain → store/components — with no cycles among `src/components/*.tsx` either. `geo.ts` (`haversineKm`, `bearingDeg`) is a genuine single source of truth reused correctly by `threat.ts`, `perun.ts`, `teryt.ts`, `spatial-hash.ts`, `hindcast-summary.ts`, and `grom-app.tsx` — no duplicated distance math. This is the strongest part of the codebase.

`server.ts` (494 lines) does too much: three unrelated fetch caches (RainViewer maps, IMGW warnings, PERUN), Nominatim reverse/search, radar-tile decoding (PNG→dBZ→sample), SRI listing/decoding, and the three `createServerFn` boundaries. Splitting into `server/radar.ts`, `server/warnings.ts`, `server/places.ts`, `server/sri.ts` with a thin `server.ts` re-exporting the `createServerFn`s would make each cache/timeout policy independently testable.

`threat.ts` (1,147 lines) is more defensible — it's one cohesive algorithm (segmentation → motion → tracks → threat assembly) — but `computeThreat` itself (358 lines) interleaves warning-matching, ETA, chance %, and copy selection in one body with ~15 local `let`s threaded through. It would benefit from extracting named sub-steps (`resolveMotion`, `resolveEta`, `resolveChance`), purely for readability — the logic itself is well tested (951-line `threat.test.ts`, scenario names that double as behavior spec).

`types.ts` (171 lines) is coherent: one flat file of domain types, no re-exports of unrelated concerns, well-commented fields. A `nowcast` package boundary, if extracted, should be exactly `lib/weather` minus `nominatim.ts`/`teryt.ts` (place lookup) and `store.ts`/components — the radar/threat/alert math has no framework dependency today and could be published standalone as-is.

## 3. `grom-app.tsx` and `threat-sheet.tsx`

`GromApp` (grom-app.tsx:95–951) is an 857-line single component — the file's two other functions (`HourSelect`, `AlertIcon`) are tiny helpers, so essentially all UI wiring, `useQuery`/`useMutation` calls, the alert-engine effect, geolocation, search, and settings-sheet markup live in one function body. Effect hygiene inside it is good (see below), but any future feature keeps landing here. Splitting the settings sheet, search box, and geolocation handling into child components would reduce blast radius per change.

Effect hygiene is a genuine strength:
- The alert-engine effect (grom-app.tsx:206–222) reads `alertMemory` via `useGrom.getState()` inside the effect body instead of listing it as a dependency, with an explicit comment explaining why (a memory update must not re-fire the effect) — the correct pattern for "read latest without re-triggering," avoiding a common stale-closure bug.
- `radar-map.tsx` uses a `liveRef` mirror (props copied into a ref every render) so the expensive MapLibre-init effect (`useEffect(..., [])` at line 137) never re-runs on prop changes, while long-lived closures (`draw`, `paintOverlays`) still read live values off the ref. This is a deliberate, correct pattern for bridging React state into an imperative library — good engineering, not an anti-pattern.
- One documentation gap: `grom-app.tsx:157–160` manually re-fetches on `place.lat/lon/terc` change, and `grom-app.tsx:189–201` manually re-fetches on tab-focus/visibility. Both exist because `QueryClient` sets `refetchOnWindowFocus: false` globally (`routes/index.tsx:16`), but that reasoning isn't noted at the `QueryClient` call site — a one-line comment there would save the next reader a grep.

`threat-sheet.tsx` (397 lines) is comparatively tight — one `useEffect` and three refs for its drag-to-dismiss gesture, with captions/labels pulled into `threat-sheet-logic.ts` (64 lines, pure, directly unit-tested). That split (component vs. presentation-logic module) is a good pattern worth repeating for `grom-app.tsx`.

TanStack Query usage: `snapshotQuery` (grom-app.tsx:134) has no `staleTime` (defaults to the global 30 s), a 90 s `refetchInterval`, and `refetchIntervalInBackground: true` — sensible for a live-radar poll. `overlayQuery` (line 242) correctly sets `staleTime: 5 * 60_000` and `placeholderData: keepPreviousData` so scrubbing the history slider doesn't flash a blank tile between frames.

## 4. Types and validation

Zod is used correctly at the **client → server** boundary: `snapshotInput`, `searchInput`, and `overlayInput` in `server.ts` all validate arguments a browser can send to a `createServerFn`. There is **no runtime validation on any external API response** — `fetchJson<T>` (server.ts:40) does `return (await res.json()) as T`, an unchecked cast, for RainViewer's `weather-maps.json`, IMGW's `warningsmeteo` JSON, and both Nominatim endpoints. A shape change on any of those (IMGW has done this before) fails silently downstream — a missing field becomes `undefined` and flows into string interpolation rather than a clear parse error. The Zod schemas exist for the wrong boundary. IMGW's HTML SRI listing (`parseSriListing` in `sri.ts`) and H5 attribute reads (`sri-h5.ts`) use hand-written regex/format checks instead — reasonable since they aren't JSON, but with no schema-level assertion beyond what the parsing code requires.

`Threat` (types.ts:136) is a flat optional-bag rather than a discriminated union: `willHit`, `missKm`, `track`, `etaMin` etc. are independently nullable, so a consumer must know the correlations by convention (`etaMin` is only meaningful when `willHit` is true) rather than have the compiler enforce it. `AlertEvent`/`AlertMemory` in `alerts.ts` are similar. Since `computeThreat` is the only producer and consumers go through `etaLabel`/`etaToLevel`-style helpers rather than reading raw fields, the risk is contained — but a discriminated union on `willHit` would let the compiler catch a future direct-field read that forgets the guard.

## 5. Error handling

`loadSnapshot` (`snapshot.ts:57`) is the best error-handling code in the repo: radar, IMGW warnings, and PERUN lightning are fetched in parallel, each wrapped in `.then(ok, fail)` so one source's failure never blocks the others, and the resulting `Snapshot` carries explicit `radarUnavailable`/`warningsUnavailable`/`lightningUnavailable` flags that downstream code checks rather than guessing from empty arrays. That said, every failure branch discards the actual error (`() => ({ ok: false as const })`) — **there is no `console.error`/`console.warn` anywhere in `server.ts`, `snapshot.ts`, or any app code** (the one non-CLI hit in the whole grep was inside `hindcast.ts`). When IMGW or PERUN fails in production, the app degrades gracefully for the user but leaves no trace for an operator to diagnose *why* — the reason (timeout vs. 404 vs. malformed JSON vs. 307 redirect) is lost right where it's known. Flagged here as a code-quality/observability gap, separate from the ops audit: add `console.error(err)` in each `.then(ok, fail)` failure branch.

Timeouts are handled uniformly via `AbortController` + `setTimeout` in `server.ts`'s three fetch helpers (`fetchJson`, `fetchBuf`, `fetchText`), each with a sensible per-call override. PERUN's `fetchPerunText` sets `redirect: "follow"` to survive IMGW's known 307, but that case isn't distinguished from "PERUN is actually down" for the unavailability flag or a log line — the same silent-catch gap.

## 6. Tests

Well covered: `threat.ts` (951-line test file, scenario names read like a spec — e.g. "a strong cell 20 km away plus drizzle over the pin is not 'nad Tobą'"), `alerts.ts` (424 lines), `hindcast-summary.ts`, `imgw-time.ts`, `wall-clock.ts`, `trend.ts`, `chance.ts` — the pure domain layer is thoroughly tested and doubles as documentation of intent.

Gaps: **no test file for `server.ts`, `store.ts`, `radar-map.tsx`, or `sri-overlay-png.ts`**. `server.ts` is where the untyped `as T` casts and swallowed errors live (§4, §5) — the highest-risk file has zero direct tests. `store.ts`'s `sanitizeAlerts`/`loadAlertMemory` (TTL + place-key invalidation) is complex hand-written parsing with no test.

Two concrete, already-known defects:
- `src/lib/weather/imgw-time.test.ts:19–24` ("Date.parse-as-UTC would be two hours late in July") fails on this machine. The premise is wrong: `Date.parse("2026-07-15T14:00:00")` (no zone suffix) is parsed as **local time** per spec, not UTC. It only produces the asserted 2-hour gap when the runner's local zone differs from Warsaw's July offset; this machine's TZ (`Europe/Zurich`) is also UTC+2 in July, so the delta is 0, not 7,200,000 ms. The test is timezone-dependent and its comment mis-describes JS date-parsing semantics — pin `process.env.TZ` explicitly or drop the `naive` comparison.
- `src/components/threat-sheet.test.ts:133` fails `tsc --noEmit` with `TS2339: Property 'includes' does not exist on type 'never'`. After `assert.equal(line, null)` narrows `line` to `null`, the next line's `line?.includes(...)` types as `never`. That line is redundant with the equality check above it and should simply be deleted.

Test quality otherwise is good: deterministic fixtures, no snapshot tests, no network calls, 706 ms for 239 tests.

## 7. Naming, comments, duplication

Comments are a genuine strength — nearly every non-obvious function carries a one-line "why", and several encode product invariants directly (`threat.ts:786`, "Tracks/arrows are built only from this window... The user pin must NOT change which arrows are drawn"). Naming mixes Polish (UI copy, `levelNounPl`, `stormNoun`) and English (everything else) consistently — a deliberate, reasonable split, not an inconsistency.

One real duplication: **level→label mapping is defined twice with different rules**. `threat.ts:779` (`stormNoun`) returns `"Burza"` only when lightning is near a level-≥3 cell, else `"Ulewa"`/`"Deszcz"`. `alerts.ts:156` (`levelNounPl`) has a four-tier ladder whose level-≥3 wording differs from `stormNoun`'s (`"Ulewa i wiatr"` vs `"Ulewa"`). Both are correct for their call sites today, but nothing enforces they stay consistent if a threshold moves in one place and not the other.

No magic-number problem of note — thresholds are consistently named constants (`LOCAL_MAX_KM`, `OVER_KM`, `CLEAR_KM`, `TRACK_MAX_KM`, `LINK_KM`, `STALE_RADAR_MIN`) defined near their use.

## 8. Performance hot spots (code-level)

`threat.ts`'s mass-segmentation (`segmentMasses`, line 438) and NCC motion estimate (`nccAtShift`/`bestNccShift`, lines 156–217) are the two O(n²)-shaped loops in the codebase. Both operate on already-aggregated/gridded samples, so `n` is bounded by `radar-grid.ts`'s aggregation rather than the ~100k raw tile pixels — the expensive O(pixels) work (`decodeFrame` in `server.ts`) runs server-side once per frame and is cached (`frameCache`, `sampleCached`). No per-frame reallocation issue client-side: `radar-map.tsx`'s `draw()` reuses one canvas and redraws only on MapLibre's `render` event, not an independent RAF loop.

## 9. Tooling gaps

- **No ESLint config anywhere** (`.eslintrc*`/`eslint.config.*` both absent) — the `eslint-disable: 0` count above is evidence lint isn't run at all, not that code is clean. Adding `typescript-eslint` with `no-floating-promises` would catch real bugs given several fire-and-forget `void someAsync()` calls that rely on the author remembering `void`.
- **No Prettier enforcement** — `.prettierrc` exists (`semi`, `singleQuote: false`, `printWidth: 100`) but there's no `format`/`format:check` script and no pre-commit hook, so it's aspirational.
- **No CI** — no `.github/workflows` directory. `npm test`/`npm run typecheck` run in well under a minute (706 ms suite) and would have caught both known failures on every PR; today they're only caught by a human running them locally.
- **No lint-staged/husky** — no pre-commit gate of any kind.
- `tsconfig.json` is otherwise strong: `strict: true`, `isolatedModules`, `skipLibCheck`, `noEmit`, path alias `@/*`.

## 10. Prioritized recommendations

1. Fix `imgw-time.test.ts:19–24` (pin `TZ` or fix the assertion) and `threat-sheet.test.ts:133` (delete the redundant post-narrowing assert) — quick, both currently make `npm test`/`tsc` red. *`src/lib/weather/imgw-time.test.ts`, `src/components/threat-sheet.test.ts`.*
2. Add a GitHub Actions workflow running `npm run typecheck && npm test` on PRs — near-zero cost, would have caught both failures above automatically.
3. Add `console.error` logging to every `.then(ok, fail)` failure branch so production failures leave a trace. *`src/lib/weather/server.ts` (~70–178), `src/lib/weather/snapshot.ts:62–80`.*
4. Add Zod schemas for the three external API responses (`ImgwWarningRaw[]`, `RainViewerMaps`, Nominatim) and parse instead of casting in `fetchJson`. *`src/lib/weather/server.ts`.*
5. Split `server.ts` into `server/radar.ts`, `server/warnings.ts`, `server/places.ts`, `server/sri.ts` with a thin `server.ts` re-exporting the three `createServerFn`s. *`src/lib/weather/server.ts`.*
6. Extract the settings sheet, search box, and geolocation handling out of `GromApp` into child components. *`src/components/grom-app.tsx` (95–951).*
7. Add ESLint (`typescript-eslint` + `no-floating-promises`) and a `format:check` script wired to CI. *Repo root.*
8. Add tests for `server.ts` (mock the fetch helpers) and `store.ts` (`sanitizeAlerts`, `loadAlertMemory`) — the two files with the most hand-written parsing have zero direct coverage. *New `src/lib/weather/server.test.ts`, `src/lib/store.test.ts`.*
9. Reconcile or cross-reference `stormNoun` (threat.ts:779) and `levelNounPl` (alerts.ts:156) so the two level→label ladders can't silently diverge. *`src/lib/weather/threat.ts`, `src/lib/weather/alerts.ts`.*
10. Extract named sub-steps out of `computeThreat`'s 358-line body (motion, ETA, chance, copy) — behavior is already pinned by `threat.test.ts`, so this is low-risk. *`src/lib/weather/threat.ts:790–1147`.*

## Scores (1–10)

| Area | Score | Why |
|---|---|---|
| Architecture | 7 | Clean one-way domain/UI boundary, real shared geo module; let down by an overloaded `server.ts` and an 857-line component. |
| Types | 6 | `strict: true` and good domain types, but Zod validates the wrong boundary — zero runtime checking of external API responses. |
| Tests | 7 | Deep, fast, readable coverage of the domain layer; `server.ts` and the store have none. |
| Error handling | 6 | Excellent partial-failure isolation in `snapshot.ts`, undermined by silently discarding every caught error with no logging anywhere. |
| Readability | 8 | Consistently well-commented, sensible naming, no dead code or magic numbers; hurt only by a few very long functions/components. |
| Tooling | 3 | No ESLint, no CI, no pre-commit gate, Prettier config unused — `tsconfig` strictness is the one bright spot. |
