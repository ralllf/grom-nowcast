import type { RadarLevel, RadarMemoryFrame, RadarScan } from "./types.ts";

export function radarHistoryFromScan(radar: RadarScan): RadarMemoryFrame[] {
  if (radar.history.length > 0) return radar.history;
  const frames: RadarMemoryFrame[] = [];
  if (radar.prevTime != null && radar.prevSamples.length > 0) {
    frames.push({
      time: radar.prevTime,
      samples: radar.prevSamples,
      maxLevel: radar.prevSamples.reduce<RadarLevel>(
        (m, s) => (s.level > m ? s.level : m),
        0,
      ),
      nearestKm: null,
    });
  }
  if (radar.latestTime != null) {
    frames.push({
      time: radar.latestTime,
      samples: radar.samples,
      maxLevel: radar.maxLevel,
      nearestKm: radar.nearestKm,
    });
  }
  return frames;
}

export function historyIsDegraded(frames: RadarMemoryFrame[]): boolean {
  return frames.some((f) => f.degraded);
}
