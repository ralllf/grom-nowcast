import assert from "node:assert/strict";
import test from "node:test";
import { PNG } from "pngjs";
import { LEVEL_MIN_RATE, LEVEL_SWATCH, levelFromRate } from "./palette.ts";
import { POLCOMP_SRI_GRID } from "./sri.ts";
import {
  attachSriOverlays,
  encodeClassPng,
  rememberSriOverlay,
  resetSriOverlayCache,
  sriOverlayMetaFor,
  sriOverlayPng,
} from "./sri-overlay-png.ts";
import {
  DRIZZLE_MAP_DEFAULT,
  classesFromSriGrid,
  classFromOverlayRgba,
  overlayCorners,
  overlayFallback,
  paintOverlayClasses,
  pickRadarLayer,
  readDrizzleToggle,
} from "./sri-overlay.ts";

function tinyGrid() {
  return { ...POLCOMP_SRI_GRID, nx: 4, ny: 4 };
}

function rainyField() {
  const grid = tinyGrid();
  const data = new Float32Array(grid.nx * grid.ny).fill(-2);
  // Analysis classes: 4, 3, 2, 1, drizzle, dry, undetect.
  data[0] = 12.5;
  data[1] = 6;
  data[2] = 2;
  data[3] = 0.4;
  data[4] = 0.05;
  data[5] = 0;
  data[6] = -1;
  return { grid, data };
}

test("classesFromSriGrid matches analysis: levelFromRate, drop < 0.1, skip nodata/undetect", () => {
  const { grid, data } = rainyField();
  const classes = classesFromSriGrid(data, grid);
  assert.equal(classes[0], 4);
  assert.equal(classes[1], 3);
  assert.equal(classes[2], 2);
  assert.equal(classes[3], 1);
  assert.equal(classes[4], 0, "mżawka below klasa 1 is not counted");
  assert.equal(classes[5], 0);
  assert.equal(classes[6], 0);
  assert.equal(classes[7], 0);
  for (let i = 0; i < data.length; i++) {
    const raw = data[i]!;
    const rate = raw * grid.gain + grid.offset;
    const expected =
      raw === grid.nodata || raw === grid.undetect || rate < LEVEL_MIN_RATE[1]
        ? 0
        : levelFromRate(rate);
    assert.equal(classes[i], expected, `pixel ${i}`);
  }
});

test("drizzle off is the default; on paints sub-0.1 rates as klasa 1", () => {
  const { grid, data } = rainyField();
  const off = paintOverlayClasses(data, grid, false);
  const on = paintOverlayClasses(data, grid, true);
  assert.equal(off[4], 0);
  assert.equal(on[4], 1);
  assert.equal(on[5], 0, "exact zero stays clean");
  assert.equal(on[6], 0, "undetect is not mżawka");
  assert.equal(on[0], 4);
  assert.deepEqual(off, classesFromSriGrid(data, grid));
});

test("pixel-compare overlay PNG vs analysis classes: zero disagreement", () => {
  const { grid, data } = rainyField();
  const analysis = classesFromSriGrid(data, grid);
  const png = encodeClassPng(analysis, grid.nx, grid.ny);
  const decoded = PNG.sync.read(png);
  assert.equal(decoded.width, grid.nx);
  assert.equal(decoded.height, grid.ny);
  let disagreements = 0;
  for (let i = 0; i < analysis.length; i++) {
    const idx = i << 2;
    const got = classFromOverlayRgba(
      decoded.data[idx]!,
      decoded.data[idx + 1]!,
      decoded.data[idx + 2]!,
      decoded.data[idx + 3]!,
    );
    if (got !== analysis[i]) disagreements++;
  }
  assert.equal(disagreements, 0);
});

test("Czysto field encodes as a fully transparent PNG", () => {
  const grid = tinyGrid();
  const data = new Float32Array(grid.nx * grid.ny).fill(-1);
  const png = encodeClassPng(classesFromSriGrid(data, grid), grid.nx, grid.ny);
  const decoded = PNG.sync.read(png);
  for (let i = 3; i < decoded.data.length; i += 4) {
    assert.equal(decoded.data[i], 0);
  }
});

