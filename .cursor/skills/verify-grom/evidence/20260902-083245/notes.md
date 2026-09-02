# Drive: pin-alerts

**Feature:** pin-alerts — enable in-tab alerts + `Testuj alert` (live weather did not fire an episode)
**Base:** http://127.0.0.1:8080 (this run’s Vite; not production)
**Out:** `.cursor/skills/verify-grom/evidence/20260902-083245`
**OK:** true
**When:** 2026-09-02T08:32:45.995Z → 2026-09-02T08:32:53.559Z

Doctor: worth driving. `analysisSource: sri`, radar age 1.9 min, `overlayCount: 4`. IMGW warnings and PERUN unavailable (skip those assertions). Sheet headline `Czysto`, echo ~53 km, ETA `minie` — no incoming episode on the pin, so the all-clear state machine was not exercised live. Units in `alerts.test.ts` are the proof for hysteresis / decayed-over-pin.

## Action → resulting state

Viewport `1280×800`. Fresh Chrome profile (empty `grom-settings-v1` / `grom-alerts-v1`). Sheet `#grom-threat-sheet` not `Skanuję radar…`.

| Control | Before | After |
|---|---|---|
| Sheet | `Warszawa` · `TERYT 1465` · `Czysto` · Szansa / ETA / Echo | unchanged (`Czysto`, Warszawa, stats still there) |
| `Alerty na pinezkę` | `Włącz` | `Włączone`; presets `Czuły` / `Normalny` / `Tylko pewne` visible |
| Banner `[role="status"][aria-live="assertive"]` | absent | `Deszcz za ok. 18 min` · Warszawa after `Testuj alert`; gone after `Zamknij alert` |
| `Ostatnie alerty` | empty | lists `Deszcz za ok. 18 min` |
| `grom-alerts-v1[0].title` | no key | `Deszcz za ok. 18 min` |

Live cell 53 km west→east at 46 km/h, miss ~89 km, Szansa 10 % — below Normalny gates (`leadMin` 30 / `minLevel` 2 / `minChancePct` 50). Did not open an episode. Did not print `przeszło` / `minęła bokiem`.

## Steps

1. `launch.sh` → Vite PID in `/tmp/verify-grom/launch.json`
2. `doctor.mjs` → `ok: true`, SRI overlays, IMGW/PERUN down
3. Chrome CDP 1280×800. Wait until sheet is not `Skanuję radar…`
4. Screenshot `01-sheet-before.png` — default Warszawa pin, `Czysto`
5. Click `button[aria-label="Ustawienia"]` → dialog `Lokalizacja i alerty`
6. Screenshot `02-settings-dialog.png`
7. Click `Włącz` under `Alerty na pinezkę` → `Włączone`, `Testuj alert` appears
8. Click `Testuj alert` → banner title `Deszcz za ok. 18 min`, pin `Warszawa`
9. Screenshot `03-test-banner.png`
10. Click `button[aria-label="Zamknij alert"]` → banner gone; log still has the title
11. Close dialog. Screenshot `04-sheet-after.png` — sheet still Warszawa / Szansa / ETA / Echo

## Side effects

- `grom-alerts-v1[0].title` = `Deszcz za ok. 18 min` (throwaway Chrome profile).
- Alerts enabled in that profile only. No place change.

## Screenshots

- `01-sheet-before.png` — sheet after snapshot, default Warszawa pin
- `02-settings-dialog.png` — dialog `Lokalizacja i alerty` open, alerts still `Włącz`
- `03-test-banner.png` — alerts `Włączone`, `Testuj alert` fired
- `04-sheet-after.png` — dialog closed, sheet unchanged

Mocks: none. Radar snapshot is the live IMGW/RainViewer boundary already checked by doctor.
