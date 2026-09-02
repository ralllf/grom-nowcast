import { levelFromRate } from "./palette.ts";
import type { RadarLevel, RadarSample } from "./types.ts";

/** Poland + border strip — fixed radar domain (not pin-centered). */
export const PL_RADAR_BBOX = {
  minLat: 48.8,
  maxLat: 55.15,
  minLon: 13.8,
  maxLon: 24.6,
} as const;

export const PL_RADAR_ORIGIN = { lat: 52.1, lon: 19.35 };

/** Cap on samples per frame; hit → coarsen the aggregation grid (never drop regions). */
export const MAX_RADAR_SAMPLES = 9_000;
/** Aggregation cell (degrees). ~3 km at 52°N: 0.027° lat, 0.044° lon. */
export const BASE_CELL_LAT = 0.027;
export const BASE_CELL_LON = 0.044;

export type RawHit = { lat: number; lon: number; rate: number };

export function inPolandRadar(lat: number, lon: number): boolean {
  return (
    lat >= PL_RADAR_BBOX.minLat &&
    lat <= PL_RADAR_BBOX.maxLat &&
    lon >= PL_RADAR_BBOX.minLon &&
    lon <= PL_RADAR_BBOX.maxLon
  );
}

/**
 * Aggregate raw pixel hits onto a regular lat/lon grid, keeping the max rate per cell.
 * If the result is still above the cap, double the cell and try again — coverage
 * stays uniform across the country instead of silently dropping the south.
 */
export function aggregate(hits: RawHit[]): { samples: RadarSample[]; cellKm: number } {
  let factor = 1;
  for (;;) {
    const dLat = BASE_CELL_LAT * factor;
    const dLon = BASE_CELL_LON * factor;
    const cells = new Map<number, RawHit>();
    for (const h of hits) {
      const i = Math.floor((h.lat - PL_RADAR_BBOX.minLat) / dLat);
      const j = Math.floor((h.lon - PL_RADAR_BBOX.minLon) / dLon);
      const key = i * 4096 + j;
      const cur = cells.get(key);
      if (!cur) {
        cells.set(key, {
          lat: PL_RADAR_BBOX.minLat + (i + 0.5) * dLat,
          lon: PL_RADAR_BBOX.minLon + (j + 0.5) * dLon,
          rate: h.rate,
        });
      } else if (h.rate > cur.rate) {
        cur.rate = h.rate;
      }
    }
    if (cells.size <= MAX_RADAR_SAMPLES || factor >= 8) {
      const samples: RadarSample[] = [];
      for (const c of cells.values()) {
        const level = levelFromRate(c.rate);
        if (level === 0) continue;
        samples.push({
          lat: Math.round(c.lat * 1000) / 1000,
          lon: Math.round(c.lon * 1000) / 1000,
          level,
          rate: Math.round(c.rate * 10) / 10,
        });
      }
      samples.sort((s, t) => t.level - s.level || s.lat - t.lat || s.lon - t.lon);
      return { samples, cellKm: Math.round(3 * factor * 10) / 10 };
    }
    factor *= 2;
  }
}

export function maxLevelOf(samples: RadarSample[]): RadarLevel {
  let maxLevel: RadarLevel = 0;
  for (const s of samples) if (s.level > maxLevel) maxLevel = s.level;
  return maxLevel;
}
