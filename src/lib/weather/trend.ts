/**
 * Slice 9 — per-mass intensity/area trend over the existing 4-frame trail.
 *
 * Copy ("Komórka rośnie / słabnie") always ships. Timeline / ETA math is
 * implemented (Lagrangian ΔR, 15–20 min apply, ~30 min e-fold) but stays
 * behind GROWTH_MATH_ENABLED. The Slice-0 gate needs ≥ 3 convective log days
 * (docs/HINDCAST-LOG.md has 2 front rows, 0 convective). The live flag stays
 * false until that ledger exists and the POD/FAR/bias check passes.
 */

import { haversineKm } from "./geo.ts";
import { levelFromRate } from "./palette.ts";
import type { CellTrend, TimelinePoint } from "./types.ts";

export type { CellTrend };

export type TrailSnap = {
  time: number;
  maxLevel: number;
  sampleCount: number;
  /** Mean of sample levels — area-weighted intensity, not just the core pixel. */
  meanLevel: number;
};

/** One analysis sample on a mass trail — mm/h, for Lagrangian pairing. */
export type TrailCell = { lat: number; lon: number; rate: number };

export type RateTrailSnap = {
  time: number;
  cells: TrailCell[];
};

/** Full fitted ΔR for this many minutes, then damp toward zero (S-PROG/STEPS). */
export const GROWTH_APPLY_MIN = 18;
/** e-folding time of the increment after GROWTH_APPLY_MIN. */
export const GROWTH_EFOLD_MIN = 30;
/** Residual match gate after bulk mass motion (same 2-cell link as masses). */
export const GROWTH_MATCH_KM = 6.5;

/** Plan gate: ≥ 3 convective log days, POD +20…+40 up, FAR up < 3 pts, ETA p50 toward 0. */
export const GROWTH_GATE = {
  requiredConvectiveDays: 3,
  /** Hand-typed regime on published HINDCAST-LOG rows. Both are `front`. */
  loggedConvectiveDays: 0,
  loggedDays: 2,
  requiredLoggedDaysForSlice0: 5,
};

/** Math adjustment of timeline / ETA. Off until the ledger can host the gate. */
export const GROWTH_MATH_ENABLED = false;

export function growthGatePasses(gate = GROWTH_GATE): boolean {
  return gate.loggedConvectiveDays >= gate.requiredConvectiveDays;
}

export function cellTrendCopy(trend: CellTrend): string | null {
  if (trend === "growing") return "Komórka rośnie";
  if (trend === "decaying") return "Komórka słabnie";
  return null;
}

/**
 * Oldest → newest snaps of one identity (buildMassTrail). Needs ≥ 2 frames.
 * Intensity (max / mean level) and area (sample count) vote; a single noisy
 * axis is not enough unless maxLevel itself stepped.
 */
export function cellTrendFromSnaps(snaps: TrailSnap[]): CellTrend {
  if (snaps.length < 2) return null;
  const first = snaps[0];
  const last = snaps.at(-1);
  if (!first || !last) return null;
  if (last.time <= first.time) return null;
  if (first.sampleCount < 1 || last.sampleCount < 1) return null;

  const dMax = last.maxLevel - first.maxLevel;
  const dMean = last.meanLevel - first.meanLevel;
  const dArea = (last.sampleCount - first.sampleCount) / first.sampleCount;

  const intensityUp = dMax >= 1 || dMean >= 0.35;
  const intensityDown = dMax <= -1 || dMean <= -0.35;
  const areaUp = dArea >= 0.25;
  const areaDown = dArea <= -0.25;

  const growVotes = Number(intensityUp) + Number(areaUp);
  const decayVotes = Number(intensityDown) + Number(areaDown);

  if (dMax >= 1 && !intensityDown) return "growing";
  if (dMax <= -1 && !intensityUp) return "decaying";
  if (growVotes > decayVotes && (intensityUp || (areaUp && dMean >= 0))) return "growing";
  if (decayVotes > growVotes && (intensityDown || (areaDown && dMean <= 0))) return "decaying";
  return null;
}

function meanPoint(cells: TrailCell[]): { lat: number; lon: number } | null {
  if (cells.length === 0) return null;
  let lat = 0;
  let lon = 0;
  for (const c of cells) {
    lat += c.lat;
    lon += c.lon;
  }
  return { lat: lat / cells.length, lon: lon / cells.length };
}

