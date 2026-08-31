import { haversineKm } from "./geo.ts";

type LatLon = { lat: number; lon: number };

/**
 * Uniform lat/lon grid. Lon cell is sized at the northernmost point so a
 * radiusKm query never misses a neighbor in Poland.
 */
export class SpatialHash<T extends LatLon> {
  readonly cellKm: number;
  private readonly latCell: number;
  private readonly lonCell: number;
  private readonly buckets = new Map<string, T[]>();

  constructor(items: T[], cellKm: number) {
    this.cellKm = cellKm;
    this.latCell = cellKm / 111;
    let maxLat = 50;
    for (const p of items) if (p.lat > maxLat) maxLat = p.lat;
    this.lonCell = cellKm / (111 * Math.max(Math.cos((maxLat * Math.PI) / 180), 0.25));
    for (const item of items) {
      const key = this.key(item.lat, item.lon);
      const g = this.buckets.get(key);
      if (g) g.push(item);
      else this.buckets.set(key, [item]);
    }
  }

  get size() {
    return this.buckets.size;
  }

  private key(lat: number, lon: number) {
    return `${Math.floor(lat / this.latCell)},${Math.floor(lon / this.lonCell)}`;
  }

  neighbors(lat: number, lon: number, radiusKm: number): T[] {
    const iy = Math.floor(lat / this.latCell);
    const ix = Math.floor(lon / this.lonCell);
    const reach = Math.max(1, Math.ceil(radiusKm / this.cellKm) + 1);
    const out: T[] = [];
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        const g = this.buckets.get(`${iy + dy},${ix + dx}`);
        if (!g) continue;
        for (const p of g) {
          if (haversineKm(lat, lon, p.lat, p.lon) <= radiusKm) out.push(p);
        }
      }
    }
    return out;
  }

  /** Undirected pairs within radiusKm (i < j by insertion identity). */
  pairsWithin(items: T[], radiusKm: number): [T, T][] {
    const index = new Map<T, number>();
    items.forEach((p, i) => index.set(p, i));
    const pairs: [T, T][] = [];
    const seen = new Set<string>();
    for (const a of items) {
      const ia = index.get(a);
      if (ia === undefined) continue;
      for (const b of this.neighbors(a.lat, a.lon, radiusKm)) {
        if (a === b) continue;
        const ib = index.get(b);
        if (ib === undefined || ib <= ia) continue;
        const key = `${ia}:${ib}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push([a, b]);
      }
    }
    return pairs;
  }
}

export function cellKey(lat: number, lon: number, cellDeg: number): string {
  return `${Math.floor(lat / cellDeg)},${Math.floor(lon / cellDeg)}`;
}
