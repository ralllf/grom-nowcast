# Radar map

Full-viewport MapLibre map: OpenFreeMap Positron (Esri Light Gray fallback after style error or 5 s), SRI 4-class PNG overlay (RainViewer tiles if SRI overlay query fails), pin + cyan radius, amber cell-track canvas, optional PERUN strike dots.

## Sub-features

- Basemap + `you` / `radius` GeoJSON sources; click sets `Punkt na mapie`
- SRI image source `radar` (800×800, aeqd corners) or RainViewer raster `…/2/1_0.png`
- Time scrub `aria-label="Czas radaru"` + `HH:MM` (appears when `overlays` or `past` length > 1)
- `niepełne` label when a RainViewer tile was missing
- `Pokaż mżawkę` (`aria-pressed`) — off by default; only mounted when SRI overlays exist
- `tor komórki` pill (`aria-pressed`) — **off by default**; turning it on draws amber cell-track arrows
- `pokaż` on that pill (fits bounds to nearest threatening track) — camera only; does not force arrows on
- Track arrows on the overlay canvas (`aria-hidden`, `pointer-events-none`) — not hit-testable; empty until the chip is on
- `focus` fly-to after `Pokaż ruch opadu na mapie`
- Bottom-right map chrome (`#grom-map-chrome`), above peek (128px): zoom `Przybliż` / `Oddal`, on-map locate (`Wybierz lokalizację`, same action as the header), compact legend (4 rain swatches + amber track glyph + IMGW tint), scale bar, visible `OpenFreeMap / OSM` credit (`#grom-map-credit`). `attributionControl` stays false — credit is the chrome line, not a control under the sheet.

## How to get to it (user POV)

`/` is the map. After the first snapshot, rain color should appear over Poland and the time pill sits under the header (~`top-24`). Drag the range to older scans; the clock on the right changes. Toggle `Pokaż mżawkę` to paint sub-class-1 drizzle. If arrows exist, tap `pokaż` to pan to the cell.

## Driving it with Chrome CDP

1. After a passing doctor with `analysisSource: sri` and `overlayCount > 0`, wait for `input[aria-label="Czas radaru"]`.
2. Read `input.value` / `max`. Set value to `0` via `Runtime.evaluate` (dispatch `input` + `change`) and assert the clock `<span>` text changes from the latest frame.
3. If `button` text `Pokaż mżawkę` exists: click it, assert `aria-pressed` flipped (`false` → `true`). Default is off (`drizzleMap` false).
4. If `tor komórki` is present: the chip button (text `tor komórki`, not `pokaż`) must have `aria-pressed="false"` on a fresh load. Screenshot — no orange track arrows. Optional: click the chip on (`aria-pressed` true) and screenshot to prove arrows still draw. `pokaż` still pans; it is not the overlay toggle.
5. Do not click the `aria-hidden` track canvas expecting a DOM event.

## Gotchas

- Slider is absent until the snapshot has ≥2 frames. Do not fail location/alert drives on a missing slider.
- `Pokaż mżawkę` is absent on RainViewer-only analysis (`overlays.length === 0`). Doctor’s `analysisSource` tells you which world you are in.
- MapLibre worker is loaded via `maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url`. A 404 there kills street labels; raster radar can still paint. If the map is a solid `--color-map` rectangle after 8 s, the worker/style failed — screenshot and stop.
- Style fallback is silent (Esri). You will not see an error toast.
- Overlay PNG is `getSriOverlay` (`drizzle` boolean). Toggling drizzle refetches; keep `placeholderData` so the old PNG stays until the new one arrives — a brief stale overlay is expected.
- National radar: panning the map does not refetch. Only time slider + drizzle + IMGW tint change layers.
