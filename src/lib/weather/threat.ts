import { bearingDeg, comingFromPl, destPoint, haversineKm, towardPl } from "./geo.ts";
import { isActiveWarning } from "./imgw-time.ts";
import { SpatialHash } from "./spatial-hash.ts";
import type {
  CellTrack,
  OfficialWarning,
  Place,
  RadarLevel,
  RadarMemoryFrame,
  RadarSample,
  Threat,
  ThreatLevel,
} from "./types.ts";

/** Distance at which the cell is treated as covering the city / GPS pin. */
const PIN_KM = 5;
/** Echo further than this is not a nowcast threat for the pin (~90 min window). */
export const TRACK_MAX_KM = 100;
/** Radar z=5 sample spacing is ~12 km — this close is already "here". */
const OVER_KM = 12;
const CLOSE_KM = 20;
/** Friends-of-friends link for connected echo (z=5 spacing ~12 km; allow one gap). */
const LINK_KM = 16;
const MATCH_KM = 45;
const MAX_SPEED = 95;
const MIN_MOVE_SPEED = 4;
const HORIZON_MIN = 90;
const MAX_TRACKS = 3;
const CORE_RADIUS_KM = 18;
/** Arrow forward shaft = this many minutes of travel at estimated speed. */
const ARROW_AHEAD_MIN = 30;
/** Reject single masses larger than this — they get split into local tiles instead. */
const MAX_MASS_SPAN_KM = 140;
/** Spatial tile size when splitting an oversized connected component. */
const SPLIT_TILE_KM = 55;
/** Ignore tiny chips — they jitter and invent fake bearings. */
const MIN_MASS_SAMPLES = 12;
/** Hide arrows below this motion confidence (0–100). */
export const MOTION_CONFIDENCE_MIN = 72;

function centroid(samples: RadarSample[]): { lat: number; lon: number } | null {
  if (samples.length === 0) return null;
  const w = samples.reduce((s, p) => s + p.level, 0);
  if (w <= 0) return null;
  return {
    lat: samples.reduce((s, p) => s + p.lat * p.level, 0) / w,
    lon: samples.reduce((s, p) => s + p.lon * p.level, 0) / w,
  };
}

function massCoreSamples(samples: RadarSample[]): RadarSample[] {
  const strong = samples.filter((s) => s.level >= 2);
  const pool = strong.length >= 3 ? strong : samples.filter((s) => s.level >= 1);
  if (pool.length === 0) return [];
  let seed = pool[0]!;
  for (const s of pool) {
    if (s.level > seed.level) seed = s;
  }
  const local = pool.filter(
    (s) => haversineKm(seed.lat, seed.lon, s.lat, s.lon) <= CORE_RADIUS_KM,
  );
  return local.length >= 3 ? local : pool;
}

function massAnchor(mass: { samples: RadarSample[]; lat: number; lon: number }): {
  lat: number;
  lon: number;
} {
  const c = centroid(massCoreSamples(mass.samples));
  return c ?? { lat: mass.lat, lon: mass.lon };
}

/**
 * Operational-style echo motion (TREC family):
 * 1) intensity grid in km
 * 2) large-scale box smooth (track envelope, not fringe — Wolfson/GDST idea)
 * 3) normalized cross-correlation (Pearson) for displacement
 * 4) QC: min NCC + agreement across frame pairs
 */
const CELL_KM = 5;
const GRID_HALF_CELLS = 12; // ±60 km
const GRID_N = GRID_HALF_CELLS * 2;
const SMOOTH_RADIUS = 2; // ~25 km box — large-scale envelope
const NCC_MIN = 0.4;
const PAIR_AGREE_DEG = 40;
const MAX_SHIFT_KM = 70;

export type MotionEst = {
  speed: number;
  bearing: number;
  from: { lat: number; lon: number };
  confidence: number;
  stationary?: boolean;
};

function kmToLatDeg(km: number) {
  return km / 111;
}
function kmToLonDeg(km: number, lat: number) {
  return km / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.25));
}

function samplesToGrid(
  samples: RadarSample[],
  lat0: number,
  lon0: number,
): Float64Array {
  const g = new Float64Array(GRID_N * GRID_N);
  const dLat = kmToLatDeg(CELL_KM);
  const dLon = kmToLonDeg(CELL_KM, lat0);
  for (const s of samples) {
    if (s.level < 1) continue;
    const ix = Math.round((s.lon - lon0) / dLon) + GRID_HALF_CELLS;
    const iy = Math.round((s.lat - lat0) / dLat) + GRID_HALF_CELLS;
    if (ix < 0 || iy < 0 || ix >= GRID_N || iy >= GRID_N) continue;
    const i = iy * GRID_N + ix;
    if (s.level > g[i]!) g[i] = s.level;
  }
  return g;
}

function boxSmooth(src: Float64Array, radius: number): Float64Array {
  const out = new Float64Array(GRID_N * GRID_N);
  for (let iy = 0; iy < GRID_N; iy++) {
    for (let ix = 0; ix < GRID_N; ix++) {
      let sum = 0;
      let n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const jy = iy + dy;
          const jx = ix + dx;
          if (jy < 0 || jx < 0 || jy >= GRID_N || jx >= GRID_N) continue;
          sum += src[jy * GRID_N + jx]!;
          n++;
        }
      }
      out[iy * GRID_N + ix] = n > 0 ? sum / n : 0;
    }
  }
  return out;
}