test("overlay pixels use exactly the four legend swatches (plus transparent)", () => {
  const { grid, data } = rainyField();
  const png = encodeClassPng(paintOverlayClasses(data, grid, true), grid.nx, grid.ny);
  const decoded = PNG.sync.read(png);
  const allowed = new Set<string>(["0,0,0,0"]);
  for (const level of [1, 2, 3, 4] as const) {
    const hex = LEVEL_SWATCH[level].slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    allowed.add(`${r},${g},${b},255`);
  }
  for (let i = 0; i < decoded.data.length; i += 4) {
    const key = `${decoded.data[i]},${decoded.data[i + 1]},${decoded.data[i + 2]},${decoded.data[i + 3]}`;
    assert.ok(allowed.has(key), `foreign colour ${key}`);
  }
});

test("overlay corners are MapLibre image-source lon/lat quads (TL TR BR BL)", () => {
  const c = overlayCorners(POLCOMP_SRI_GRID);
  assert.equal(c.length, 4);
  const [tl, tr, br, bl] = c;
  assert.ok(tl![1] > bl![1], "top is north of bottom");
  assert.ok(tr![0] > tl![0], "right is east of left");
  assert.ok(br![0] > bl![0]);
  assert.ok(tr![1] > br![1]);
  // Poland-ish: origin 19.09E 52.35N, grid ~465 km half-width.
  for (const [lon, lat] of c) {
    assert.ok(lon > 10 && lon < 30, `lon ${lon}`);
    assert.ok(lat > 46 && lat < 58, `lat ${lat}`);
  }
});

test("Pokaż mżawkę defaults off and only accepts a boolean", () => {
  assert.equal(DRIZZLE_MAP_DEFAULT, false);
  assert.equal(readDrizzleToggle(undefined), false);
  assert.equal(readDrizzleToggle(null), false);
  assert.equal(readDrizzleToggle("yes"), false);
  assert.equal(readDrizzleToggle(true), true);
  assert.equal(readDrizzleToggle(false), false);
});

test("a national-scale rainy PNG stays under the 100 kB budget", () => {
  const grid = POLCOMP_SRI_GRID;
  const classes = new Uint8Array(grid.nx * grid.ny);
  // Spatially correlated frontal band (~35 % of columns) — real SRI looks like this,
  // not salt-and-pepper. Indexed PNG then sits well under the 50–100 kB cap.
  for (let i = 0; i < classes.length; i++) {
    const col = i % grid.nx;
    const row = (i - col) / grid.nx;
    if (col > 180 && col < 460 && Math.abs(row - 400) < 280) {
      classes[i] = (1 + ((col + row) % 4)) as 1 | 2 | 3 | 4;
    }
  }
  const png = encodeClassPng(classes, grid.nx, grid.ny);
  assert.ok(png.byteLength > 500, `empty encode: ${png.byteLength}`);
  assert.ok(png.byteLength <= 100_000, `network budget ${png.byteLength} > 100 kB`);
});

test("remembered overlay PNG matches analysis; unknown time is null", () => {
  resetSriOverlayCache();
  const { grid, data } = rainyField();
  rememberSriOverlay(1_700_000_600, data, grid);
  const png = sriOverlayPng(1_700_000_600, false);
  assert.ok(png);
  const decoded = PNG.sync.read(png);
  const analysis = classesFromSriGrid(data, grid);
  let disagreements = 0;
  for (let i = 0; i < analysis.length; i++) {
    const idx = i << 2;
    const got = classFromOverlayRgba(
      decoded.data[idx]!,
      decoded.data[idx + 1]!,
      decoded.data[idx + 2]!,
      decoded.data[idx + 3]!,
    );
    if (got !== analysis[i]) disagreements++;
  }
  assert.equal(disagreements, 0);
  assert.equal(sriOverlayPng(1, false), null);
  const meta = sriOverlayMetaFor(1_700_000_600);
  assert.equal(meta?.time, 1_700_000_600);
  assert.equal(meta?.corners.length, 4);
  const withDrizzle = sriOverlayPng(1_700_000_600, true);
  assert.ok(withDrizzle);
  const ddec = PNG.sync.read(withDrizzle);
  const drizzleClass = classFromOverlayRgba(ddec.data[16]!, ddec.data[17]!, ddec.data[18]!, ddec.data[19]!);
  assert.equal(drizzleClass, 1, "pixel 4 (0.05 mm/h) is klasa 1 only with mżawka on");
});

