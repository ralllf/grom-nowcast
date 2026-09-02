/** Visible on-map legal credit. Sheet footer is hidden under the peek fold. */
export const MAP_CREDIT = "OpenFreeMap / OSM";

const NICE_M = [50, 100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000] as const;

/** Web Mercator metres-per-pixel at `lat` / `zoom`, then the nearest nice length. */
export function scaleBar(
  zoom: number,
  lat: number,
  targetPx = 64,
): { label: string; widthPx: number } {
  const mPerPx = (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
  const targetM = Math.max(1, mPerPx * targetPx);
  let best: (typeof NICE_M)[number] = NICE_M[0];
  for (const n of NICE_M) {
    if (Math.abs(Math.log(n / targetM)) < Math.abs(Math.log(best / targetM))) best = n;
  }
  return {
    label: best >= 1000 ? `${best / 1000} km` : `${best} m`,
    widthPx: Math.round(best / mPerPx),
  };
}