function gridRainCells(g: Float64Array): number {
  let n = 0;
  for (let i = 0; i < g.length; i++) if (g[i]! > 0) n++;
  return n;
}

/** Pearson NCC of grid `a` vs `b` shifted by (dix, diy). */
function nccAtShift(a: Float64Array, b: Float64Array, dix: number, diy: number): number {
  let n = 0;
  let sumA = 0;
  let sumB = 0;
  let sumAA = 0;
  let sumBB = 0;
  let sumAB = 0;
  for (let iy = 0; iy < GRID_N; iy++) {
    const jy = iy + diy;
    if (jy < 0 || jy >= GRID_N) continue;
    for (let ix = 0; ix < GRID_N; ix++) {
      const jx = ix + dix;
      if (jx < 0 || jx >= GRID_N) continue;
      const av = a[iy * GRID_N + ix]!;
      const bv = b[jy * GRID_N + jx]!;
      if (av <= 0 && bv <= 0) continue;
      n++;
      sumA += av;
      sumB += bv;
      sumAA += av * av;
      sumBB += bv * bv;
      sumAB += av * bv;
    }
  }
  if (n < 10) return -1;
  const meanA = sumA / n;
  const meanB = sumB / n;
  const varA = sumAA - n * meanA * meanA;
  const varB = sumBB - n * meanB * meanB;
  if (varA <= 1e-6 || varB <= 1e-6) return -1;
  return (sumAB - n * meanA * meanB) / Math.sqrt(varA * varB);
}

function parabolaPeak(left: number, center: number, right: number): number {
  const denom = left - 2 * center + right;
  if (Math.abs(denom) < 1e-6) return 0;
  const delta = (0.5 * (left - right)) / denom;
  return Math.max(-0.5, Math.min(0.5, delta));
}

function refineNccShift(
  a: Float64Array,
  b: Float64Array,
  best: { dix: number; diy: number; score: number },
): { dix: number; diy: number; score: number } {
  const left = nccAtShift(a, b, best.dix - 1, best.diy);
  const right = nccAtShift(a, b, best.dix + 1, best.diy);
  const down = nccAtShift(a, b, best.dix, best.diy - 1);
  const up = nccAtShift(a, b, best.dix, best.diy + 1);
  return {
    dix: best.dix + parabolaPeak(left, best.score, right),
    diy: best.diy + parabolaPeak(down, best.score, up),
    score: best.score,
  };
}

function bestNccShift(
  a: Float64Array,
  b: Float64Array,
  maxC: number,
): { dix: number; diy: number; score: number } | null {
  let best: { dix: number; diy: number; score: number } | null = null;
  for (let diy = -maxC; diy <= maxC; diy++) {
    for (let dix = -maxC; dix <= maxC; dix++) {
      const score = nccAtShift(a, b, dix, diy);
      if (score < NCC_MIN) continue;
      if (!best || score > best.score) best = { dix, diy, score };
    }
  }
  return best ? refineNccShift(a, b, best) : null;
}

function pairMotionNcc(
  prev: RadarSample[],
  next: RadarSample[],
  lat0: number,
  lon0: number,
  hours: number,
): { speed: number; bearing: number; moved: number; score: number; stationary: boolean } | null {
  if (hours <= 0) return null;
  const rawA = samplesToGrid(prev, lat0, lon0);
  const rawB = samplesToGrid(next, lat0, lon0);
  if (gridRainCells(rawA) < 4 || gridRainCells(rawB) < 4) return null;
  const a = boxSmooth(rawA, SMOOTH_RADIUS);
  const b = boxSmooth(rawB, SMOOTH_RADIUS);
  const maxKm = Math.min(MAX_SPEED * hours, MAX_SHIFT_KM);
  const maxC = Math.max(1, Math.min(12, Math.ceil(maxKm / CELL_KM)));
  const best = bestNccShift(a, b, maxC);
  if (!best) return null;
  if (Math.abs(best.dix) < 0.35 && Math.abs(best.diy) < 0.35) {
    return { speed: 0, bearing: 0, moved: 0, score: best.score, stationary: true };
  }
  const dLat = best.diy * kmToLatDeg(CELL_KM);
  const dLon = best.dix * kmToLonDeg(CELL_KM, lat0);
  const moved = haversineKm(lat0, lon0, lat0 + dLat, lon0 + dLon);
  const speed = moved / hours;
  if (speed > MAX_SPEED) return null;
  return {
    speed,
    bearing: bearingDeg(lat0, lon0, lat0 + dLat, lon0 + dLon),
    moved,
    score: best.score,
    stationary: false,
  };
}

/** Exported for sub-cell NCC tests. */
export function estimatePairMotion(
  prev: RadarSample[],
  next: RadarSample[],
  lat0: number,
  lon0: number,
  hours: number,
) {
  return pairMotionNcc(prev, next, lat0, lon0, hours);
}

