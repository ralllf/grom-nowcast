import assert from "node:assert/strict";
import test from "node:test";
import {
  GROWTH_APPLY_MIN,
  GROWTH_EFOLD_MIN,
  GROWTH_GATE,
  GROWTH_MATH_ENABLED,
  applyGrowthToTimeline,
  cellTrendCopy,
  cellTrendFromSnaps,
  dampedTrendIncrement,
  growthGatePasses,
  lagrangianDeltaR,
  lagrangianMeanRateSlope,
  type RateTrailSnap,
  type TrailSnap,
} from "./trend.ts";
import type { TimelinePoint } from "./types.ts";

function snap(over: Partial<TrailSnap> & Pick<TrailSnap, "time">): TrailSnap {
  return {
    maxLevel: 2,
    sampleCount: 25,
    meanLevel: 2,
    ...over,
  };
}

test("one frame or a broken clock is not a trend", () => {
  assert.equal(cellTrendFromSnaps([]), null);
  assert.equal(cellTrendFromSnaps([snap({ time: 1000 })]), null);
  assert.equal(
    cellTrendFromSnaps([snap({ time: 2000, maxLevel: 4 }), snap({ time: 1000, maxLevel: 2 })]),
    null,
  );
});

test("steady intensity and area is not a trend", () => {
  assert.equal(
    cellTrendFromSnaps([
      snap({ time: 0 }),
      snap({ time: 600 }),
      snap({ time: 1200 }),
      snap({ time: 1800 }),
    ]),
    null,
  );
});

test("maxLevel step 2→4 over the trail is Komórka rośnie", () => {
  const trend = cellTrendFromSnaps([
    snap({ time: 0, maxLevel: 2, meanLevel: 2 }),
    snap({ time: 600, maxLevel: 2, meanLevel: 2.1 }),
    snap({ time: 1200, maxLevel: 3, meanLevel: 2.6 }),
    snap({ time: 1800, maxLevel: 4, meanLevel: 3.2 }),
  ]);
  assert.equal(trend, "growing");
  assert.equal(cellTrendCopy(trend), "Komórka rośnie");
});

test("maxLevel step 4→2 over the trail is Komórka słabnie", () => {
  const trend = cellTrendFromSnaps([
    snap({ time: 0, maxLevel: 4, meanLevel: 3.4 }),
    snap({ time: 600, maxLevel: 3, meanLevel: 2.8 }),
    snap({ time: 1200, maxLevel: 3, meanLevel: 2.4 }),
    snap({ time: 1800, maxLevel: 2, meanLevel: 2 }),
  ]);
  assert.equal(trend, "decaying");
  assert.equal(cellTrendCopy(trend), "Komórka słabnie");
});

test("area growth of ≥25% with non-falling intensity is growing", () => {
  assert.equal(
    cellTrendFromSnaps([
      snap({ time: 0, sampleCount: 20, meanLevel: 2 }),
      snap({ time: 1800, sampleCount: 32, meanLevel: 2.1 }),
    ]),
    "growing",
  );
});

test("area shrink of ≥25% with non-rising intensity is decaying", () => {
  assert.equal(
    cellTrendFromSnaps([
      snap({ time: 0, sampleCount: 40, meanLevel: 3 }),
      snap({ time: 1800, sampleCount: 22, meanLevel: 2.9 }),
    ]),
    "decaying",
  );
});

test("a one-sample jitter does not flip the label", () => {
  assert.equal(
    cellTrendFromSnaps([
      snap({ time: 0, sampleCount: 25, meanLevel: 2 }),
      snap({ time: 1800, sampleCount: 26, meanLevel: 2.04 }),
    ]),
    null,
  );
});

test("Slice-0 gate is closed: ledger has no convective days, math stays off", () => {
  assert.equal(GROWTH_GATE.loggedConvectiveDays, 0);
  assert.ok(GROWTH_GATE.loggedConvectiveDays < GROWTH_GATE.requiredConvectiveDays);
  assert.equal(growthGatePasses(), false);
  assert.equal(GROWTH_MATH_ENABLED, false);
  assert.equal(GROWTH_MATH_ENABLED && growthGatePasses(), false);
});

function rateSnap(time: number, cells: RateTrailSnap["cells"]): RateTrailSnap {
  return { time, cells };
}

function cell(lat: number, lon: number, rate: number) {
  return { lat, lon, rate };
}

/** Four 10-min hops; two matched parcels translate and deepen 2 → 8 mm/h. */
function deepeningTrail(): RateTrailSnap[] {
  return [
    rateSnap(0, [cell(50, 20, 2), cell(50.04, 20, 2)]),
    rateSnap(600, [cell(50, 20.08, 4), cell(50.04, 20.08, 4)]),
    rateSnap(1200, [cell(50, 20.16, 6), cell(50.04, 20.16, 6)]),
    rateSnap(1800, [cell(50, 20.24, 8), cell(50.04, 20.24, 8)]),
  ];
}

