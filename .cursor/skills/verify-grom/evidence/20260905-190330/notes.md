# Drive: nowcast-threat-sheet

**Base:** http://127.0.0.1:8080
**Out:** /workspace/.cursor/skills/verify-grom/evidence/20260905-190330
**OK:** false
**When:** 2026-09-05T19:03:30.687Z → 2026-09-05T19:03:35.642Z

## Action → state

sheet missing status row: "Deszcz nadciąga\nZARAZ\n\nWarszawa\n\nZa ile\n16 min\nSzansa\n90%\n21:00\n21:30\n22:00\n22:30"

## Steps

1. viewport 390x844 (phone)
2. navigate http://127.0.0.1:8080/

## Side effects

- none recorded

## Addendum (harness fix, same branch)

This failure was a drive.mjs race, not an app bug: the phone auto-expanded peek → half
(storm over Warszawa, level `imminent`) between the readiness poll and the state read, so the
status-row check ran against stale peek text. drive.mjs now re-reads the sheet text when the
initial state is not collapsed. The re-run (`../20260905-190417/`) passes with the same storm.

## Screenshots

- `01-peek-390x844.png` — phone peek: headline, chip, place, hero `Za ile`, `Szansa`, 90-min strip
- `02-half-390x844.png` — after the handle tap: `Idzie od` / `Spodziewaj się`, one caveat, status row
- `peek.json` — quoted detent, heights, font sizes, nested-scroller count, sheet text

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