function systemMotion(
  frames: RadarMemoryFrame[],
  lat0: number,
  lon0: number,
): MotionEst | null {
  if (frames.length < 2) return null;
  type Part = { deg: number; w: number; speed: number; score: number };
  const parts: Part[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const next = frames[i];
    if (!prev || !next) continue;
    const hours = (next.time - prev.time) / 3600;
    const m = pairMotionNcc(prev.samples, next.samples, lat0, lon0, hours);
    if (!m) continue;
    if (m.stationary) {
      parts.push({ deg: 0, w: Math.max(m.score, 0.4), speed: 0, score: m.score });
      continue;
    }
    if (m.speed < 1) continue;
    parts.push({
      deg: m.bearing,
      w: Math.max(m.moved, 1) * Math.max(m.score, 0.4),
      speed: m.speed,
      score: m.score,
    });
  }
  const first = frames[0];
  const last = frames.at(-1);
  if (first && last && last.time > first.time) {
    const hoursAll = (last.time - first.time) / 3600;
    const mAll = pairMotionNcc(first.samples, last.samples, lat0, lon0, hoursAll);
    if (mAll && !mAll.stationary && mAll.speed >= 1) {
      parts.push({
        deg: mAll.bearing,
        w: Math.max(mAll.moved, 1) * 2.5 * Math.max(mAll.score, 0.4),
        speed: mAll.speed,
        score: mAll.score,
      });
    }
  }
  if (parts.length === 0) return null;

  const movingParts = parts.filter((p) => p.speed >= 1);
  if (movingParts.length === 0) {
    const bestScore = Math.max(...parts.map((p) => p.score));
    if (bestScore < NCC_MIN) return null;
    return {
      speed: 0,
      bearing: 0,
      from: { lat: lat0, lon: lon0 },
      confidence: Math.round(Math.min(90, 50 + bestScore * 40)),
      stationary: true,
    };
  }

  // QC: drop pair vectors that disagree with the weighted circular mean
  let bearing = circularMeanDeg(movingParts);
  if (bearing == null) return null;
  const kept = movingParts.filter((p) => angleDiffDeg(p.deg, bearing!) <= PAIR_AGREE_DEG);
  const use = kept.length > 0 ? kept : movingParts;
  bearing = circularMeanDeg(use);
  if (bearing == null) return null;
  // Need at least one solid correlation
  if (Math.max(...use.map((p) => p.score)) < NCC_MIN) return null;

  const wsum = use.reduce((s, p) => s + p.w, 0);
  const speed = use.reduce((s, p) => s + p.speed * p.w, 0) / wsum;
  if (speed > MAX_SPEED || speed < 1) return null;
  const hoursAll =
    first && last && last.time > first.time ? (last.time - first.time) / 3600 : 0.5;
  const from = destPoint(lat0, lon0, (bearing + 180) % 360, Math.max(speed * hoursAll, 8));
  const bestScore = Math.max(...use.map((p) => p.score));
  const confidence = Math.round(
    Math.min(
      95,
      40 + bestScore * 40 + Math.min(use.length, 3) * 8 + (kept.length === parts.length ? 5 : 0),
    ),
  );
  return { speed, bearing, from, confidence, stationary: false };
}

type Mass = {
  lat: number;
  lon: number;
  maxLevel: RadarLevel;
  samples: RadarSample[];
};

function nearPin(samples: RadarSample[], lat: number, lon: number, km: number): RadarSample[] {
  return samples.filter((s) => haversineKm(lat, lon, s.lat, s.lon) <= km);
}

function nearestWithin(
  samples: RadarSample[],
  lat: number,
  lon: number,
  maxKm: number,
): number | null {
  let best: number | null = null;
  for (const s of samples) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d > maxKm) continue;
    if (best === null || d < best) best = d;
  }
  return best;
}

function maxLevelWithin(
  samples: RadarSample[],
  lat: number,
  lon: number,
  maxKm: number,
): RadarLevel {
  let max: RadarLevel = 0;
  for (const s of samples) {
    if (haversineKm(lat, lon, s.lat, s.lon) > maxKm) continue;
    if (s.level > max) max = s.level;
  }
  return max;
}

function massFromMembers(members: RadarSample[]): Mass | null {
  if (members.length < MIN_MASS_SAMPLES) return null;
  const c = centroid(members);
  if (!c) return null;
  return {
    lat: c.lat,
    lon: c.lon,
    maxLevel: members.reduce<RadarLevel>((m, s) => (s.level > m ? s.level : m), 0),
    samples: members,
  };
}

/** Cut a domain-spanning blob into ~SPLIT_TILE_KM tiles so local motion survives. */
function splitOversizedMass(members: RadarSample[]): Mass[] {
  const lat0 = members.reduce((s, p) => s + p.lat, 0) / members.length;
  const dLat = SPLIT_TILE_KM / 111;
  const dLon = SPLIT_TILE_KM / (111 * Math.max(Math.cos((lat0 * Math.PI) / 180), 0.25));
  const buckets = new Map<string, RadarSample[]>();
  for (const s of members) {
    const ix = Math.round(s.lon / dLon);
    const iy = Math.round(s.lat / dLat);
    const key = `${ix},${iy}`;
    const g = buckets.get(key);
    if (g) g.push(s);
    else buckets.set(key, [s]);
  }
  const out: Mass[] = [];
  for (const part of buckets.values()) {
    const m = massFromMembers(part);
    if (m) out.push(m);
  }
  return out;
}

