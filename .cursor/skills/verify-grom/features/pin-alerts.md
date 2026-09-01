# Pin alerts

In-tab episode alerts (`idle → incoming → now → allclear`) for the current pin. Delivery is banner + optional Notification + Web Audio. Closed tab = no alerts. `Testuj alert` is the only deterministic UI path; live storms depend on radar.

## Sub-features

- Master toggle `Włącz` / `Włączone` (`Bell` / `BellOff`) under `Alerty na pinezkę`
- OS permission copy + `Zezwól` when `Notification` is `default`
- Presets `Czuły` (45 min / level 1 / 20%), `Normalny` (30 / 2 / 50), `Tylko pewne` (20 / 3 / 80)
- `Dźwięk` / `Bez dźwięku`, checkbox `„Przeszło” po burzy`, `Ciche godziny` (default 22→07)
- `Testuj alert` → title `Deszcz za ok. 18 min`, body contains `To tylko test alertu.`
- Banner `[role="status"][aria-live="assertive"]`, dismiss `aria-label="Zamknij alert"`
- Log `Ostatnie alerty` + `wyczyść`; persisted as `grom-alerts-v1` (max 12)
- Advanced `<details>` `Zaawansowane`: `aria-label="Wyprzedzenie alertu w minutach"`, intensity chips `słaby deszcz` / `deszcz` / `ulewa / burza`, `aria-label="Minimalna szansa alertu"`

## How to get to it (user POV)

Gear → `Lokalizacja i alerty` → `Włącz` under `Alerty na pinezkę`. Extra controls appear. `Testuj alert` shows the amber incoming banner even without OS permission (banner always works; sound/system notify need gesture + permission). Quiet hours keep the banner and drop sound/notify.

## Driving it with Chrome CDP

1. Open settings. If the toggle says `Włącz`, click it. Headless will usually stay `default`/`denied` for Notifications — that is fine; the button still becomes `Włączone`.
2. Click `Testuj alert`.
3. Assert `[role="status"][aria-live="assertive"]` contains `Deszcz za ok. 18 min` and the current pin label (e.g. `Warszawa`).
4. Click `Zamknij alert`. Banner gone; `Ostatnie alerty` still lists the title.
5. `localStorage.grom-alerts-v1` is a JSON array whose `[0].title` is `Deszcz za ok. 18 min`.

Do not wait for a real cell to fire `evaluateAlert` in a verification run.

## Gotchas

- Toggle does not require Notification permission (`enableAlerts` sets `enabled: true` even if denied).
- One event per episode stage; changing pin resets memory. Reloading mid-storm uses `grom-alert-memory-v1` only for the same pin and only while fresh (`EPISODE_TTL_MIN` 45).
- Radar older than 30 min never alerts (`STALE_RADAR_MIN`). Doctor already gates this.
- `primeSound()` needs a user gesture; CDP `.click()` counts. Autoplay policies may still mute — do not fail the run on missing audio.
- Quiet hours: banner stays, so a test during 22–07 still shows the status role if you left quiet hours on.
- Iframe / embedded preview is irrelevant for the test button; it only blocks GPS.
