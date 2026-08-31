import { framesFromScan } from "./pack.ts";
import type { RadarMemoryFrame, RadarScan } from "./types.ts";

/** Oldest → newest frames with samples materialised (packed or legacy shape). */
export function radarHistoryFromScan(radar: RadarScan): RadarMemoryFrame[] {
  return framesFromScan(radar).map((f, i) => ({ ...f, degraded: radar.history[i]?.degraded }));
}

export function historyIsDegraded(frames: RadarMemoryFrame[]): boolean {
  return frames.some((f) => f.degraded);
}