/** Connected components of echo — one contiguous front is one mass (or split if huge). */
function segmentMasses(samples: RadarSample[], linkKm: number): Mass[] {
  const pool = samples.filter((s) => s.level >= 1);
  const n = pool.length;
  if (n === 0) return [];
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (i: number): number => {
    let r = i;
    while (parent[r] !== r) r = parent[r]!;
    let c = i;
    while (parent[c] !== c) {
      const next = parent[c]!;
      parent[c] = r;
      c = next;
    }
    return r;
  };
  const indexed = pool.map((s, i) => ({ ...s, i }));
  const hash = new SpatialHash(indexed, Math.max(8, linkKm));
  for (const [a, b] of hash.pairsWithin(indexed, linkKm)) {
    const ra = find(a.i);
    const rb = find(b.i);
    if (ra !== rb) parent[rb] = ra;
  }
  const groups = new Map<number, RadarSample[]>();
  for (let i = 0; i < n; i++) {
    const s = pool[i];
    if (!s) continue;
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(s);
    else groups.set(r, [s]);
  }
  const masses: Mass[] = [];
  for (const members of groups.values()) {
    if (members.length < 3) continue;
    let minLat = 90;
    let maxLat = -90;
    let minLon = 180;
    let maxLon = -180;
    for (const s of members) {
      if (s.lat < minLat) minLat = s.lat;
      if (s.lat > maxLat) maxLat = s.lat;
      if (s.lon < minLon) minLon = s.lon;
      if (s.lon > maxLon) maxLon = s.lon;
    }
    const span = haversineKm(minLat, minLon, maxLat, maxLon);
    if (span > MAX_MASS_SPAN_KM) {
      masses.push(...splitOversizedMass(members));
      continue;
    }
    const m = massFromMembers(members);
    if (m) masses.push(m);
  }
  return masses;
}

function massOverlap(a: Mass, b: Mass, linkKm: number): number {
  let hits = 0;
  for (const s of a.samples) {
    for (const p of b.samples) {
      if (haversineKm(s.lat, s.lon, p.lat, p.lon) <= linkKm) {
        hits++;
        break;
      }
    }
  }
  return hits;
}

function matchMass(mass: Mass, pool: Mass[]): Mass | null {
  let best: Mass | null = null;
  let bestScore = -1;
  for (const prev of pool) {
    const d = haversineKm(mass.lat, mass.lon, prev.lat, prev.lon);
    // Centroid gate is mandatory. Overlap with a nationwide mega-mass must not
    // link a local fragment to a centroid hundreds of km away (fake advection).
    if (d > MATCH_KM) continue;
    const hits = massOverlap(mass, prev, LINK_KM);
    const score = hits * 10 + (MATCH_KM - d);
    if (score > bestScore) {
      best = prev;
      bestScore = score;
    }
  }
  return best;
}

