import { aeqdInverse } from "./aeqd.ts";
import { OVERLAY_COLOR_OPTIONS, LEVEL_MIN_RATE, LEVEL_SWATCH, levelFromRate } from "./palette.ts";
import type { SriGrid } from "./sri.ts";
import type { OverlayCorners, RadarLevel, SriOverlayMeta } from "./types.ts";

export type { OverlayCorners, SriOverlayMeta };

export const DRIZZLE_MAP_DEFAULT = false;

export function readDrizzleToggle(raw: unknown): boolean {
  return typeof raw === "boolean" ? raw : DRIZZLE_MAP_DEFAULT;
}

export type RadarLayer =
  | { kind: "sri"; url: string; corners: OverlayCorners }
  | { kind: "rainviewer"; tiles: string[] }
  | { kind: "none" };

export const SWATCH_RGB: Record<Exclude<RadarLevel, 0>, readonly [number, number, number]> = {
  1: hexRgb(LEVEL_SWATCH[1]),
  2: hexRgb(LEVEL_SWATCH[2]),
  3: hexRgb(LEVEL_SWATCH[3]),
  4: hexRgb(LEVEL_SWATCH[4]),
};

function hexRgb(hex: string): [number, number, number] {
  const h = hex.startsWith("#") ? hex.slice(1) : hex;
  return [Number.parseInt(h.slice(0, 2), 16), Number.parseInt(h.slice(2, 4), 16), Number.parseInt(h.slice(4, 6), 16)];
}

const RGB_TO_CLASS = new Map<number, RadarLevel>(
  (Object.entries(SWATCH_RGB) as Array<[string, readonly [number, number, number]]>).map(([lvl, rgb]) => [
    (rgb[0] << 16) | (rgb[1] << 8) | rgb[2],
    Number(lvl) as RadarLevel,
  ]),
);

/** Same class rules as analysis: nodata/undetect / rate < 0.1 → 0, else levelFromRate. */
export function classesFromSriGrid(data: ArrayLike<number>, grid: SriGrid): Uint8Array {
  const n = grid.nx * grid.ny;
  const classes = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const raw = Number(data[i]);
    if (!Number.isFinite(raw) || raw === grid.nodata || raw === grid.undetect) continue;
    const rate = raw * grid.gain + grid.offset;
    if (rate < LEVEL_MIN_RATE[1]) continue;
    classes[i] = levelFromRate(rate);
  }
  return classes;
}

/** Default (drizzle off) matches analysis. On: 0 < rate < 0.1 becomes klasa 1. */
export function paintOverlayClasses(
  data: ArrayLike<number>,
  grid: SriGrid,
  drizzle: boolean,
): Uint8Array {
  const classes = classesFromSriGrid(data, grid);
  if (!drizzle) return classes;
  const n = classes.length;
  for (let i = 0; i < n; i++) {
    if (classes[i] !== 0) continue;
    const raw = Number(data[i]);
    if (!Number.isFinite(raw) || raw === grid.nodata || raw === grid.undetect) continue;
    const rate = raw * grid.gain + grid.offset;
    if (rate > 0 && rate < LEVEL_MIN_RATE[1]) classes[i] = 1;
  }
  return classes;
}

export function classFromOverlayRgba(r: number, g: number, b: number, a: number): RadarLevel {
  if (a < 8) return 0;
  return RGB_TO_CLASS.get((r << 16) | (g << 8) | b) ?? 0;
}

/** Outer corners of the aeqd raster, in MapLibre image-source order. */
export function overlayCorners(grid: SriGrid): OverlayCorners {
  const xW = (0 - grid.nx / 2) * grid.xscale;
  const xE = (grid.nx - grid.nx / 2) * grid.xscale;
  const yN = (grid.ny / 2 - 0) * grid.yscale;
  const yS = (grid.ny / 2 - grid.ny) * grid.yscale;
  const tl = aeqdInverse(xW, yN, grid.lat0, grid.lon0, grid.radiusM);
  const tr = aeqdInverse(xE, yN, grid.lat0, grid.lon0, grid.radiusM);
  const br = aeqdInverse(xE, yS, grid.lat0, grid.lon0, grid.radiusM);
  const bl = aeqdInverse(xW, yS, grid.lat0, grid.lon0, grid.radiusM);
  return [
    [tl.lon, tl.lat],
    [tr.lon, tr.lat],
    [br.lon, br.lat],
    [bl.lon, bl.lat],
  ];
}

export function pickRadarLayer(live: {
  overlayUrl: string | null;
  overlayCorners: OverlayCorners | null;
  radarHost: string | null;
  radarPath: string | null;
}): RadarLayer {
  if (live.overlayUrl && live.overlayCorners) {
    return { kind: "sri", url: live.overlayUrl, corners: live.overlayCorners };
  }
  if (live.radarHost && live.radarPath) {
    return {
      kind: "rainviewer",
      tiles: [`${live.radarHost}${live.radarPath}/256/{z}/{x}/{y}/${OVERLAY_COLOR_OPTIONS}.png`],
    };
  }
  return { kind: "none" };
}

/** Decide whether to paint the SRI PNG, RainViewer tiles, or wait. */
export function overlayFallback(opts: {
  overlaysAvailable: boolean;
  png: string | null;
  queryError: boolean;
  queryFetched: boolean;
  isPlaceholder: boolean;
}): { useSri: boolean; useRainviewer: boolean } {
  if (opts.png) return { useSri: true, useRainviewer: false };
  if (!opts.overlaysAvailable) return { useSri: false, useRainviewer: true };
  if (opts.queryError) return { useSri: false, useRainviewer: true };
  if (opts.queryFetched && !opts.isPlaceholder && !opts.png) {
    return { useSri: false, useRainviewer: true };
  }
  return { useSri: false, useRainviewer: false };
}