/**
 * Pair cells between two trail snaps. Gate is residual GROWTH_MATCH_KM plus
 * the bulk centroid hop so a translating mass still matches the same parcels.
 */
function matchTrailCells(
  prev: TrailCell[],
  next: TrailCell[],
  matchKm = GROWTH_MATCH_KM,
): { prev: TrailCell; next: TrailCell }[] {
  if (prev.length === 0 || next.length === 0) return [];
  const c0 = meanPoint(prev);
  const c1 = meanPoint(next);
  const bulk =
    c0 && c1 ? haversineKm(c0.lat, c0.lon, c1.lat, c1.lon) : 0;
  const gate = matchKm + bulk;
  const candidates: { i: number; j: number; d: number }[] = [];
  for (let i = 0; i < next.length; i++) {
    const a = next[i]!;
    for (let j = 0; j < prev.length; j++) {
      const b = prev[j]!;
      const d = haversineKm(a.lat, a.lon, b.lat, b.lon);
      if (d <= gate) candidates.push({ i, j, d });
    }
  }
  candidates.sort((a, b) => a.d - b.d);
  const usedI = new Set<number>();
  const usedJ = new Set<number>();
  const pairs: { prev: TrailCell; next: TrailCell }[] = [];
  for (const c of candidates) {
    if (usedI.has(c.i) || usedJ.has(c.j)) continue;
    usedI.add(c.i);
    usedJ.add(c.j);
    pairs.push({ prev: prev[c.j]!, next: next[c.i]! });
  }
  return pairs;
}

/**
 * Lagrangian ΔR: sum of (rate_new − rate_old) over matched cells on each hop.
 * Unmatched leftovers / new echo do not enter — not first-vs-last mass count.
 */
export function lagrangianDeltaR(
  snaps: RateTrailSnap[],
  matchKm = GROWTH_MATCH_KM,
): number {
  let delta = 0;
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const next = snaps[i];
    if (!prev || !next || next.time <= prev.time) continue;
    for (const pair of matchTrailCells(prev.cells, next.cells, matchKm)) {
      delta += pair.next.rate - pair.prev.rate;
    }
  }
  return delta;
}

/**
 * Fitted d(mean rate)/dt in mm/h per minute from the matched-cell hops.
 */
export function lagrangianMeanRateSlope(
  snaps: RateTrailSnap[],
  matchKm = GROWTH_MATCH_KM,
): number {
  let deltaMean = 0;
  let dtSec = 0;
  for (let i = 1; i < snaps.length; i++) {
    const prev = snaps[i - 1];
    const next = snaps[i];
    if (!prev || !next) continue;
    const dt = next.time - prev.time;
    if (dt <= 0) continue;
    const pairs = matchTrailCells(prev.cells, next.cells, matchKm);
    if (pairs.length === 0) continue;
    let hop = 0;
    for (const pair of pairs) hop += pair.next.rate - pair.prev.rate;
    deltaMean += hop / pairs.length;
    dtSec += dt;
  }
  return dtSec > 0 ? deltaMean / (dtSec / 60) : 0;
}

/**
 * Increment (mm/h) at lead tMin: full slope for GROWTH_APPLY_MIN, then
 * the extra e-folds toward zero with GROWTH_EFOLD_MIN.
 */
export function dampedTrendIncrement(slopePerMin: number, tMin: number): number {
  if (tMin <= 0 || slopePerMin === 0) return 0;
  if (tMin <= GROWTH_APPLY_MIN) return slopePerMin * tMin;
  const peak = slopePerMin * GROWTH_APPLY_MIN;
  return peak * Math.exp(-(tMin - GROWTH_APPLY_MIN) / GROWTH_EFOLD_MIN);
}

/**
 * Add the damped Lagrangian increment to already-advected pin rates.
 * Dry / unknown steps stay put — growth does not invent echo.
 * Live default is GROWTH_MATH_ENABLED (false).
 */
export function applyGrowthToTimeline(
  timeline: TimelinePoint[],
  slopePerMin: number,
  enabled = GROWTH_MATH_ENABLED,
): TimelinePoint[] {
  if (!enabled || slopePerMin === 0 || timeline.length === 0) return timeline;
  return timeline.map((p) => {
    if (p.unknown || p.rate <= 0) return p;
    const extra = dampedTrendIncrement(slopePerMin, p.t);
    if (extra === 0) return p;
    const rate = Math.max(0, Math.round((p.rate + extra) * 10) / 10);
    return { ...p, rate, level: levelFromRate(rate) };
  });
}