test("attachSriOverlays fills metas on SRI and clears them on RainViewer fallback", () => {
  resetSriOverlayCache();
  const { grid, data } = rainyField();
  rememberSriOverlay(100, data, grid);
  const scan = {
    host: "https://tilecache.rainviewer.com",
    generated: 100,
    latestTime: 100,
    past: [{ time: 100, path: "/v2/radar/100" }],
    nowcast: [],
    samples: [],
    prevSamples: [],
    prevTime: null,
    history: [
      { time: 100, samples: [], maxLevel: 1 as const, nearestKm: null },
    ],
    cellKm: 3,
    maxLevel: 1 as const,
    nearestKm: null,
    echoCount: 1,
    analysisSource: "sri" as const,
  };
  const sri = attachSriOverlays(scan, "sri");
  assert.equal(sri.overlays?.length, 1);
  assert.equal(sri.overlay?.time, 100);
  const rv = attachSriOverlays(scan, "rainviewer");
  assert.deepEqual(rv.overlays, []);
  assert.equal(rv.overlay, null);
});

test("overlayFallback keeps SRI when a PNG exists, RainViewer on miss/error, blank while pending", () => {
  assert.deepEqual(
    overlayFallback({ overlaysAvailable: true, png: "x", queryError: false, queryFetched: true, isPlaceholder: false }),
    { useSri: true, useRainviewer: false },
  );
  assert.deepEqual(
    overlayFallback({ overlaysAvailable: true, png: null, queryError: true, queryFetched: true, isPlaceholder: false }),
    { useSri: false, useRainviewer: true },
  );
  assert.deepEqual(
    overlayFallback({ overlaysAvailable: true, png: null, queryError: false, queryFetched: true, isPlaceholder: false }),
    { useSri: false, useRainviewer: true },
    "null PNG after a finished fetch is a fallback, not a blank map",
  );
  assert.deepEqual(
    overlayFallback({ overlaysAvailable: true, png: null, queryError: false, queryFetched: false, isPlaceholder: false }),
    { useSri: false, useRainviewer: false },
    "first paint waits for SRI so RainViewer drizzle does not flash",
  );
  assert.deepEqual(
    overlayFallback({ overlaysAvailable: false, png: null, queryError: false, queryFetched: false, isPlaceholder: false }),
    { useSri: false, useRainviewer: true },
  );
});

test("overlayFallback does not treat a placeholder PNG as current SRI", () => {
  assert.deepEqual(
    overlayFallback({
      overlaysAvailable: true,
      png: "data:image/png;base64,xx",
      queryError: false,
      queryFetched: false,
      isPlaceholder: true,
    }),
    { useSri: false, useRainviewer: false },
    "keepPreviousData PNG is stale, not the current frame",
  );
});

test("pickRadarLayer prefers SRI image source and falls back to RainViewer tiles", () => {
  const corners = overlayCorners(tinyGrid());
  assert.deepEqual(
    pickRadarLayer({
      overlayUrl: "data:image/png;base64,xx",
      overlayCorners: corners,
      radarHost: "https://tilecache.rainviewer.com",
      radarPath: "/v2/radar/1",
    }),
    { kind: "sri", url: "data:image/png;base64,xx", corners },
  );
  assert.deepEqual(
    pickRadarLayer({
      overlayUrl: null,
      overlayCorners: null,
      radarHost: "https://tilecache.rainviewer.com",
      radarPath: "/v2/radar/1",
    }),
    {
      kind: "rainviewer",
      tiles: ["https://tilecache.rainviewer.com/v2/radar/1/256/{z}/{x}/{y}/2/1_0.png"],
    },
  );
  assert.deepEqual(
    pickRadarLayer({
      overlayUrl: null,
      overlayCorners: corners,
      radarHost: null,
      radarPath: null,
    }),
    { kind: "none" },
  );
});
