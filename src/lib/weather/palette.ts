import type { RadarLevel } from "./types.ts";

/**
 * RainViewer "Universal Blue" (color scheme 2) — exact dBZ → RGB table from
 * https://www.rainviewer.com/files/rainviewer_api_colors_table.csv (rain palette,
 * i.e. tiles requested with `snow=0`). Below 15 dBZ the palette is a translucent
 * beige that we treat as "no precipitation".
 *
 * We request tiles with `smooth=0` so every pixel is one of these exact colours;
 * a nearest-colour fallback covers antialiasing / future palette tweaks.
 */
const UNIVERSAL_BLUE: ReadonlyArray<readonly [dbz: number, rgb: number]> = [
  [15, 0x88ddee],
  [16, 0x6cd1eb],
  [17, 0x51c5e8],
  [18, 0x36bae5],
  [19, 0x1baee2],
  [20, 0x00a3e0],
  [21, 0x009ad5],
  [22, 0x0091ca],
  [23, 0x0088bf],
  [24, 0x007fb4],
  [25, 0x0077aa],
  [26, 0x0070a3],
  [27, 0x00699c],
  [28, 0x006295],
  [29, 0x005b8e],
  [30, 0x005588],
  [31, 0x005180],
  [32, 0x004e78],
  [33, 0x004a70],
  [34, 0x004768],
  [35, 0xffee00],
  [36, 0xffe000],
  [37, 0xffd200],
  [38, 0xffc500],
  [39, 0xffb700],
  [40, 0xffaa00],
  [41, 0xff9f00],
  [42, 0xff9500],
  [43, 0xff8b00],
  [44, 0xff8100],
  [45, 0xff4400],
  [46, 0xf23600],
  [47, 0xe62800],
  [48, 0xd91b00],
  [49, 0xcd0d00],
  [50, 0xc10000],
  [51, 0xa80000],
  [52, 0x8f0000],
  [53, 0x760000],
  [54, 0x5d0000],
  [55, 0xffaaff],
  [56, 0xff9fff],
  [57, 0xff95ff],
  [58, 0xff8bff],
  [59, 0xff81ff],
  [60, 0xff77ff],
  [61, 0xff6cff],
  [62, 0xff62ff],
  [63, 0xff58ff],
  [64, 0xff4eff],
  [65, 0xffffff],
  [75, 0x00ff00],
];

const EXACT = new Map<number, number>(UNIVERSAL_BLUE.map(([dbz, rgb]) => [rgb, dbz]));

/** Max RGB distance (Euclidean) for the nearest-colour fallback; beyond this → no echo. */
const NEAREST_MAX = 28;

export function dbzFromRgba(r: number, g: number, b: number, a: number): number | null {
  // Palette entries ≥ 15 dBZ are fully opaque; the beige < 15 dBZ ramp is translucent.
  if (a < 200) return null;
  const rgb = (r << 16) | (g << 8) | b;
  const exact = EXACT.get(rgb);
  if (exact !== undefined) return exact;
  let best: number | null = null;
  let bestD = NEAREST_MAX * NEAREST_MAX;
  for (const [dbz, c] of UNIVERSAL_BLUE) {
    const dr = r - (c >> 16);
    const dg = g - ((c >> 8) & 0xff);
    const db = b - (c & 0xff);
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = dbz;
    }
  }
  return best;
}

/** Marshall–Palmer Z = 200·R^1.6 → rain rate in mm/h. */
export function rateFromDbz(dbz: number): number {
  return Math.pow(Math.pow(10, dbz / 10) / 200, 1 / 1.6);
}

/**
 * Intensity classes in mm/h (MeteoSwiss-style bands, collapsed to four):
 *   1 słaby        0.1–1 mm/h   (≈15–23 dBZ, light blue)
 *   2 umiarkowany  1–4 mm/h     (≈24–32 dBZ, dark blue)
 *   3 silny        4–10 mm/h    (≈33–39 dBZ, yellow/orange)
 *   4 ulewny       ≥ 10 mm/h    (≥ 40 dBZ, orange/red/pink; hail cores ≥ 55 dBZ)
 */
export const LEVEL_MIN_RATE: Record<Exclude<RadarLevel, 0>, number> = { 1: 0.1, 2: 1, 3: 4, 4: 10 };

export function levelFromRate(rate: number): RadarLevel {
  if (rate >= LEVEL_MIN_RATE[4]) return 4;
  if (rate >= LEVEL_MIN_RATE[3]) return 3;
  if (rate >= LEVEL_MIN_RATE[2]) return 2;
  if (rate >= LEVEL_MIN_RATE[1]) return 1;
  return 0;
}

/** ≥ 55 dBZ (≈ 100 mm/h equivalent) — reflectivity that usually means hail, not rain. */
export const HAIL_RATE = rateFromDbz(55);

export function levelLabelPl(level: RadarLevel): string {
  switch (level) {
    case 1:
      return "słaby";
    case 2:
      return "umiarkowany";
    case 3:
      return "silny";
    case 4:
      return "ulewny";
    default:
      return "brak";
  }
}

/** Representative swatch per class for legends (taken from the palette). */
export const LEVEL_SWATCH: Record<RadarLevel, string> = {
  0: "transparent",
  1: "#36bae5",
  2: "#005b8e",
  3: "#ffc500",
  4: "#e62800",
};
