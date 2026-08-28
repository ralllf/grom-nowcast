import type { RadarLevel } from "./types.ts";

/** RainViewer Universal Blue (color=2), rain column. Source: rainviewer_api_colors_table.csv */
export const UNIVERSAL_BLUE_RAIN: readonly {
  dbz: number;
  r: number;
  g: number;
  b: number;
  a: number;
}[] = [
  { dbz: 0, r: 130, g: 123, b: 105, a: 73 },
  { dbz: 1, r: 133, g: 125, b: 106, a: 78 },
  { dbz: 2, r: 136, g: 128, b: 108, a: 84 },
  { dbz: 3, r: 139, g: 130, b: 109, a: 89 },
  { dbz: 4, r: 142, g: 133, b: 111, a: 94 },
  { dbz: 5, r: 146, g: 136, b: 113, a: 100 },
  { dbz: 6, r: 158, g: 147, b: 117, a: 110 },
  { dbz: 7, r: 170, g: 158, b: 121, a: 120 },
  { dbz: 8, r: 182, g: 169, b: 126, a: 130 },
  { dbz: 9, r: 194, g: 180, b: 130, a: 140 },
  { dbz: 10, r: 206, g: 192, b: 135, a: 150 },
  { dbz: 11, r: 210, g: 196, b: 139, a: 160 },
  { dbz: 12, r: 214, g: 200, b: 143, a: 170 },
  { dbz: 13, r: 218, g: 204, b: 147, a: 180 },
  { dbz: 14, r: 222, g: 208, b: 151, a: 190 },
  { dbz: 15, r: 136, g: 221, b: 238, a: 255 },
  { dbz: 16, r: 108, g: 209, b: 235, a: 255 },
  { dbz: 17, r: 81, g: 197, b: 232, a: 255 },
  { dbz: 18, r: 54, g: 186, b: 229, a: 255 },
  { dbz: 19, r: 27, g: 174, b: 226, a: 255 },
  { dbz: 20, r: 0, g: 163, b: 224, a: 255 },
  { dbz: 21, r: 0, g: 154, b: 213, a: 255 },
  { dbz: 22, r: 0, g: 145, b: 202, a: 255 },
  { dbz: 23, r: 0, g: 136, b: 191, a: 255 },
  { dbz: 24, r: 0, g: 127, b: 180, a: 255 },
  { dbz: 25, r: 0, g: 119, b: 170, a: 255 },
  { dbz: 26, r: 0, g: 112, b: 163, a: 255 },
  { dbz: 27, r: 0, g: 105, b: 156, a: 255 },
  { dbz: 28, r: 0, g: 98, b: 149, a: 255 },
  { dbz: 29, r: 0, g: 91, b: 142, a: 255 },
  { dbz: 30, r: 0, g: 85, b: 136, a: 255 },
  { dbz: 31, r: 0, g: 81, b: 128, a: 255 },
  { dbz: 32, r: 0, g: 78, b: 120, a: 255 },
  { dbz: 33, r: 0, g: 74, b: 112, a: 255 },
  { dbz: 34, r: 0, g: 71, b: 104, a: 255 },
  { dbz: 35, r: 255, g: 238, b: 0, a: 255 },
  { dbz: 36, r: 255, g: 224, b: 0, a: 255 },
  { dbz: 37, r: 255, g: 210, b: 0, a: 255 },
  { dbz: 38, r: 255, g: 197, b: 0, a: 255 },
  { dbz: 39, r: 255, g: 183, b: 0, a: 255 },
  { dbz: 40, r: 255, g: 170, b: 0, a: 255 },
  { dbz: 41, r: 255, g: 159, b: 0, a: 255 },
  { dbz: 42, r: 255, g: 149, b: 0, a: 255 },
  { dbz: 43, r: 255, g: 139, b: 0, a: 255 },
  { dbz: 44, r: 255, g: 129, b: 0, a: 255 },
  { dbz: 45, r: 255, g: 68, b: 0, a: 255 },
  { dbz: 46, r: 242, g: 54, b: 0, a: 255 },
  { dbz: 47, r: 230, g: 40, b: 0, a: 255 },
  { dbz: 48, r: 217, g: 27, b: 0, a: 255 },
  { dbz: 49, r: 205, g: 13, b: 0, a: 255 },
  { dbz: 50, r: 193, g: 0, b: 0, a: 255 },
  { dbz: 51, r: 168, g: 0, b: 0, a: 255 },
  { dbz: 52, r: 143, g: 0, b: 0, a: 255 },
  { dbz: 53, r: 118, g: 0, b: 0, a: 255 },
  { dbz: 54, r: 93, g: 0, b: 0, a: 255 },
  { dbz: 55, r: 255, g: 170, b: 255, a: 255 },
  { dbz: 56, r: 255, g: 159, b: 255, a: 255 },
  { dbz: 57, r: 255, g: 149, b: 255, a: 255 },
  { dbz: 58, r: 255, g: 139, b: 255, a: 255 },
  { dbz: 59, r: 255, g: 129, b: 255, a: 255 },
  { dbz: 60, r: 255, g: 119, b: 255, a: 255 },
  { dbz: 61, r: 255, g: 108, b: 255, a: 255 },
  { dbz: 62, r: 255, g: 98, b: 255, a: 255 },
  { dbz: 63, r: 255, g: 88, b: 255, a: 255 },
  { dbz: 64, r: 255, g: 78, b: 255, a: 255 },
  { dbz: 65, r: 255, g: 255, b: 255, a: 255 },
];

/** RainViewer analysis tiles: unsmoothed, no snow tint. Overlay on the map stays `2/1_1`. */
export const ANALYSIS_COLOR_OPTIONS = "2/0_0";
export const OVERLAY_COLOR_OPTIONS = "2/1_1";

const EXACT = new Map<number, number>();
for (const c of UNIVERSAL_BLUE_RAIN) {
  EXACT.set((c.r << 16) | (c.g << 8) | c.b, c.dbz);
}

function pack(r: number, g: number, b: number) {
  return (r << 16) | (g << 8) | b;
}

/** Exact palette match, then nearest RGB among rain bins. */
export function rgbaToDbz(r: number, g: number, b: number, a: number): number | null {
  if (a < 40) return null;
  const hit = EXACT.get(pack(r, g, b));
  if (hit !== undefined) return hit;
  let bestD = 48 * 48 * 3;
  let best: number | null = null;
  for (const c of UNIVERSAL_BLUE_RAIN) {
    if (c.a < 40) continue;
    const dr = r - c.r;
    const dg = g - c.g;
    const db = b - c.b;
    const d = dr * dr + dg * dg + db * db;
    if (d < bestD) {
      bestD = d;
      best = c.dbz;
    }
  }
  return best;
}

export function dbzToLevel(dbz: number | null): RadarLevel {
  if (dbz === null || dbz < 15) return 0;
  if (dbz < 30) return 1;
  if (dbz < 40) return 2;
  if (dbz < 50) return 3;
  return 4;
}

export function rgbaToLevel(r: number, g: number, b: number, a: number): RadarLevel {
  return dbzToLevel(rgbaToDbz(r, g, b, a));
}
