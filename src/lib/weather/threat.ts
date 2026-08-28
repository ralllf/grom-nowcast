import { bearingDeg, comingFromPl, destPoint, haversineKm, towardPl } from "./geo.ts";
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
const LOCAL_MAX_KM = 25;
/** Radar z=5 sample spacing is ~12 km — this close is already "here". */
const OVER_KM = 12;
const CLOSE_KM = 20;
/** Draw the arrow on rain near the pin; motion itself comes from the whole field. */
const PIN_DRAW_KM = 50;
const FIELD_KM = 80;
const CELL_RADIUS_KM = 48;
const MATCH_KM = 45;
const MAX_SPEED = 95;
const MIN_MOVE_SPEED = 4;
const HORIZON_MIN = 90;
const MAX_TRACKS = 2;

function centroid(samples: RadarSample[]): { lat: number; lon: number } | null {
  if (samples.length === 0) return null;
  const w = samples.reduce((s, p) => s + p.level, 0);
  if (w <= 0) return null;
  return {
    lat: samples.reduce((s, p) => s + p.lat * p.level, 0) / w,
    lon: samples.reduce((s, p) => s + p.lon * p.level, 0) / w,
  };
}

/** Closer echo — used only to place the arrow, not to compute direction. */
function pinWeightedCentroid(
  samples: RadarSample[],
  lat: number,
  lon: number,
): { lat: number; lon: number } | null {
  let wsum = 0;
  let slat = 0;
  let slon = 0;
  for (const s of samples) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (d > PIN_DRAW_KM) continue;
    const w = s.level / Math.max(d, 8);
    wsum += w;
    slat += s.lat * w;
    slon += s.lon * w;
  }
  if (wsum <= 0) return null;
  return { lat: slat / wsum, lon: slon / wsum };
}

const GRID_STEP = 0.1;
const GRID_HALF = 8;
const GRID_N = GRID_HALF * 2;

function rainGrid(samples: RadarSample[], lat0: number, lon0: number): Float64Array {
  const n = GRID_N;
  const g = new Float64Array(n * n);
  for (const s of samples) {
    if (s.level < 1) continue;
    if (haversineKm(lat0, lon0, s.lat, s.lon) > FIELD_KM) continue;
    const ix = Math.round((s.lon - lon0) / GRID_STEP) + GRID_HALF;
    const iy = Math.round((s.lat - lat0) / GRID_STEP) + GRID_HALF;
    if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
    const i = iy * n + ix;
    if (s.level > g[i]) g[i] = s.level;
  }
  return g;
}

function shiftScore(a: Float64Array, b: Float64Array, dix: number, diy: number): number {
  const n = GRID_N;
  let num = 0;
  let rain = 0;
  for (let iy = 0; iy < n; iy++) {
    const jy = iy + diy;
    if (jy < 0 || jy >= n) continue;
    for (let ix = 0; ix < n; ix++) {
      const jx = ix + dix;
      if (jx < 0 || jx >= n) continue;
      const av = a[iy * n + ix] ?? 0;
      const bv = b[jy * n + jx] ?? 0;
      if (av <= 0 && bv <= 0) continue;
      num += av * bv;
      rain += av + bv;
    }
  }
  return rain > 6 ? num : 0;
}

function fieldShift(
  prev: RadarSample[],
  now: RadarSample[],
  lat0: number,
  lon0: number,
  hours: number,
): { speed: number; bearing: number; moved: number } | null {
  if (hours <= 0) return null;
  const a = rainGrid(prev, lat0, lon0);
  const b = rainGrid(now, lat0, lon0);
  const maxKm = Math.min(MAX_SPEED * hours, 70);
  const maxC = Math.max(1, Math.min(6, Math.ceil(maxKm / (GRID_STEP * 111))));
  let best = { score: 0, dix: 0, diy: 0 };
  for (let diy = -maxC; diy <= maxC; diy++) {
    for (let dix = -maxC; dix <= maxC; dix++) {
      const score = shiftScore(a, b, dix, diy);
      if (score > best.score) best = { score, dix, diy };
    }
  }
  if (best.score < 2) return null;
  if (best.dix === 0 && best.diy === 0) return { speed: 0, bearing: 0, moved: 0 };
  const dLat = best.diy * GRID_STEP;
  const dLon = best.dix * GRID_STEP;
  const moved = haversineKm(lat0, lon0, lat0 + dLat, lon0 + dLon);
  const speed = moved / hours;
  if (speed > MAX_SPEED) return null;
  return {
    speed,
    bearing: bearingDeg(lat0, lon0, lat0 + dLat, lon0 + dLon),
    moved,
  };
}

