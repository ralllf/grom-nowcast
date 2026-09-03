# Drive: radar-map (map chips at 1280×800)

**Feature:** radar-map — **tor komórki** / **Pokaż mżawkę** via real mouse click (CDP `Input.dispatchMouseEvent`) while the threat sheet is open.
**Base:** http://127.0.0.1:8080
**Out:** .cursor/skills/verify-grom/evidence/20260903-123514
**OK:** true
**When:** 2026-09-03T12:35:23.554Z → 2026-09-03T12:35:26.747Z

## Action → state

tor komórki aria-pressed false → true (mouse hit-self, not sheet). Pokaż mżawkę aria-pressed false → true (mouse hit-self, not sheet). Sheet open at 1280×800. leadMin=false.

## Steps

1. navigate http://127.0.0.1:8080/
2. sheet ready (open): Czysto | CZYSTO |  | Warszawa
3. viewport 1280×800; sheet top=300 h=480 open
4. honesty: Szansa, Za ile i alert są dla pinezki (Warszawa) — miasta albo punktu na mapie — nie dla koła w okolicy. Próg alertu to czas, nie dystans. Na mapie strzałki to pole ruchu; te, które dotyczą pinezki, mówią czy opad dojdzie.
5. leadMin in sheet: false
6. tor komórki before aria-pressed=false hit="tor komórki" @76,178 (sheet open)
7. tor komórki after aria-pressed=true (toggled while sheet open)
8. Pokaż mżawkę before aria-pressed=false hit="Pokaż mżawkę" @84,222 (sheet open)
9. Pokaż mżawkę after aria-pressed=true (toggled while sheet open)

## Screenshots

- `01-chips-before.png` — desktop 1280×800, chips off, sheet open
- `02-chips-after.png` — after mouse clicks; `aria-pressed` toggled

`GROWTH_MATH_ENABLED` stays **false**.

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
