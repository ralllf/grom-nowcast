import { cellKey } from "./spatial-hash.ts";
import type { RadarSample } from "./types.ts";

/** ~0.4° (~28–44 km in PL). Enough cells that a 5k cap cannot starve the south. */
export const SAMPLE_CAP_CELL_DEG = 0.4;

/**
 * Keep at most `maxN` samples by round-robin across spatial-hash cells
 * (strongest remaining in each cell). Sort-then-slice by latitude is biased north.
 */
export function capSamplesFairly(
  samples: RadarSample[],
  maxN: number,
  cellDeg = SAMPLE_CAP_CELL_DEG,
): RadarSample[] {
  if (samples.length <= maxN) return samples;
  const buckets = new Map<string, RadarSample[]>();
  for (const s of samples) {
    const key = cellKey(s.lat, s.lon, cellDeg);
    const g = buckets.get(key);
    if (g) g.push(s);
    else buckets.set(key, [s]);
  }
  const queues = [...buckets.values()];
  for (const q of queues) q.sort((a, b) => b.level - a.level);
  const out: RadarSample[] = [];
  let round = 0;
  while (out.length < maxN) {
    let added = false;
    for (const q of queues) {
      const s = q[round];
      if (!s) continue;
      out.push(s);
      added = true;
      if (out.length >= maxN) break;
    }
    if (!added) break;
    round++;
  }
  return out;
}