function angleDiffDeg(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function circularMeanDeg(parts: { deg: number; w: number }[]): number | null {
  let x = 0;
  let y = 0;
  let wsum = 0;
  for (const p of parts) {
    if (p.w <= 0) continue;
    const r = (p.deg * Math.PI) / 180;
    x += p.w * Math.cos(r);
    y += p.w * Math.sin(r);
    wsum += p.w;
  }
  if (wsum <= 0) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

type TrailPoint = { lat: number; lon: number; time: number };
type MassLayer = { time: number; masses: Mass[] };

function buildMassTrail(mass: Mass, layers: MassLayer[]): { time: number; mass: Mass }[] {
  const newest = layers.at(-1);
  if (!newest) return [];
  const trail: { time: number; mass: Mass }[] = [{ time: newest.time, mass }];
  let cursor = mass;
  for (let i = layers.length - 2; i >= 0; i--) {
    const layer = layers[i];
    if (!layer) break;
    const prev = matchMass(cursor, layer.masses);
    if (!prev) break;
    const hours = (trail[0]!.time - layer.time) / 3600;
    if (hours <= 0) break;
    const moved = haversineKm(prev.lat, prev.lon, cursor.lat, cursor.lon);
    if (moved / hours > MAX_SPEED) break;
    trail.unshift({ time: layer.time, mass: prev });
    cursor = prev;
  }
  return trail;
}

function motionForMass(trail: { time: number; mass: Mass }[]): MotionEst | null {
  if (trail.length < 2) return null;
  const last = trail.at(-1);
  if (!last) return null;

  // Full-mass centroid trail (not the bright-core seed) — core jumps invent fake bearings.
  const centroids = trail.map((t) => ({
    lat: t.mass.lat,
    lon: t.mass.lon,
    time: t.time,
  }));
  const trailMot = motionFromTrail(centroids);
  const moved =
    centroids.length >= 2
      ? haversineKm(
          centroids[0]!.lat,
          centroids[0]!.lon,
          centroids.at(-1)!.lat,
          centroids.at(-1)!.lon,
        )
      : 0;

  // NCC on level≥2 envelope around the centroid — not a tiny max-reflectivity patch.
  const coreFrames: RadarMemoryFrame[] = trail.map((t) => {
    const strong = t.mass.samples.filter((s) => s.level >= 2);
    const pool = strong.length >= MIN_MASS_SAMPLES ? strong : t.mass.samples;
    const near = pool.filter(
      (s) => haversineKm(t.mass.lat, t.mass.lon, s.lat, s.lon) <= 40,
    );
    return {
      time: t.time,
      samples: near.length >= 5 ? near : pool,
      maxLevel: t.mass.maxLevel,
      nearestKm: null,
    };
  });
  const field = systemMotion(coreFrames, last.mass.lat, last.mass.lon);

  if (field?.stationary && moved < 10) {
    return {
      speed: 0,
      bearing: 0,
      from: { lat: last.mass.lat, lon: last.mass.lon },
      confidence: field.confidence,
      stationary: true,
    };
  }

  const trailOk = trailMot && trailMot.speed >= MIN_MOVE_SPEED && moved >= 10;
  const fieldOk = field && !field.stationary && field.speed >= MIN_MOVE_SPEED;

  if (trailOk && fieldOk) {
    const agree = angleDiffDeg(trailMot.bearing, field.bearing) <= PAIR_AGREE_DEG;
    if (!agree) return null;
    const confidence = Math.min(
      98,
      Math.round(
        58 +
          Math.min(trail.length, 4) * 8 +
          Math.min(moved, 40) * 0.4 +
          (field.confidence - 40) * 0.35,
      ),
    );
    return {
      speed: (trailMot.speed + field.speed) / 2,
      bearing:
        circularMeanDeg([
          { deg: trailMot.bearing, w: 1.4 },
          { deg: field.bearing, w: 1 },
        ]) ?? trailMot.bearing,
      from: trailMot.from,
      confidence,
    };
  }

  if (trailOk && trail.length >= 3 && moved >= 14) {
    const confidence = Math.min(
      78,
      Math.round(50 + Math.min(trail.length, 4) * 6 + Math.min(moved, 35) * 0.45),
    );
    return { ...trailMot, confidence };
  }

  if (fieldOk && trail.length >= 3 && (field.confidence ?? 0) >= MOTION_CONFIDENCE_MIN) {
    return field;
  }

  return null;
}

function motionFromTrail(
  trail: TrailPoint[],
): { speed: number; bearing: number; from: { lat: number; lon: number } } | null {
  if (trail.length < 2) return null;
  const newest = trail.at(-1);
  const oldest = trail[0];
  if (!newest || !oldest) return null;
  const hoursAll = (newest.time - oldest.time) / 3600;
  if (hoursAll <= 0) return null;
  const movedAll = haversineKm(oldest.lat, oldest.lon, newest.lat, newest.lon);
  const speedAll = movedAll / hoursAll;
  if (speedAll > MAX_SPEED) return null;
  const bearingAll = bearingDeg(oldest.lat, oldest.lon, newest.lat, newest.lon);

  const parts: { deg: number; w: number }[] = [];
  for (let i = 1; i < trail.length; i++) {
    const a = trail[i - 1];
    const b = trail[i];
    if (!a || !b) continue;
    const hours = (b.time - a.time) / 3600;
    if (hours <= 0) continue;
    const moved = haversineKm(a.lat, a.lon, b.lat, b.lon);
    const speed = moved / hours;
    if (speed > MAX_SPEED) continue;
    const br = bearingDeg(a.lat, a.lon, b.lat, b.lon);
    if (trail.length >= 3 && movedAll > 8 && angleDiffDeg(br, bearingAll) > 70) continue;
    parts.push({ deg: br, w: Math.max(moved, 0.5) });
  }
  parts.push({
    deg: bearingAll,
    w: Math.max(movedAll, 1) * (trail.length >= 3 ? 2 : 1),
  });
  const bearing = circularMeanDeg(parts);
  if (bearing == null) return null;
  return { speed: speedAll, bearing, from: { lat: oldest.lat, lon: oldest.lon } };
}

function makeTrack(
  now: { lat: number; lon: number },
  motion: MotionEst,
): CellTrack {
  const moving = motion.speed >= MIN_MOVE_SPEED;
  const lookKm = moving ? motion.speed * (ARROW_AHEAD_MIN / 60) : 0;
  const backKm = moving ? Math.min(motion.speed * (10 / 60), lookKm * 0.35) : 8;
  const back = destPoint(now.lat, now.lon, (motion.bearing + 180) % 360, Math.max(backKm, 4));
  const soon = moving
    ? destPoint(now.lat, now.lon, motion.bearing, lookKm)
    : { lat: now.lat, lon: now.lon };
  return {
    from: back,
    now: { lat: now.lat, lon: now.lon },
    soon,
    speedKmh: motion.speed,
    bearing: motion.bearing,
    threatening: false,
    confidence: motion.confidence,
  };
}

/** Sample furthest along the motion bearing — first rain to arrive, not the blob center. */
export function leadingEdgeOf(
  samples: RadarSample[],
  bearing: number,
  originLat: number,
  originLon: number,
  pin?: { lat: number; lon: number },
): { lat: number; lon: number } {
  if (samples.length === 0) return { lat: originLat, lon: originLon };
  const rad = (bearing * Math.PI) / 180;
  const ux = Math.sin(rad);
  const uy = Math.cos(rad);
  const cos = Math.max(Math.cos((originLat * Math.PI) / 180), 0.25);
  const projs: { s: RadarSample; proj: number }[] = [];
  let maxProj = -Infinity;
  for (const s of samples) {
    const dx = (s.lon - originLon) * 111 * cos;
    const dy = (s.lat - originLat) * 111;
    const proj = dx * ux + dy * uy;
    projs.push({ s, proj });
    if (proj > maxProj) maxProj = proj;
  }
  const strip = projs.filter((p) => p.proj >= maxProj - 8);
  const pool = strip.length > 0 ? strip : projs;
  if (pin) {
    let best = pool[0]!.s;
    let bestD = haversineKm(pin.lat, pin.lon, best.lat, best.lon);
    for (const p of pool) {
      const d = haversineKm(pin.lat, pin.lon, p.s.lat, p.s.lon);
      if (d < bestD) {
        best = p.s;
        bestD = d;
      }
    }
    return { lat: best.lat, lon: best.lon };
  }
  const top = pool.reduce((a, b) => (b.proj > a.proj ? b : a));
  return { lat: top.s.lat, lon: top.s.lon };
}

function closestApproach(
  lat: number,
  lon: number,
  bearing: number,
  speedKmh: number,
  pinLat: number,
  pinLon: number,
) {
  let best = { d: haversineKm(pinLat, pinLon, lat, lon), t: 0 };
  const useSpeed = Math.max(speedKmh, 8);
  for (let t = 0; t <= HORIZON_MIN; t += 2) {
    const p = destPoint(lat, lon, bearing, useSpeed * (t / 60));
    const d = haversineKm(pinLat, pinLon, p.lat, p.lon);
    if (d < best.d) best = { d, t };
  }
  return best;
}

function isActive(warning: OfficialWarning, now = Date.now()) {
  return isActiveWarning(warning.from, warning.to, now);
}

function roundPct(n: number) {
  return Math.max(5, Math.min(95, Math.round(n / 5) * 5));
}

function expectPl(maxLevel: number): string | null {
  if (maxLevel >= 4) return "silną ulewę, porywy wiatru, możliwy grad";
  if (maxLevel >= 3) return "ulewę i porywisty wiatr";
  if (maxLevel >= 2) return "deszcz i mokrą jezdnię";
  if (maxLevel >= 1) return "słaby deszcz";
  return null;
}

export type FieldCell = {
  lat: number;
  lon: number;
  maxLevel: RadarLevel;
  samples: RadarSample[];
  motion: MotionEst;
  track: CellTrack;
};

export type MotionField = {
  tracks: CellTrack[];
  cells: FieldCell[];
};

function usableFrames(frames: RadarMemoryFrame[]): RadarMemoryFrame[] {
  return frames.filter((f) => f.samples.some((s) => s.level >= 1)).sort((a, b) => a.time - b.time);
}

/**
 * Pin-independent rain-motion field. Spatial hash segments masses; ranking
 * uses `sampleOrigin` (Poland radar center), never the user pin.
 */
export function computeField(
  frames: RadarMemoryFrame[],
  sampleOrigin: { lat: number; lon: number },
): MotionField {
  const usable = usableFrames(frames);
  const last = usable.at(-1);
  const tracks: CellTrack[] = [];
  const cells: FieldCell[] = [];
  if (usable.length < 2 || !last) return { tracks, cells };

  const layers: MassLayer[] = usable.map((f) => ({
    time: f.time,
    masses: segmentMasses(
      f.samples.filter((s) => s.level >= 1),
      LINK_KM,
    ),
  }));
  const nowMasses = [...(layers.at(-1)?.masses ?? [])].sort((a, b) => {
    if (b.maxLevel !== a.maxLevel) return b.maxLevel - a.maxLevel;
    if (b.samples.length !== a.samples.length) return b.samples.length - a.samples.length;
    const da = haversineKm(a.lat, a.lon, sampleOrigin.lat, sampleOrigin.lon);
    const db = haversineKm(b.lat, b.lon, sampleOrigin.lat, sampleOrigin.lon);
    return da - db;
  });

  for (const mass of nowMasses) {
    const trail = buildMassTrail(mass, layers);
    const motion = motionForMass(trail);
    if (!motion || motion.stationary || motion.speed < MIN_MOVE_SPEED) continue;
    if (motion.confidence < MOTION_CONFIDENCE_MIN) continue;
    const track = makeTrack({ lat: mass.lat, lon: mass.lon }, motion);
    cells.push({
      lat: mass.lat,
      lon: mass.lon,
      maxLevel: mass.maxLevel,
      samples: mass.samples,
      motion,
      track,
    });
  }

  cells.sort((a, b) => b.track.confidence - a.track.confidence || b.maxLevel - a.maxLevel);
  for (const cell of cells) {
    if (tracks.length >= MAX_TRACKS) break;
    cell.track.threatening = tracks.length === 0;
    tracks.push(cell.track);
  }
  return { tracks, cells };
}

export function computePinNarrative(
  place: Place,
  field: MotionField,
  frames: RadarMemoryFrame[],
  warnings: OfficialWarning[],
  radiusKm: number,
): Threat {
  const matched = warnings.filter((w) => w.matchesPlace && w.stormRelated);
  const usable = usableFrames(frames);
  const last = usable.at(-1);
  const lastSamples = last?.samples ?? [];
  const maxLevel = maxLevelWithin(lastSamples, place.lat, place.lon, radiusKm);
  const nearestKm = nearestWithin(lastSamples, place.lat, place.lon, TRACK_MAX_KM);
  const who = place.label;

  let approaching = false;
  let receding = false;
  let speedKmh: number | null = null;
  let etaMin: number | null = null;
  let comingFrom: string | null = null;
  let toward: string | null = null;
  let willHit = false;
  let missKm: number | null = null;
  let threatTrack: CellTrack | null = null;
  let threatCellLevel = 0;
  let leadLat = 0;
  let leadLon = 0;

  type Hit = {
    miss: number;
    approaching: boolean;
    receding: boolean;
    speed: number;
    bearing: number;
    track: CellTrack;
    level: number;
    dNow: number;
    pinRelevant: boolean;
    lead: { lat: number; lon: number };
  };
  const hits: Hit[] = [];

  for (const cell of field.cells) {
    const anchor = { lat: cell.lat, lon: cell.lon };
    const lead = leadingEdgeOf(cell.samples, cell.motion.bearing, cell.lat, cell.lon, place);
    const dNow =
      nearestWithin(cell.samples, place.lat, place.lon, TRACK_MAX_KM) ??
      haversineKm(place.lat, place.lon, anchor.lat, anchor.lon);
    const approach = closestApproach(
      lead.lat,
      lead.lon,
      cell.motion.bearing,
      cell.motion.speed,
      place.lat,
      place.lon,
    );
    const ahead = destPoint(anchor.lat, anchor.lon, cell.motion.bearing, 15);
    const dAhead = haversineKm(place.lat, place.lon, ahead.lat, ahead.lon);
    const dThen = haversineKm(place.lat, place.lon, cell.motion.from.lat, cell.motion.from.lon);
    hits.push({
      miss: approach.d,
      approaching: dAhead < dNow - 0.4 || dNow < dThen - 0.6,
      receding: dAhead > dNow + 0.4 && dNow > dThen + 0.6,
      speed: cell.motion.speed,
      bearing: cell.motion.bearing,
      track: cell.track,
      level: cell.maxLevel,
      dNow,
      pinRelevant: dNow <= TRACK_MAX_KM,
      lead,
    });
  }

  const primary = [...hits].sort((a, b) => a.dNow - b.dNow).find((h) => h.pinRelevant) ?? null;
  if (primary) {
    missKm = primary.miss;
    approaching = primary.approaching;
    receding = primary.receding;
    if (primary.speed >= MIN_MOVE_SPEED) {
      speedKmh = primary.speed;
      comingFrom = comingFromPl(primary.bearing);
      toward = towardPl(primary.bearing);
    }
    threatCellLevel = primary.level;
    willHit = primary.miss <= PIN_KM;
    threatTrack = primary.track;
    leadLat = primary.lead.lat;
    leadLon = primary.lead.lon;
  }

  if (nearestKm !== null && nearestKm <= OVER_KM && maxLevel >= 1) {
    etaMin = 0;
    willHit = true;
    receding = false;
  } else if (nearestKm !== null && nearestKm <= CLOSE_KM) {
    willHit = true;
    receding = false;
    if (speedKmh !== null && speedKmh >= MIN_MOVE_SPEED) {
      etaMin = Math.max(1, Math.round((nearestKm / Math.max(speedKmh, 20)) * 60));
    } else {
      etaMin = Math.max(1, Math.round(nearestKm * 1.5));
    }
  } else if (
    threatTrack &&
    speedKmh !== null &&
    speedKmh >= MIN_MOVE_SPEED &&
    missKm !== null &&
    (willHit || (approaching && missKm <= 12))
  ) {
    etaMin = Math.max(1, Math.round(
      closestApproach(
        leadLat,
        leadLon,
        threatTrack.bearing,
        speedKmh,
        place.lat,
        place.lon,
      ).t,
    ));
  }

  const activeMatch = matched.filter((w) => isActive(w));
  const upcoming = matched.filter((w) => !isActive(w));
  const expectLevel = Math.max(maxLevel, willHit || approaching ? threatCellLevel : 0);
  let expect = expectPl(expectLevel);

  const aboutPin =
    (nearestKm !== null && nearestKm <= 80) ||
    willHit ||
    (approaching && missKm !== null && missKm <= 20);
  if (!aboutPin) {
    comingFrom = null;
    toward = null;
    if (maxLevel < 1 && !willHit) expect = null;
  }

  let chance = 10;
  if (activeMatch.length > 0) {
    const degree = Math.max(...activeMatch.map((w) => w.degree), 1);
    chance = Math.max(chance, 15 + degree * 10);
  }
  if (maxLevel >= 1 && nearestKm !== null && nearestKm <= radiusKm) chance = Math.max(chance, 25);
  if (maxLevel >= 2 && nearestKm !== null && nearestKm <= radiusKm) chance = Math.max(chance, 40);
  if (willHit && approaching && expectLevel >= 2) chance = Math.max(chance, 60);
  if (nearestKm !== null && nearestKm <= CLOSE_KM && maxLevel >= 1) chance = Math.max(chance, 55);
  if (nearestKm !== null && nearestKm <= OVER_KM && maxLevel >= 1) chance = Math.max(chance, 70);
  if (etaMin !== null && etaMin === 0 && maxLevel >= 1) chance = Math.max(chance, 80);
  if (etaMin !== null && etaMin > 0 && etaMin <= 20 && willHit) chance = Math.max(chance, 70);
  if (etaMin !== null && etaMin > 20 && etaMin <= 45 && willHit) chance = Math.max(chance, 50);
  if (nearestKm !== null && nearestKm <= PIN_KM && maxLevel >= 3) chance = Math.max(chance, 90);
  if (receding && (nearestKm === null || nearestKm > CLOSE_KM)) chance = Math.min(chance, 20);
  if (
    missKm !== null &&
    missKm > PIN_KM + 8 &&
    !willHit &&
    (nearestKm === null || nearestKm > CLOSE_KM)
  ) {
    chance = Math.min(chance, Math.max(15, chance - 20));
  }
  chance = roundPct(chance);

  let level: ThreatLevel = "clear";
  if (activeMatch.length > 0) level = "watch";
  if (maxLevel >= 2 && nearestKm !== null && nearestKm <= radiusKm) level = "nearby";
  if (willHit && expectLevel >= 2) level = "nearby";
  if (
    (etaMin !== null && etaMin > 0 && etaMin <= 25 && willHit && expectLevel >= 2) ||
    (nearestKm !== null && nearestKm <= 15 && maxLevel >= 3)
  ) {
    level = "imminent";
  }
  if (nearestKm !== null && nearestKm <= OVER_KM && maxLevel >= 2) level = "now";
  if (upcoming.length > 0 && level === "clear") level = "watch";

  const formNote = "Komórka może też urosnąć na miejscu — tego radar nie zapowie.";
  const dist =
    nearestKm !== null ? `ok. ${nearestKm.toFixed(0)} km od ${who}` : `w okolicy ${who}`;

  let detail: string;
  if (etaMin === 0 && (maxLevel >= 1 || nearestKm !== null && nearestKm <= PIN_KM)) {
    detail = `Opad jest nad ${who} teraz.${expect ? ` Spodziewaj się: ${expect}.` : ""} ${formNote}`;
  } else if (receding && aboutPin) {
    detail = `${comingFrom ? `Idzie od ${comingFrom}` : "Komórka"} (${dist}) i odchodzi na ${toward ?? "bok"}.${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. ${formNote}`;
  } else if (willHit && comingFrom) {
    const etaBit =
      etaMin && etaMin > 0 ? ` Dojście nad ${who}: ok. ${etaMin} min.` : "";
    detail = `Idzie od ${comingFrom}${speedKmh ? ` (~${Math.round(speedKmh)} km/h)` : ""}, echo ${dist}.${etaBit}${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. To ruch echa, nie pewność. ${formNote}`;
  } else if (
    comingFrom &&
    missKm !== null &&
    missKm > PIN_KM &&
    (nearestKm === null || nearestKm > CLOSE_KM)
  ) {
    detail = `Idzie od ${comingFrom}, echo ${dist}. Tor minie ${who} ok. ${missKm.toFixed(0)} km obok${etaMin ? ` za ~${etaMin} min` : ""}.${expect ? ` Spodziewaj się w okolicy: ${expect}.` : ""} Nad samym punktem szansa ~${chance}%. ${formNote}`;
  } else if (nearestKm !== null) {
    detail = `Echo ${dist}${comingFrom ? `, od ${comingFrom}` : ""}.${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. ${formNote}`;
  } else if (level === "watch") {
    const body =
      activeMatch[0]?.body ??
      upcoming[0]?.body ??
      "Instytut wydał ostrzeżenie dla powiatu.";
    detail = `${body} Dla ${who} szansa z radaru ~${chance}% na ~45 min.`;
  } else if (level === "clear") {
    detail = `Nad ${who} radar nie widzi groźnej komórki w promieniu ${TRACK_MAX_KM} km. Szansa ~${chance}% na ok. 45 min. ${formNote}`;
  } else {
    detail = `Szansa ~${chance}% dla ${who}. ${formNote}`;
  }

  const copy: Record<ThreatLevel, string> = {
    clear: "Czysto",
    watch: "Ostrzeżenie IMGW",
    nearby: receding ? "Opad oddala się" : approaching ? "Opad nadciąga" : "Opad w okolicy",
    imminent: "Burza nadciąga",
    now: "Burza nad Tobą",
  };

  return {
    level,
    title: copy[level],
    detail,
    etaMin,
    approaching,
    receding,
    speedKmh,
    nearestKm,
    maxLevel,
    chancePct: chance,
    comingFrom,
    toward,
    willHit,
    missKm,
    expect,
    track: threatTrack,
    tracks: field.tracks,
    matchedWarnings: matched,
  };
}

/**
 * @param sampleOrigin — radar crop center. Tracks/arrows come from `computeField`.
 *   The user pin must NOT change which arrows are drawn.
 */
export function computeThreat(
  place: Place,
  frames: RadarMemoryFrame[],
  warnings: OfficialWarning[],
  radiusKm: number,
  sampleOrigin: { lat: number; lon: number } = place,
): Threat {
  return computePinNarrative(
    place,
    computeField(frames, sampleOrigin),
    frames,
    warnings,
    radiusKm,
  );
}
