import assert from "node:assert/strict";
import test from "node:test";
import {
  SZANSA_CALIBRATION,
  calibBinWithinGate,
  calibrateChancePct,
} from "./chance.ts";

test("calibration table is the published 2026-08-31 midday row", () => {
  assert.equal(SZANSA_CALIBRATION.source, "hindcast-log-2026-08-31-midday");
  assert.equal(SZANSA_CALIBRATION.radar, "rainviewer");
  assert.equal(SZANSA_CALIBRATION.heldOut, false);
  assert.equal(SZANSA_CALIBRATION.bins.length, 9);
});

test("populated bins ship a number within ±10 pts of observed", () => {
  const gated = SZANSA_CALIBRATION.bins.filter((b) => b.n >= SZANSA_CALIBRATION.minNForGate);
  assert.ok(gated.length >= 5, "the published row has five n≥20 bins");
  for (const bin of gated) {
    assert.ok(
      calibBinWithinGate(bin),
      `${bin.rawLo}-${bin.rawHi}: shipped ${bin.shippedPct} vs observed ${bin.observedPct}`,
    );
  }
});

test("raw rungs remap to the empirical shipped percent", () => {
  assert.equal(calibrateChancePct(10), 10);
  assert.equal(calibrateChancePct(25), 10);
  assert.equal(calibrateChancePct(40), 15);
  assert.equal(calibrateChancePct(50), 20);
  assert.equal(calibrateChancePct(55), 20);
  assert.equal(calibrateChancePct(60), 55);
  assert.equal(calibrateChancePct(70), 90);
  assert.equal(calibrateChancePct(80), 90);
  assert.equal(calibrateChancePct(90), 95);
});

test("shipped chance is isotonic in the raw rung", () => {
  let prev = 0;
  for (const raw of [10, 25, 40, 50, 55, 60, 70, 80, 90]) {
    const shipped = calibrateChancePct(raw);
    assert.ok(shipped >= prev, `${raw} → ${shipped} dropped below ${prev}`);
    prev = shipped;
  }
});

test("willHit+approaching (raw 60) still clears the shipped minChance 50 gate", () => {
  assert.ok(calibrateChancePct(60) >= 50);
  assert.ok(calibrateChancePct(70) >= 50);
  assert.ok(calibrateChancePct(80) >= 50);
  assert.ok(calibrateChancePct(90) >= 50);
});

test("overconfident close-echo rung (raw 55, obs 18%) drops below the 50 gate", () => {
  assert.ok(calibrateChancePct(55) < 50);
  assert.ok(calibrateChancePct(50) < 50);
});
