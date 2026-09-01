# Drive: radar-map-chips

**Feature:** radar-map (map chips at desktop 1280×800)
**Base:** http://127.0.0.1:8080 (this run’s Vite; not production)
**Out:** `/workspace/.cursor/skills/verify-grom/evidence/20260901-161620`
**OK:** true
**When:** 2026-09-01T16:16:20Z → 2026-09-01T16:17:20Z

Doctor: worth driving. `analysisSource: sri`, `overlayCount: 4`, radar age 5.8 min. IMGW warnings and PERUN unavailable (skip those assertions).

## Action → resulting state

Viewport `1280×800`. Sheet `#grom-threat-sheet` top **300px**, height **480px** (`calc(100dvh-20rem)`).

| Control | Before | After |
|---|---|---|
| `pokaż` on `tor komórki` | present; `elementFromPoint` = self; `overlapsSheet=false`; rect top 166–182 | clicked; map still up (`canvas` 1280×800, no `Coś poszło nie tak`). `pokaż` has no `aria-pressed` — it calls `fitBounds` on the nearest threatening track. |
| `Pokaż mżawkę` | `aria-pressed="false"`; hit-self; no sheet overlap; rect top 196–224 | `aria-pressed="false"` → **`aria-pressed="true"`** after React paint. |

Pills are not under the sheet: sheet top 300px, drizzle bottom 224px (~76px gap). Same `z-10` stacking; the height cap is what keeps the left column off the chips.

## Honesty paragraph (quoted from live DOM)

> Szansa, ETA i alert są dla pinezki (Warszawa) — miasta albo punktu na mapie — nie dla koła w okolicy. Próg alertu to czas, nie dystans. Na mapie strzałki to pole ruchu; te, które dotyczą pinezki, mówią czy opad dojdzie.

`leadMin` is **not** in that paragraph (`hasLeadMin: false`).

## Steps

1. `launch.sh` → Vite PID in `/tmp/verify-grom/launch.json`
2. `doctor.mjs` → `ok: true`, SRI overlays
3. Chrome CDP 1280×800, wait until sheet is not `Skanuję radar…`
4. Screenshot `01-before-chips.png`; measure geometry (`geom-before.json`)
5. Click `pokaż`; map remains; no error overlay
6. Click `Pokaż mżawkę`; `aria-pressed` becomes `true`
7. Scroll honesty `<p>` into view; screenshot `03-honesty-paragraph.png`

## Side effects

- `drizzleMap` toggled on (session only; throwaway Chrome profile).
- Map camera `fitBounds` after `pokaż` (no `localStorage` change).
- `grom-settings-v1` place stayed Warszawa TERYT 1465.

## Screenshots

- `01-before-chips.png` — chips above the sheet, drizzle off
- `02-after-clicks.png` — after first pass (chips still clear of the sheet)
- `03-honesty-paragraph.png` — honesty copy scrolled into view, no `leadMin`

Mocks: none. Live IMGW SRI snapshot.

## Unit assertion

`src/components/threat-sheet.test.ts` — `does not leak leadMin into the honesty paragraph`.
`npm test`: 238 pass, 0 fail.
