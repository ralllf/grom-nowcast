/**
 * Szansa remapped by ladder *rung identity*, not the raw integer.
 *
 * The Slice-0 table (`docs/HINDCAST-LOG.md`, 2026-08-31 midday, RainViewer,
 * echo ≤ 100 km, rain ≥ klasa 1 over the pin within 60 min) measured
 * populations that no longer match today's raw numbers. The 50–59 bin
 * (n = 28, 18 % observed) was the removed close-echo rung; today's raw 50
 * is `willHitEta20to45` (willHit, ETA 20–45, klasa 1) — a different
 * identity. Leftover ids stay in the table for leftover values.
 *
 * There is no SRI-era row for the new mid-lead willHit rung and no held-out
 * day. Tiny-n / unmatched identities keep conservative shipped numbers.
 * This is not a ±10 pt reliability claim — `claimsReliabilityGate` is false.
 *
 * Apply only when echo is within TRACK_MAX_KM. Dry / IMGW-only pins are not
 * in the table; their raw rungs stay as written.
 */

export type ChanceRung =
  | "echoFar"
  | "legacyArea20"
  | "legacyArea30"
  | "legacyArea40"
  | "willHitEta20to45"
  | "legacyCloseEcho"
  | "willHitApproachingKlasa2"
  | "overPinKlasa2"
  | "willHitEtaLe20"
  | "overPinNowKlasa2"
  | "overPinKlasa3"
  | "receding"
  | "missBeside"
  | "imgwWatch";

export type SzansaCalibRung = {
  id: ChanceRung;
  /** Ladder integer this identity last used. Not a lookup key. */
  rawPct: number;
  n: number;
  observedPct: number | null;
  shippedPct: number;
};

export const SZANSA_CALIBRATION: {
  source: "hindcast-log-2026-08-31-midday";
  radar: "rainviewer";
  heldOut: false;
  /** One RainViewer morning; do not advertise a ±10 pt gate. */
  claimsReliabilityGate: false;
  rungs: readonly SzansaCalibRung[];
} = {
  source: "hindcast-log-2026-08-31-midday",
  radar: "rainviewer",
  heldOut: false,
  claimsReliabilityGate: false,
  rungs: [
    { id: "echoFar", rawPct: 10, n: 219, observedPct: 10, shippedPct: 10 },
    // n=2 observed 0% — too few; don't print "0%" as if we know it never rains.
    { id: "legacyArea20", rawPct: 25, n: 2, observedPct: 0, shippedPct: 10 },
    { id: "legacyArea30", rawPct: 35, n: 0, observedPct: null, shippedPct: 15 },
    { id: "legacyArea40", rawPct: 40, n: 1, observedPct: 0, shippedPct: 15 },
    // Today's willHit / ETA 20–45 / klasa 1. No matching identity in the
    // published row — keep the raw 50, do not wear the close-echo 18%.
    { id: "willHitEta20to45", rawPct: 50, n: 0, observedPct: null, shippedPct: 50 },
    // Same raw integer as willHitEta20to45. Old 50–59 close-echo population.
    { id: "legacyCloseEcho", rawPct: 50, n: 28, observedPct: 18, shippedPct: 20 },
    { id: "willHitApproachingKlasa2", rawPct: 60, n: 75, observedPct: 56, shippedPct: 55 },
    { id: "overPinKlasa2", rawPct: 70, n: 27, observedPct: 89, shippedPct: 90 },
    { id: "willHitEtaLe20", rawPct: 70, n: 27, observedPct: 89, shippedPct: 90 },
    { id: "overPinNowKlasa2", rawPct: 80, n: 109, observedPct: 90, shippedPct: 90 },
    { id: "overPinKlasa3", rawPct: 90, n: 33, observedPct: 100, shippedPct: 95 },
    { id: "receding", rawPct: 20, n: 2, observedPct: 0, shippedPct: 10 },
    { id: "missBeside", rawPct: 15, n: 219, observedPct: 10, shippedPct: 10 },
    { id: "imgwWatch", rawPct: 35, n: 0, observedPct: null, shippedPct: 15 },
  ],
};

const SHIPPED = new Map<ChanceRung, number>(
  SZANSA_CALIBRATION.rungs.map((r) => [r.id, r.shippedPct]),
);

export function calibrateChancePct(rung: ChanceRung): number {
  return SHIPPED.get(rung) ?? 10;
}
