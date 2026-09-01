/**
 * Slice 9 — per-mass intensity/area trend over the existing 4-frame trail.
 *
 * Copy ("Komórka rośnie / słabnie") always ships. Timeline / ETA math does not:
 * the Slice-0 gate needs ≥ 3 convective log days (docs/HINDCAST-LOG.md has 2
 * front rows, 0 convective). GROWTH_MATH_ENABLED stays false until that ledger
 * exists and the POD/FAR/bias check passes.
 */

import type { CellTrend } from "./types.ts";

export type { CellTrend };

export type TrailSnap = {
  time: number;
  maxLevel: number;
  sampleCount: number;
  /** Mean of sample levels — area-weighted intensity, not just the core pixel. */
  meanLevel: number;
};

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
