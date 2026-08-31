import { bearingDeg, comingFromPl, destPoint, haversineKm, towardPl } from "./geo.ts";
import type {
  CellTrack,
  LightningStrike,
  OfficialWarning,
  Place,
  RadarLevel,
  RadarMemoryFrame,
  RadarSample,
  Threat,
  ThreatLevel,
  TimelinePoint,
} from "./types.ts";
import { strikeNearCell } from "./perun.ts";
import { isActiveWarning } from "./imgw-time.ts";
import { LEVEL_MIN_RATE, levelFromRate } from "./palette.ts";

/** Distance at which the cell is treated as covering the city / GPS pin. */
const PIN_KM = 5;
/** Echo further than this is not a nowcast threat for the pin (~90 min window). */
export const TRACK_MAX_KM = 100;
const LOCAL_MAX_KM = 25;
/** Samples are ~3 km apart (z=6 grid); echo this close is already "here". */
const OVER_KM = 8;
/** Pin timeline: horizon and step (minutes). */
const TIMELINE_MIN = 90;
const TIMELINE_STEP = 5;
const CLOSE_KM = 20;
/** A level-3+ echo within this distance is "imminent" regardless of tracking. */
const IMMINENT_KM = 15;
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
/** Regional (pin-centred NCC) motion is a fallback — accept it a bit more readily. */
const REGIONAL_CONFIDENCE_MIN = 60;

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
  const local = pool.filter((s) => haversineKm(seed.lat, seed.lon, s.lat, s.lon) <= CORE_RADIUS_KM);
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
/** NCC grid cell — matches the ~3 km sample spacing so 10-min shifts are not quantised to 30 km/h. */
const CELL_KM = 3;
const GRID_HALF_CELLS = 20; // ±60 km
const GRID_N = GRID_HALF_CELLS * 2;
const SMOOTH_RADIUS = 3; // ~20 km box — large-scale envelope
const NCC_MIN = 0.4;
const PAIR_AGREE_DEG = 40;
const MAX_SHIFT_KM = 70;
const MAX_SHIFT_CELLS = 24;

type MotionEst = {
  speed: number;
  bearing: number;
  from: { lat: number; lon: number };
  confidence: number;
};

function kmToLatDeg(km: number) {
  return km / 111;
}
function kmToLonDeg(km: number, lat: number) {
  return km / (111 * Math.max(Math.cos((lat * Math.PI) / 180), 0.25));
}

