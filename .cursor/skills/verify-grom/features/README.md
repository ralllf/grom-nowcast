# GROM feature map

User-facing surface is one route: `/`. There is no `/settings`, `/alerts`, or `/map` URL. Features are regions of `GromApp` + `ThreatSheet` + `RadarMap`.

Drive against a doctor-passing local Vite instance (`http://127.0.0.1:8080`). Hindcast (`npm run hindcast`) is a CLI scorecard, not a page — do not treat it as a UI feature.

| File | What the user is doing |
|---|---|
| [nowcast-threat-sheet.md](nowcast-threat-sheet.md) | Reading chance / ETA / echo / timeline for the pin |
| [location-pin.md](location-pin.md) | Choosing Warszawa, a chip, search, GPS, or a map click |
| [pin-alerts.md](pin-alerts.md) | Enabling in-tab alerts and firing `Testuj alert` |
| [radar-map.md](radar-map.md) | Radar overlay, time scrub, drizzle, cell-track arrows |
| [imgw-warnings.md](imgw-warnings.md) | Official IMGW list + optional powiat tint |

`npm test` covers threat/alert math. These files are for driving the rendered UI.