test("Lagrangian ΔR is the sum of rate over matched cells, not first-vs-last mass count", () => {
  const trail = deepeningTrail();
  const deltaR = lagrangianDeltaR(trail);
  // Two parcels × (+2 +2 +2) = +12. New unmatched cells do not add their rate.
  assert.equal(deltaR, 12);
  const areaOnly: RateTrailSnap[] = [
    rateSnap(0, [cell(50, 20, 3), cell(50.04, 20, 3)]),
    rateSnap(1800, [
      cell(50, 20, 3),
      cell(50.04, 20, 3),
      cell(50.08, 20, 3),
      cell(50.12, 20, 3),
    ]),
  ];
  assert.equal(lagrangianDeltaR(areaOnly), 0);
  assert.equal(lagrangianMeanRateSlope(areaOnly), 0);
});

test("deepening matched trail has a positive mean-rate slope", () => {
  const slope = lagrangianMeanRateSlope(deepeningTrail());
  // Mean parcel 2 → 8 mm/h over 30 min → 0.2 mm/h per min.
  assert.ok(Math.abs(slope - 0.2) < 1e-9, `slope ${slope}`);
});

test("translating 5-cell core: Lagrangian ΔR follows parcels, not leading-vs-trailing edge", () => {
  const lons = [20.0, 20.03, 20.06, 20.09, 20.12];
  const hop = 0.08;
  const trail: RateTrailSnap[] = [
    rateSnap(
      0,
      lons.map((lon) => cell(50, lon, 2)),
    ),
    rateSnap(
      600,
      lons.map((lon) => cell(50, lon + hop, 4)),
    ),
  ];
  assert.equal(lagrangianDeltaR(trail), 10);
  assert.ok(Math.abs(lagrangianMeanRateSlope(trail) - 0.2) < 1e-9);
});

test("damped increment is full for 15–20 min then e-folds toward zero (~30 min)", () => {
  assert.equal(GROWTH_APPLY_MIN, 18);
  assert.equal(GROWTH_EFOLD_MIN, 30);
  const slope = 0.2;
  assert.equal(dampedTrendIncrement(slope, 0), 0);
  assert.equal(dampedTrendIncrement(slope, 15), slope * 15);
  assert.equal(dampedTrendIncrement(slope, GROWTH_APPLY_MIN), slope * GROWTH_APPLY_MIN);
  const atApply = dampedTrendIncrement(slope, GROWTH_APPLY_MIN);
  const afterEfold = dampedTrendIncrement(slope, GROWTH_APPLY_MIN + GROWTH_EFOLD_MIN);
  assert.ok(
    Math.abs(afterEfold - atApply / Math.E) < 1e-9,
    `e-fold ${afterEfold} vs ${atApply / Math.E}`,
  );
  assert.ok(afterEfold < atApply);
  assert.ok(dampedTrendIncrement(slope, 50) < dampedTrendIncrement(slope, 20));
});

test("applyGrowthToTimeline is a no-op when the live flag is off", () => {
  const timeline: TimelinePoint[] = [
    { t: 0, level: 2, rate: 2 },
    { t: 15, level: 2, rate: 2 },
    { t: 50, level: 2, rate: 2 },
  ];
  assert.equal(GROWTH_MATH_ENABLED, false);
  assert.deepEqual(applyGrowthToTimeline(timeline, 0.2), timeline);
  assert.deepEqual(applyGrowthToTimeline(timeline, 0.2, false), timeline);
});

test("flag on: deepening slope raises 15–20 min rain and damps the extra by ~30 min", () => {
  const timeline: TimelinePoint[] = [
    { t: 0, level: 2, rate: 2 },
    { t: 15, level: 2, rate: 2 },
    { t: 20, level: 2, rate: 2 },
    { t: 50, level: 2, rate: 2 },
    { t: 20, level: 0, rate: 0, unknown: true },
  ];
  const grown = applyGrowthToTimeline(timeline.slice(0, 4), 0.2, true);
  assert.equal(grown[0]!.rate, 2);
  assert.ok(grown[1]!.rate > 2, "15 min must take the fitted ΔR");
  assert.ok(grown[2]!.rate > grown[1]!.rate, "apply window still accumulating at 20");
  const extra20 = grown[2]!.rate - 2;
  const extra50 = grown[3]!.rate - 2;
  assert.ok(extra50 > 0, "echo still present at 50 is still adjusted");
  assert.ok(extra50 < extra20, "extra after ~30 min is damped toward zero");
  const withUnknown = applyGrowthToTimeline(timeline, 0.2, true);
  assert.equal(withUnknown[4]!.rate, 0);
  assert.equal(withUnknown[4]!.unknown, true);
});