function samplesToGrid(samples: RadarSample[], lat0: number, lon0: number): Float64Array {
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

function bestNccShift(
  a: Float64Array,
  b: Float64Array,
  maxC: number,
): { dix: number; diy: number; score: number } | null {
  // Coarse-to-fine: the smoothed field is ~20 km wide, so a stride-2 scan cannot skip
  // the peak; refine ±1 around the best coarse shift. ~5× fewer correlations.
  const stride = maxC > 6 ? 2 : 1;
  let best: { dix: number; diy: number; score: number } | null = null;
  const consider = (dix: number, diy: number) => {
    const score = nccAtShift(a, b, dix, diy);
    if (score < NCC_MIN) return;
    if (!best || score > best.score) best = { dix, diy, score };
  };
  for (let diy = -maxC; diy <= maxC; diy += stride) {
    for (let dix = -maxC; dix <= maxC; dix += stride) consider(dix, diy);
  }
  if (!best || stride === 1) return best;
  const c: { dix: number; diy: number } = best;
  for (let diy = c.diy - 1; diy <= c.diy + 1; diy++) {
    for (let dix = c.dix - 1; dix <= c.dix + 1; dix++) {
      if (Math.abs(dix) > maxC || Math.abs(diy) > maxC) continue;
      if (dix === c.dix && diy === c.diy) continue;
      consider(dix, diy);
    }
  }
  return best;
}

function pairMotionNcc(
  prev: RadarSample[],
  next: RadarSample[],
  lat0: number,
  lon0: number,
  hours: number,
): { speed: number; bearing: number; moved: number; score: number } | null {
  if (hours <= 0) return null;
  const rawA = samplesToGrid(prev, lat0, lon0);
  const rawB = samplesToGrid(next, lat0, lon0);
  if (gridRainCells(rawA) < 4 || gridRainCells(rawB) < 4) return null;
  const a = boxSmooth(rawA, SMOOTH_RADIUS);
  const b = boxSmooth(rawB, SMOOTH_RADIUS);
  const maxKm = Math.min(MAX_SPEED * hours, MAX_SHIFT_KM);
  const maxC = Math.max(1, Math.min(MAX_SHIFT_CELLS, Math.ceil(maxKm / CELL_KM)));
  const best = bestNccShift(a, b, maxC);
  if (!best) return null;
  if (best.dix === 0 && best.diy === 0) {
    return { speed: 0, bearing: 0, moved: 0, score: best.score };
  }
  // Sub-cell refinement: fit a parabola through the NCC peak and its neighbours.
  const refine = (axis: "x" | "y") => {
    const at = (d: number) =>
      axis === "x"
        ? nccAtShift(a, b, best.dix + d, best.diy)
        : nccAtShift(a, b, best.dix, best.diy + d);
    const m = at(-1);
    const c = best.score;
    const pl = at(1);
    const denom = m - 2 * c + pl;
    if (m < NCC_MIN || pl < NCC_MIN || denom >= 0) return 0;
    return Math.max(-0.5, Math.min(0.5, (0.5 * (m - pl)) / denom));
  };
  const fx = best.dix + refine("x");
  const fy = best.diy + refine("y");
  const dLat = fy * kmToLatDeg(CELL_KM);
  const dLon = fx * kmToLonDeg(CELL_KM, lat0);
  const moved = haversineKm(lat0, lon0, lat0 + dLat, lon0 + dLon);
  const speed = moved / hours;
  if (speed > MAX_SPEED) return null;
  return {
    speed,
    bearing: bearingDeg(lat0, lon0, lat0 + dLat, lon0 + dLon),
    moved,
    score: best.score,
  };
}

function systemMotion(frames: RadarMemoryFrame[], lat0: number, lon0: number): MotionEst | null {
  if (frames.length < 2) return null;
  type Part = { deg: number; w: number; speed: number; score: number };
  const parts: Part[] = [];

  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const next = frames[i];
    if (!prev || !next) continue;
    const hours = (next.time - prev.time) / 3600;
    const m = pairMotionNcc(prev.samples, next.samples, lat0, lon0, hours);
    if (!m || m.speed < 1) continue;
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
    if (mAll && mAll.speed >= 1) {
      parts.push({
        deg: mAll.bearing,
        w: Math.max(mAll.moved, 1) * 2.5 * Math.max(mAll.score, 0.4),
        speed: mAll.speed,
        score: mAll.score,
      });
    }
  }
  if (parts.length === 0) return null;

  // QC: drop pair vectors that disagree with the weighted circular mean
  let bearing = circularMeanDeg(parts);
  if (bearing == null) return null;
  const kept = parts.filter((p) => angleDiffDeg(p.deg, bearing!) <= PAIR_AGREE_DEG);
  const use = kept.length > 0 ? kept : parts;
  bearing = circularMeanDeg(use);
  if (bearing == null) return null;
  // Need at least one solid correlation
  if (Math.max(...use.map((p) => p.score)) < NCC_MIN) return null;

  const wsum = use.reduce((s, p) => s + p.w, 0);
  const speed = use.reduce((s, p) => s + p.speed * p.w, 0) / wsum;
  if (speed > MAX_SPEED || speed < 1) return null;
  const hoursAll = first && last && last.time > first.time ? (last.time - first.time) / 3600 : 0.5;
  const from = destPoint(lat0, lon0, (bearing + 180) % 360, Math.max(speed * hoursAll, 8));
  const bestScore = Math.max(...use.map((p) => p.score));
  const confidence = Math.round(
    Math.min(
      95,
      40 + bestScore * 40 + Math.min(use.length, 3) * 8 + (kept.length === parts.length ? 5 : 0),
    ),
  );
  return { speed, bearing, from, confidence };
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

function maxRateWithin(samples: RadarSample[], lat: number, lon: number, maxKm: number): number {
  let max = 0;
  for (const s of samples) {
    if (haversineKm(lat, lon, s.lat, s.lon) > maxKm) continue;
    // Synthetic samples carry only a level → use the class floor.
    const r = s.rate ?? (s.level > 0 ? LEVEL_MIN_RATE[s.level as 1 | 2 | 3 | 4] : 0);
    if (r > max) max = r;
  }
  return max;
}

/**
 * Rain at the pin for the next 90 minutes by backward advection: the air that will be
 * over the pin at time t is now at pin − v·t. With no usable motion, persistence.
 */
function pinTimeline(
  samples: RadarSample[],
  pinLat: number,
  pinLon: number,
  motion: { bearing: number; speedKmh: number } | null,
): TimelinePoint[] {
  const out: TimelinePoint[] = [];
  const near = nearPin(samples, pinLat, pinLon, TRACK_MAX_KM + OVER_KM);
  const radius = OVER_KM * 0.75;
  for (let t = 0; t <= TIMELINE_MIN; t += TIMELINE_STEP) {
    let at = { lat: pinLat, lon: pinLon };
    if (motion && t > 0) {
      const back = (motion.bearing + 180) % 360;
      at = destPoint(pinLat, pinLon, back, motion.speedKmh * (t / 60));
    }
    const grow = motion ? 0.15 * motion.speedKmh * (t / 60) : 0;
    const rate = maxRateWithin(near, at.lat, at.lon, radius + Math.min(grow, 6));
    out.push({ t, level: levelFromRate(rate), rate: Math.round(rate * 10) / 10 });
  }
  return out;
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
  // Spatial hash: only samples in the same or neighbouring linkKm-sized buckets can
  // be linked, which turns the all-pairs scan (n² haversines) into ~n·k.
  const dLat = linkKm / 111;
  const buckets = new Map<string, number[]>();
  const keyOf = (s: RadarSample) => {
    const dLon = linkKm / (111 * Math.max(Math.cos((s.lat * Math.PI) / 180), 0.25));
    return { bx: Math.floor(s.lon / dLon), by: Math.floor(s.lat / dLat) };
  };
  const keys: { bx: number; by: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const k = keyOf(pool[i]!);
    keys[i] = k;
    const id = `${k.bx},${k.by}`;
    const list = buckets.get(id);
    if (list) list.push(i);
    else buckets.set(id, [i]);
  }
  for (let i = 0; i < n; i++) {
    const a = pool[i]!;
    const k = keys[i]!;
    for (let by = k.by - 1; by <= k.by + 1; by++) {
      for (let bx = k.bx - 1; bx <= k.bx + 1; bx++) {
        const list = buckets.get(`${bx},${by}`);
        if (!list) continue;
        for (const j of list) {
          if (j <= i) continue;
          const b = pool[j]!;
          if (haversineKm(a.lat, a.lon, b.lat, b.lon) <= linkKm) {
            const ra = find(i);
            const rb = find(j);
            if (ra !== rb) parent[rb] = ra;
          }
        }
      }
    }
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
    const near = pool.filter((s) => haversineKm(t.mass.lat, t.mass.lon, s.lat, s.lon) <= 40);
    return {
      time: t.time,
      samples: near.length >= 5 ? near : pool,
      maxLevel: t.mass.maxLevel,
      nearestKm: null,
    };
  });
  const field = systemMotion(coreFrames, last.mass.lat, last.mass.lon);

  const trailOk = trailMot && trailMot.speed >= MIN_MOVE_SPEED && moved >= 10;
  const fieldOk = field && field.speed >= MIN_MOVE_SPEED;

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

function makeTrack(now: { lat: number; lon: number }, motion: MotionEst): CellTrack {
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

/** "Burza" is earned by a strike near the cell — klasa 4 alone is Ulewa. */
export function stormNoun(level: number, lightningNearCell: boolean): string {
  if (lightningNearCell && level >= 3) return "Burza";
  if (level >= 3) return "Ulewa";
  return "Deszcz";
}

/**
 * @param sampleOrigin — radar crop center. Tracks/arrows are built only from this window
 *   (and from frame updates). The user pin must NOT change which arrows are drawn.
 *   Pin drives ETA / hit-miss / chance / copy / IMGW warning match.
 */
export function computeThreat(
  place: Place,
  frames: RadarMemoryFrame[],
  warnings: OfficialWarning[],
  radiusKm: number,
  sampleOrigin: { lat: number; lon: number } = place,
  strikes: LightningStrike[] = [],
): Threat {
  const matched = warnings.filter((w) => w.matchesPlace && w.stormRelated);
  // Frames are already cropped to the radar domain (Poland). Do not re-crop around the pin.
  const usable = frames
    .filter((f) => f.samples.some((s) => s.level >= 1))
    .sort((a, b) => a.time - b.time);
  const last = usable.at(-1);

  const lastSamples = last?.samples ?? [];
  const maxLevel = maxLevelWithin(lastSamples, place.lat, place.lon, LOCAL_MAX_KM);
  const pinLevel = maxLevelWithin(lastSamples, place.lat, place.lon, OVER_KM);
  /** Strongest echo close enough to count as "imminent" even without a motion vector. */
  const closeLevel = maxLevelWithin(lastSamples, place.lat, place.lon, IMMINENT_KM);
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
  const tracks: CellTrack[] = [];
  let threatTrack: CellTrack | null = null;
  let threatCellLevel = 0;

  if (usable.length >= 2 && last) {
    const layers: MassLayer[] = usable.map((f) => ({
      time: f.time,
      masses: segmentMasses(
        f.samples.filter((s) => s.level >= 1),
        LINK_KM,
      ),
    }));
    // Rank by storm strength in the radar domain — never by distance to the user pin.
    const nowMasses = [...(layers.at(-1)?.masses ?? [])].sort((a, b) => {
      if (b.maxLevel !== a.maxLevel) return b.maxLevel - a.maxLevel;
      if (b.samples.length !== a.samples.length) return b.samples.length - a.samples.length;
      const da = haversineKm(a.lat, a.lon, sampleOrigin.lat, sampleOrigin.lon);
      const db = haversineKm(b.lat, b.lon, sampleOrigin.lat, sampleOrigin.lon);
      return da - db;
    });

    type Hit = {
      miss: number;
      eta: number;
      approaching: boolean;
      receding: boolean;
      speed: number;
      bearing: number;
      track: CellTrack;
      level: number;
      dNow: number;
      pinRelevant: boolean;
    };
    const hits: Hit[] = [];

    for (const mass of nowMasses) {
      const trail = buildMassTrail(mass, layers);
      const motion = motionForMass(trail);
      if (!motion || motion.speed < MIN_MOVE_SPEED) continue;
      if (motion.confidence < MOTION_CONFIDENCE_MIN) continue;

      const anchor = { lat: mass.lat, lon: mass.lon };
      const dNow =
        nearestWithin(mass.samples, place.lat, place.lon, TRACK_MAX_KM) ??
        haversineKm(place.lat, place.lon, anchor.lat, anchor.lon);

      const approach = closestApproach(
        anchor.lat,
        anchor.lon,
        motion.bearing,
        motion.speed,
        place.lat,
        place.lon,
      );
      const ahead = destPoint(anchor.lat, anchor.lon, motion.bearing, 15);
      const dAhead = haversineKm(place.lat, place.lon, ahead.lat, ahead.lon);
      const dThen = haversineKm(place.lat, place.lon, motion.from.lat, motion.from.lon);
      const closing = dAhead < dNow - 0.4;
      const cellApproaching = dNow < dThen - 0.6;
      const approachingHit = closing || cellApproaching;
      const track = makeTrack(anchor, motion);

      hits.push({
        miss: approach.d,
        eta: approach.t,
        approaching: approachingHit,
        receding: dAhead > dNow + 0.4 && dNow > dThen + 0.6,
        speed: motion.speed,
        bearing: motion.bearing,
        track,
        level: mass.maxLevel,
        dNow,
        pinRelevant: dNow <= TRACK_MAX_KM,
      });
    }

    // Glyphs: highest-confidence masses (pin-independent).
    hits.sort((a, b) => b.track.confidence - a.track.confidence || b.level - a.level);
    for (const hit of hits) {
      if (tracks.length >= MAX_TRACKS) break;
      hit.track.threatening = tracks.length === 0;
      tracks.push(hit.track);
    }

    // Pin narrative only: closest mass to the pin owns ETA / copy — does not reshape arrows.
    const forPin = [...hits].sort((a, b) => a.dNow - b.dNow);
    const primary = forPin.find((h) => h.pinRelevant) ?? null;
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
    }
  }

  // Motion for the pin: the primary mass's own track, else a regional NCC estimate of
  // the whole field around the pin (±60 km). Without it we can only assume persistence.
  let pinMotion: { bearing: number; speedKmh: number } | null =
    threatTrack && speedKmh !== null && speedKmh >= MIN_MOVE_SPEED
      ? { bearing: threatTrack.bearing, speedKmh }
      : null;
  if (!pinMotion && usable.length >= 2 && nearestKm !== null) {
    // Centre the correlation window on the echo that matters (nearest to the pin),
    // not on the pin — the pin may be 80 km from the nearest rain.
    let center = { lat: place.lat, lon: place.lon };
    let bestD = Infinity;
    for (const smp of lastSamples) {
      const d = haversineKm(place.lat, place.lon, smp.lat, smp.lon);
      if (d < bestD) {
        bestD = d;
        center = { lat: smp.lat, lon: smp.lon };
      }
    }
    if (bestD > 25) {
      // Step ~20 km from the nearest echo further into the rain, so the window is not half empty.
      const inward = bearingDeg(place.lat, place.lon, center.lat, center.lon);
      center = destPoint(center.lat, center.lon, inward, 20);
    }
    const regional = systemMotion(usable, center.lat, center.lon);
    if (
      regional &&
      regional.speed >= MIN_MOVE_SPEED &&
      regional.confidence >= REGIONAL_CONFIDENCE_MIN
    ) {
      pinMotion = { bearing: regional.bearing, speedKmh: regional.speed };
      if (speedKmh === null) {
        speedKmh = regional.speed;
        comingFrom = comingFromPl(regional.bearing);
        toward = towardPl(regional.bearing);
      }
    }
  }
  const timeline = last ? pinTimeline(lastSamples, place.lat, place.lon, pinMotion) : [];
  const tlFirst = pinMotion ? (timeline.find((p) => p.t > 0 && p.level >= 1) ?? null) : null;
  const tlMaxLevel = timeline.reduce<RadarLevel>((m, p) => (p.level > m ? p.level : m), 0);

  if (nearestKm !== null && nearestKm <= OVER_KM && pinLevel >= 1) {
    etaMin = 0;
    willHit = true;
    receding = false;
  } else if (pinMotion) {
    // With a motion vector, hit / miss / ETA come from advecting the actual echo
    // samples over the pin — not from where the mass *centroid* passes. A 50 km front
    // whose centre passes 20 km beside you still rains on you.
    if (tlFirst) {
      willHit = true;
      receding = false;
      approaching = true;
      etaMin = tlFirst.t;
      if (threatCellLevel < tlMaxLevel) threatCellLevel = tlMaxLevel;
    } else {
      willHit = false;
      etaMin = null;
    }
  } else if (nearestKm !== null && nearestKm <= CLOSE_KM) {
    // No motion at all: echo this close is treated as coming, with a crude ETA.
    willHit = true;
    receding = false;
    etaMin = Math.max(1, Math.round(nearestKm * 1.5));
  }

  const activeMatch = matched.filter((w) => isActive(w));
  const upcoming = matched.filter((w) => !isActive(w));
  // Brace for: what is over the pin, what is about to arrive, or what sits right next door.
  // Not the strongest echo 25 km away — that is context for the map, not for the copy.
  const expectLevel = Math.max(
    pinLevel,
    willHit || approaching ? threatCellLevel : 0,
    willHit ? tlMaxLevel : 0,
    closeLevel >= 3 ? closeLevel : 0,
  );
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
  if (nearestKm !== null && nearestKm <= OVER_KM && pinLevel >= 1) chance = Math.max(chance, 70);
  if (etaMin !== null && etaMin === 0 && pinLevel >= 1) chance = Math.max(chance, 80);
  if (etaMin !== null && etaMin > 0 && etaMin <= 20 && willHit) chance = Math.max(chance, 70);
  if (etaMin !== null && etaMin > 20 && etaMin <= 45 && willHit) chance = Math.max(chance, 50);
  if (nearestKm !== null && nearestKm <= PIN_KM && pinLevel >= 3) chance = Math.max(chance, 90);
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
    closeLevel >= 3
  ) {
    level = "imminent";
  }
  // "Nad Tobą" means over the pin — never a strong cell 20 km away plus drizzle here.
  if (nearestKm !== null && nearestKm <= OVER_KM && pinLevel >= 2) level = "now";
  if (upcoming.length > 0 && level === "clear") level = "watch";

  const formNote = "Komórka może też urosnąć na miejscu — tego radar nie zapowie.";
  const dist = nearestKm !== null ? `ok. ${nearestKm.toFixed(0)} km od ${who}` : `w okolicy ${who}`;

  let detail: string;
  if (etaMin === 0 && (pinLevel >= 1 || (nearestKm !== null && nearestKm <= PIN_KM))) {
    detail = `Opad jest nad ${who} teraz.${expect ? ` Spodziewaj się: ${expect}.` : ""} ${formNote}`;
  } else if (receding && aboutPin) {
    detail = `${comingFrom ? `Idzie od ${comingFrom}` : "Komórka"} (${dist}) i odchodzi na ${toward ?? "bok"}.${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. ${formNote}`;
  } else if (willHit && comingFrom) {
    const etaBit = etaMin && etaMin > 0 ? ` Dojście nad ${who}: ok. ${etaMin} min.` : "";
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
      activeMatch[0]?.body ?? upcoming[0]?.body ?? "Instytut wydał ostrzeżenie dla powiatu.";
    detail = `${body} Dla ${who} szansa z radaru ~${chance}% na ~45 min.`;
  } else if (level === "clear") {
    detail = `Nad ${who} radar nie widzi groźnej komórki w promieniu ${TRACK_MAX_KM} km. Szansa ~${chance}% na ok. 45 min. ${formNote}`;
  } else {
    detail = `Szansa ~${chance}% dla ${who}. ${formNote}`;
  }

  // Headline names the intensity that is (or will be) over the pin — "Burza" is earned
  // by lightning near that cell, not by a level-4 core alone.
  let lightningCell: { lat: number; lon: number } | null = threatTrack
    ? { lat: threatTrack.now.lat, lon: threatTrack.now.lon }
    : null;
  if (!lightningCell && lastSamples.length > 0) {
    let bestD = Infinity;
    for (const s of lastSamples) {
      const d = haversineKm(place.lat, place.lon, s.lat, s.lon);
      if (d < bestD) {
        bestD = d;
        lightningCell = { lat: s.lat, lon: s.lon };
      }
    }
    if (bestD > TRACK_MAX_KM) lightningCell = null;
  }
  const lightningNearCell = lightningCell ? strikeNearCell(strikes, lightningCell) : false;
  const noun = (lvl: number) => stormNoun(lvl, lightningNearCell);
  const copy: Record<ThreatLevel, string> = {
    clear: "Czysto",
    watch: "Ostrzeżenie IMGW",
    nearby: receding ? "Opad oddala się" : approaching ? "Opad nadciąga" : "Opad w okolicy",
    imminent: `${noun(expectLevel)} nadciąga`,
    now: `${noun(Math.max(pinLevel, 2))} nad Tobą`,
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
    pinLevel,
    cellLevel: Math.min(4, Math.max(0, expectLevel)) as RadarLevel,
    chancePct: chance,
    comingFrom,
    toward,
    willHit,
    missKm,
    expect,
    track: threatTrack,
    tracks,
    matchedWarnings: matched,
    timeline,
    timelineAdvected: pinMotion !== null,
    lightningNearCell,
  };
}