function systemMotion(
  frames: RadarMemoryFrame[],
  lat0: number,
  lon0: number,
): { speed: number; bearing: number; from: { lat: number; lon: number } } | null {
  if (frames.length < 2) return null;
  const parts: { deg: number; w: number; speed: number }[] = [];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const next = frames[i];
    if (!prev || !next) continue;
    const hours = (next.time - prev.time) / 3600;
    const m = fieldShift(prev.samples, next.samples, lat0, lon0, hours);
    if (!m || m.speed < 1) continue;
    parts.push({ deg: m.bearing, w: Math.max(m.moved, 1), speed: m.speed });
  }
  const first = frames[0];
  const last = frames.at(-1);
  if (first && last && last.time > first.time) {
    const hoursAll = (last.time - first.time) / 3600;
    const mAll = fieldShift(first.samples, last.samples, lat0, lon0, hoursAll);
    if (mAll && mAll.speed >= 1) {
      parts.push({
        deg: mAll.bearing,
        w: Math.max(mAll.moved, 1) * 2.5,
        speed: mAll.speed,
      });
    }
  }
  if (parts.length === 0) {
    const trail: TrailPoint[] = [];
    for (const f of frames) {
      const c = centroid(nearPin(f.samples, lat0, lon0, FIELD_KM).filter((s) => s.level >= 1));
      if (c) trail.push({ ...c, time: f.time });
    }
    return motionFromTrail(trail);
  }
  const bearing = circularMeanDeg(parts);
  if (bearing == null) return null;
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  const speed = parts.reduce((s, p) => s + p.speed * p.w, 0) / wsum;
  if (speed > MAX_SPEED) return null;
  const hoursAll =
    first && last && last.time > first.time ? (last.time - first.time) / 3600 : 0.5;
  const from = destPoint(lat0, lon0, (bearing + 180) % 360, Math.max(speed * hoursAll, 8));
  return { speed, bearing, from };
}

