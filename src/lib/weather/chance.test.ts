import assert from "node:assert/strict";
import test from "node:test";
import {
  SZANSA_CALIBRATION,
  calibrateChancePct,
  type ChanceRung,
} from "./chance.ts";

const WILL_HIT_APPROACHING: ChanceRung[] = [
  "willHitEta20to45",
  "willHitApproachingKlasa2",
  "overPinKlasa2",
  "willHitEtaLe20",
  "overPinNowKlasa2",
  "overPinKlasa3",
];

test("calibration table is the published 2026-08-31 midday row, keyed by rung id", () => {
  assert.equal(SZANSA_CALIBRATION.source, "hindcast-log-2026-08-31-midday");
  assert.equal(SZANSA_CALIBRATION.radar, "rainviewer");
  assert.equal(SZANSA_CALIBRATION.heldOut, false);
  assert.equal(SZANSA_CALIBRATION.claimsReliabilityGate, false);
  const ids = SZANSA_CALIBRATION.rungs.map((r) => r.id);
  assert.ok(ids.includes("willHitEta20to45"));
  assert.ok(ids.includes("legacyCloseEcho"));
});

test("two rungs that share a raw integer ship different percents", () => {
  const mid = SZANSA_CALIBRATION.rungs.find((r) => r.id === "willHitEta20to45");
  const close = SZANSA_CALIBRATION.rungs.find((r) => r.id === "legacyCloseEcho");
  assert.ok(mid && close);
  assert.equal(mid.rawPct, close.rawPct, "same ladder integer — identity must still split them");
  assert.equal(mid.rawPct, 50);
  assert.notEqual(mid.shippedPct, close.shippedPct);
  assert.equal(calibrateChancePct("willHitEta20to45"), mid.shippedPct);
  assert.equal(calibrateChancePct("legacyCloseEcho"), close.shippedPct);
});

test("today's willHit ETA 20–45 klasa-1 rung is not the old 50–59 close-echo 18%", () => {
  const mid = SZANSA_CALIBRATION.rungs.find((r) => r.id === "willHitEta20to45");
  const close = SZANSA_CALIBRATION.rungs.find((r) => r.id === "legacyCloseEcho");
  assert.ok(mid && close);
  assert.equal(close.n, 28);
  assert.equal(close.observedPct, 18);
  assert.equal(close.shippedPct, 20);
  assert.equal(mid.n, 0, "no matching SRI-era / identity log for this rung");
  assert.equal(mid.observedPct, null);
  assert.equal(calibrateChancePct("willHitEta20to45"), 50);
  assert.notEqual(calibrateChancePct("willHitEta20to45"), calibrateChancePct("legacyCloseEcho"));
});

test("willHit approaching rungs stay isotonic and still clear minChance 50", () => {
  let prev = 0;
  for (const id of WILL_HIT_APPROACHING) {
    const shipped = calibrateChancePct(id);
    assert.ok(shipped >= 50, `${id} → ${shipped} dropped below the shipped minChance 50 gate`);
    assert.ok(shipped >= prev, `${id} → ${shipped} dropped below ${prev}`);
    prev = shipped;
  }
});

test("published identities keep conservative leftover / measured shipped percents", () => {
  assert.equal(calibrateChancePct("echoFar"), 10);
  assert.equal(calibrateChancePct("legacyArea20"), 10);
  assert.equal(calibrateChancePct("legacyArea40"), 15);
  assert.equal(calibrateChancePct("legacyCloseEcho"), 20);
  assert.equal(calibrateChancePct("willHitApproachingKlasa2"), 55);
  assert.equal(calibrateChancePct("overPinKlasa2"), 90);
  assert.equal(calibrateChancePct("willHitEtaLe20"), 90);
  assert.equal(calibrateChancePct("overPinNowKlasa2"), 90);
  assert.equal(calibrateChancePct("overPinKlasa3"), 95);
});

test("overconfident leftover close-echo still drops below the 50 gate", () => {
  assert.ok(calibrateChancePct("legacyCloseEcho") < 50);
});
