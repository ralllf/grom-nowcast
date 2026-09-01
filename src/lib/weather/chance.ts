/**
 * Slice 8 — Szansa remapped to the Slice-0 calibration table.
 *
 * The raw ladder in `threat.ts` produces pin rungs (10 / 50 / 60 / 70 / 80 / 90).
 * Older area rungs (25 / 40 / 55) stay in the table for leftover values. This
 * module maps those rungs to the observed rain frequency from
 * `docs/HINDCAST-LOG.md` (2026-08-31 midday, RainViewer, echo ≤ 100 km, rain ≥
 * klasa 1 over the pin within 60 min).
 *
 * There is no SRI-era log row and no held-out day yet — the table is the one
 * published row. Bins with n < 20 are mapped conservatively and are not held
 * to the ±10 pt reliability gate.
 *
 * Apply only when echo is within TRACK_MAX_KM. Dry / IMGW-only pins are not in
 * the table; their raw rungs stay as written.
 */

export type SzansaCalibBin = {
  /** Inclusive raw-rung range (after `roundPct`). */
  rawLo: number;
  rawHi: number;
  n: number;
  meanRawPct: number;
  observedPct: number;
  /** What GROM ships after Slice 8. */
  shippedPct: number;
};

/**
 * Published Slice-0 table, compacted to the bins the remapper uses.
 * `observedPct` is rounded to the nearest percent from the JSON archive.
 */
export const SZANSA_CALIBRATION: {
  source: "hindcast-log-2026-08-31-midday";
  radar: "rainviewer";
  heldOut: false;
  minNForGate: 20;
  bins: readonly SzansaCalibBin[];
} = {
  source: "hindcast-log-2026-08-31-midday",
  radar: "rainviewer",
  heldOut: false,
  minNForGate: 20,
  bins: [
    { rawLo: 0, rawHi: 19, n: 219, meanRawPct: 10.3, observedPct: 10, shippedPct: 10 },
    // n=2 observed 0% — too few; don't print "0%" as if we know it never rains.
    { rawLo: 20, rawHi: 29, n: 2, meanRawPct: 22.5, observedPct: 0, shippedPct: 10 },
    { rawLo: 30, rawHi: 39, n: 0, meanRawPct: 0, observedPct: 0, shippedPct: 15 },
    { rawLo: 40, rawHi: 49, n: 1, meanRawPct: 40, observedPct: 0, shippedPct: 15 },
    { rawLo: 50, rawHi: 59, n: 28, meanRawPct: 55, observedPct: 18, shippedPct: 20 },
    { rawLo: 60, rawHi: 69, n: 75, meanRawPct: 60, observedPct: 56, shippedPct: 55 },
    { rawLo: 70, rawHi: 79, n: 27, meanRawPct: 70, observedPct: 89, shippedPct: 90 },
    { rawLo: 80, rawHi: 89, n: 109, meanRawPct: 80, observedPct: 90, shippedPct: 90 },
    { rawLo: 90, rawHi: 100, n: 33, meanRawPct: 90, observedPct: 100, shippedPct: 95 },
  ],
};

export function calibrateChancePct(rawPct: number): number {
  const raw = Math.max(0, Math.min(100, rawPct));
  const bin = SZANSA_CALIBRATION.bins.find((b) => raw >= b.rawLo && raw <= b.rawHi);
  return bin?.shippedPct ?? 10;
}

/** Reliability gate from the plan: |shipped − observed| ≤ 10 pts when n is large enough. */
export function calibBinWithinGate(bin: SzansaCalibBin, slackPts = 10): boolean {
  if (bin.n < SZANSA_CALIBRATION.minNForGate) return true;
  return Math.abs(bin.shippedPct - bin.observedPct) <= slackPts;
}