type Cell = {
  lat: number;
  lon: number;
  maxLevel: number;
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

function clusterCells(samples: RadarSample[]): Cell[] {
  const pool = samples
    .filter((s) => s.level >= 1)
    .sort((a, b) => b.level - a.level || b.lat - a.lat);
  const used = new Uint8Array(pool.length);
  const cells: Cell[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    const seed = pool[i];
    if (!seed) continue;
    const members: RadarSample[] = [];
    for (let j = 0; j < pool.length; j++) {
      if (used[j]) continue;
      const s = pool[j];
      if (!s) continue;
      if (haversineKm(seed.lat, seed.lon, s.lat, s.lon) <= CELL_RADIUS_KM) {
        used[j] = 1;
        members.push(s);
      }
    }
    if (members.length < 3) continue;
    const c = centroid(members);
    if (!c) continue;
    cells.push({
      lat: c.lat,
      lon: c.lon,
      maxLevel: members.reduce((m, s) => Math.max(m, s.level), 0),
      samples: members,
    });
  }
  return cells.slice(0, 10);
}

function nearestCell(cell: Cell, pool: Cell[]): Cell | null {
  let best: Cell | null = null;
  let bestD = MATCH_KM;
  for (const prev of pool) {
    const d = haversineKm(prev.lat, prev.lon, cell.lat, cell.lon);
    if (d < bestD) {
      bestD = d;
      best = prev;
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

function buildTrail(cell: Cell, layers: { time: number; cells: Cell[] }[]): TrailPoint[] {
  const newest = layers.at(-1);
  if (!newest) return [];
  const trail: TrailPoint[] = [{ lat: cell.lat, lon: cell.lon, time: newest.time }];
  let cursor = cell;
  for (let i = layers.length - 2; i >= 0; i--) {
    const layer = layers[i];
    if (!layer) break;
    const prev = nearestCell(cursor, layer.cells);
    if (!prev) break;
    const hours = (trail[0]!.time - layer.time) / 3600;
    if (hours <= 0) break;
    const moved = haversineKm(prev.lat, prev.lon, cursor.lat, cursor.lon);
    if (moved / hours > MAX_SPEED) break;
    trail.unshift({ lat: prev.lat, lon: prev.lon, time: layer.time });
    cursor = prev;
  }
  return trail;
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
  motion: { speed: number; bearing: number; from: { lat: number; lon: number } },
): CellTrack {
  const moving = motion.speed >= MIN_MOVE_SPEED;
  const lookKm = moving ? Math.max(motion.speed * 0.55, 28) : 0;
  const back = destPoint(now.lat, now.lon, (motion.bearing + 180) % 360, 10);
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
  const from = Date.parse(warning.from.replace(" ", "T"));
  const to = Date.parse(warning.to.replace(" ", "T"));
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return now >= from - 30 * 60_000 && now <= to;
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

export function computeThreat(
  place: Place,
  frames: RadarMemoryFrame[],
  warnings: OfficialWarning[],
  radiusKm: number,
): Threat {
  const matched = warnings.filter((w) => w.matchesPlace && w.stormRelated);
  const usable = frames
    .filter((f) => nearPin(f.samples, place.lat, place.lon, TRACK_MAX_KM).some((s) => s.level >= 1))
    .sort((a, b) => a.time - b.time);
  const last = usable.at(-1);

  const lastSamples = last?.samples ?? [];
  const maxLevel = maxLevelWithin(lastSamples, place.lat, place.lon, LOCAL_MAX_KM);
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
    const clusterKm = TRACK_MAX_KM + CELL_RADIUS_KM;
    const layers = usable.map((f) => ({
      time: f.time,
      cells: clusterCells(nearPin(f.samples, place.lat, place.lon, clusterKm)),
    }));
    const nowCells = layers.at(-1)?.cells ?? [];

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
      pinLocal: boolean;
    };
    const hits: Hit[] = [];

    const pinNow = pinWeightedCentroid(last.samples, place.lat, place.lon);
    const pinMotion = systemMotion(usable, place.lat, place.lon);
    if (pinMotion && pinNow) {
      const dNow = haversineKm(place.lat, place.lon, pinNow.lat, pinNow.lon);
      const approach = closestApproach(
        pinNow.lat,
        pinNow.lon,
        pinMotion.bearing,
        pinMotion.speed,
        place.lat,
        place.lon,
      );
      const ahead = destPoint(pinNow.lat, pinNow.lon, pinMotion.bearing, 15);
      const dAhead = haversineKm(place.lat, place.lon, ahead.lat, ahead.lon);
      const moving = pinMotion.speed >= MIN_MOVE_SPEED;
      const track = makeTrack(pinNow, pinMotion);
      hits.push({
        miss: approach.d,
        eta: approach.t,
        approaching: dAhead < dNow - 0.4,
        receding: dAhead > dNow + 0.4,
        speed: pinMotion.speed,
        bearing: pinMotion.bearing,
        track,
        level: maxLevelWithin(lastSamples, place.lat, place.lon, PIN_DRAW_KM),
        dNow,
        pinLocal: true,
      });
      if (moving) tracks.push(track);
    }

    for (const cell of nowCells) {
      const dNow = haversineKm(place.lat, place.lon, cell.lat, cell.lon);
      if (dNow > TRACK_MAX_KM) continue;
      if (pinNow && haversineKm(cell.lat, cell.lon, pinNow.lat, pinNow.lon) < 40) continue;
      const motion = motionFromTrail(buildTrail(cell, layers));
      if (!motion) continue;
      const moving = motion.speed >= MIN_MOVE_SPEED;
      const approach = closestApproach(
        cell.lat,
        cell.lon,
        motion.bearing,
        motion.speed,
        place.lat,
        place.lon,
      );
      const dThen = haversineKm(place.lat, place.lon, motion.from.lat, motion.from.lon);
      const cellApproaching = dNow < dThen - 0.6;
      const hitsPin = approach.d <= PIN_KM && moving;
      const track = makeTrack({ lat: cell.lat, lon: cell.lon }, motion);
      const hit: Hit = {
        miss: approach.d,
        eta: approach.t,
        approaching: cellApproaching,
        receding: dNow > dThen + 0.6,
        speed: motion.speed,
        bearing: motion.bearing,
        track,
        level: cell.maxLevel,
        dNow,
        pinLocal: false,
      };
      if (moving && (hitsPin || cellApproaching)) hits.push(hit);
    }

    hits.sort((a, b) => {
      const rank = (h: Hit) =>
        (h.pinLocal ? 0 : 1) * 1000 +
        h.dNow -
        (h.miss <= PIN_KM ? 25 : 0) -
        (h.approaching ? 8 : 0);
      return rank(a) - rank(b);
    });
    const bestHit = hits[0] ?? null;

    if (bestHit) {
      missKm = bestHit.miss;
      approaching = bestHit.approaching;
      receding = bestHit.receding;
      comingFrom = comingFromPl(bestHit.bearing);
      toward = towardPl(bestHit.bearing);
      threatCellLevel = bestHit.level;
      if (bestHit.speed >= MIN_MOVE_SPEED) speedKmh = bestHit.speed;
      willHit = bestHit.miss <= PIN_KM;
      bestHit.track.threatening = true;
      threatTrack = bestHit.track;
      if (!tracks.includes(bestHit.track) && bestHit.speed >= MIN_MOVE_SPEED) {
        tracks.unshift(bestHit.track);
      }
    }

    const extras = hits.filter((h) => h.track !== threatTrack && (h.track.threatening || h.approaching));
    for (const extra of extras) {
      extra.track.threatening = extra.miss <= PIN_KM || (extra.approaching && extra.miss <= 12);
      if (!tracks.includes(extra.track)) tracks.push(extra.track);
    }
    tracks.sort(
      (a, b) =>
        Number(b.threatening) - Number(a.threatening) ||
        haversineKm(place.lat, place.lon, a.now.lat, a.now.lon) -
          haversineKm(place.lat, place.lon, b.now.lat, b.now.lon),
    );
    if (tracks.length > MAX_TRACKS) tracks.length = MAX_TRACKS;
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
        threatTrack.now.lat,
        threatTrack.now.lon,
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
    tracks,
    matchedWarnings: matched,
  };
}
