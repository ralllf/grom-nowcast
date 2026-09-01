import assert from "node:assert/strict";
import test from "node:test";
import {
  GROWTH_GATE,
  GROWTH_MATH_ENABLED,
  cellTrendCopy,
  cellTrendFromSnaps,
  growthGatePasses,
  type TrailSnap,
} from "./trend.ts";

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
