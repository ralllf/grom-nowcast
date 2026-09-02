# Location pin

Chance, ETA, TERYT, and alert copy are computed for one pin (~5 km), not the alert-radius circle. The user sets the pin via city chip, Nominatim search, GPS, or a map click. Settings live in `localStorage` key `grom-settings-v1`.

## Sub-features

- Settings dialog `Lokalizacja i alerty` (gear)
- Twelve city chips (Warszawa … Rzeszów) from `CITIES` — first 12 only; Gdynia and later are search-only
- Search form: placeholder `Szukaj miasta w Polsce`, submit `Szukaj`
- GPS crosshair `aria-label="Wybierz lokalizację"` → label `Twoja lokalizacja`
- Map click → label `Punkt na mapie`, then reverse-geocode fills TERYT without changing the radar query key
- Default empty store: Warszawa `52.2297, 21.0122` TERYT `1465`
- Changing pin clears `alertMemory` and dismisses the banner (new episode)

## How to get to it (user POV)

Click the gear (`Ustawienia`) or the crosshair. The dialog is a modal (`role="dialog"` `aria-modal="true"`): Escape and a scrim tap close it; Tab stays inside. Pick a city chip or type ≥2 characters and `Szukaj`, then tap a result row (`{label}` + muted `{state}`). The dialog closes. The sheet’s place line updates (city name only — no `TERYT`). On a phone, GPS works; the “GPS blocked by this preview” line is only shown when `isEmbeddedPreview()`.

## Driving it with Chrome CDP

This is the default shipped drive (`--feature location-pin`).

1. Desktop 1280×800, `/`, wait until the sheet leaves `Skanuję radar…`. Quote the grey status row (`Radar HH:MM · N min · IMGW ✓/✕ · wyładowania ✓/✕`) and, if the 90-min strip is present, the Warsaw axis ticks (`HH:MM`, not `24 min`) plus the timeline aria sentence. The sheet must not show `Wyładowania chwilowo niedostępne` or `Ostrzeżenia IMGW chwilowo niedostępne` as separate sentences.
2. Click `button[aria-label="Ustawienia"]`. Wait for `[role="dialog"][aria-labelledby="settings-title"][aria-modal="true"]` and heading `Lokalizacja i alerty`.
3. Click the chip whose **exact** text is `Kraków` (TERYT `1261`, `50.0647, 19.945`).
4. Wait until the dialog is gone and `#grom-threat-sheet` contains `Kraków` and does **not** contain `TERYT`.
5. `Runtime.evaluate` `JSON.parse(localStorage.getItem('grom-settings-v1')).place.label` → `Kraków`.
6. Screenshots: sheet on Warszawa, dialog open, sheet on Kraków.

Search variant (optional): type `Zgorzelec` (chip exists too), submit `Szukaj`, click the result button that starts with `Zgorzelec`. Do not hammer Nominatim.

## Gotchas

- Chip highlight uses `place.label === c.label`. After a map click the label is `Punkt na mapie`, so no chip looks selected.
- GPS: `isEmbeddedPreview()` (`window.self !== window.top`) or missing `geolocation` opens settings with the iframe hint and does **not** call the API. A failed `getCurrentPosition` shows `GPS niedostępny. Wybierz miasto albo kliknij mapę.` on the sheet.
- MapLibre click is ignored for 400 ms after `pickPlace` (`ignoreMapClickUntil`) so the closing dialog does not retarget the pin.
- Crosshair in headless Chrome without a fake geolocation permission will take the failure path — do not treat that as a product bug.
- Radar snapshots are national; changing city must **not** require a different `queryKey` (`["snapshot"]`). You should not see a full “empty radar” flash if a snapshot is already cached (~90 s).
