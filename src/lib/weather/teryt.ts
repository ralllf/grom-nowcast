import { CITIES } from "./cities.ts";
import { haversineKm } from "./geo.ts";
import type { Place } from "./types.ts";

export const TERYT_FALLBACK_KM = 30;

/** One powiat / miasto na prawach powiatu. `g` is polygons → rings → [lon, lat]. */
export type PowiatBoundary = {
  t: string;
  n: string;
  b: [number, number, number, number];
  g: number[][][][];
};

type PowiatFile = {
  v: number;
  src: string;
  powiaty: PowiatBoundary[];
};

let loaded: Promise<PowiatBoundary[]> | undefined;

/** Lazy-load simplified PRG/GUS powiat polygons (separate chunk / JSON module). */
export function loadPowiatBoundaries(): Promise<PowiatBoundary[]> {
  loaded ??= import("./powiaty.json", { with: { type: "json" } }).then(
    (mod) => (mod.default as PowiatFile).powiaty,
  );
  return loaded;
}

/** Ray-cast. `rings[0]` is the outer ring; any further rings are holes. Coords are [x, y]. */
export function pointInPolygon(x: number, y: number, rings: number[][][]): boolean {
  if (rings.length === 0) return false;
  if (!pointInRing(x, y, rings[0])) return false;
  for (let i = 1; i < rings.length; i++) {
    if (pointInRing(x, y, rings[i])) return false;
  }
  return true;
}

function pointInRing(x: number, y: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function bboxArea(b: PowiatBoundary["b"]): number {
  return (b[2] - b[0]) * (b[3] - b[1]);
}

/** Exact TERYT from the containing powiat polygon. Smallest bbox wins on a shared edge. */
export async function lookupPowiat(lat: number, lon: number): Promise<PowiatBoundary | null> {
  const powiaty = await loadPowiatBoundaries();
  let best: PowiatBoundary | null = null;
  let bestArea = Infinity;
  for (const p of powiaty) {
    const [minLon, minLat, maxLon, maxLat] = p.b;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    for (const rings of p.g) {
      if (!pointInPolygon(lon, lat, rings)) continue;
      const area = bboxArea(p.b);
      if (area < bestArea) {
        best = p;
        bestArea = area;
      }
      break;
    }
  }
  return best;
}

function nearestCity(place: Place, cities: Place[]): Place | null {
  let best: Place | null = null;
  let bestKm = TERYT_FALLBACK_KM;
  for (const city of cities) {
    if (!city.terc) continue;
    const d = haversineKm(place.lat, place.lon, city.lat, city.lon);
    if (d <= bestKm) {
      best = city;
      bestKm = d;
    }
  }
  return best;
}

function countyLabel(hit: PowiatBoundary): string {
  return hit.n.startsWith("powiat ") ? hit.n : `powiat ${hit.n}`;
}

/**
 * Fill in TERYT when Nominatim omitted `teryt:terc`.
 * Order: existing terc → point-in-polygon (PRG powiat) → 30 km nearest listed city.
 */
export async function applyTerytFallback(
  place: Place,
  cities: Place[] = CITIES,
): Promise<Place> {
  if (place.terc) return place;
  const hit = await lookupPowiat(place.lat, place.lon);
  if (hit) {
    return {
      ...place,
      terc: hit.t,
      county: place.county ?? countyLabel(hit),
    };
  }
  const city = nearestCity(place, cities);
  if (!city?.terc) return place;
  return {
    ...place,
    terc: city.terc,
    county: place.county ?? city.county,
    state: place.state ?? city.state,
  };
}
