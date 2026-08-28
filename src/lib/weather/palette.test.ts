import assert from "node:assert/strict";
import test from "node:test";
import {
  ANALYSIS_COLOR_OPTIONS,
  OVERLAY_COLOR_OPTIONS,
  UNIVERSAL_BLUE_RAIN,
  dbzToLevel,
  rgbaToDbz,
  rgbaToLevel,
} from "./palette.ts";

test("analysis tiles are unsmoothed; overlay stays smoothed", () => {
  assert.equal(ANALYSIS_COLOR_OPTIONS, "2/0_0");
  assert.equal(OVERLAY_COLOR_OPTIONS, "2/1_1");
});

test("transparent pixels decode to no echo", () => {
  assert.equal(rgbaToDbz(20, 20, 20, 0), null);
  assert.equal(rgbaToLevel(20, 20, 20, 0), 0);
});

test("exact Universal Blue rain colors map to their dBZ", () => {
  for (const c of UNIVERSAL_BLUE_RAIN) {
    if (c.a < 40) continue;
    assert.equal(rgbaToDbz(c.r, c.g, c.b, c.a), c.dbz, `dbz ${c.dbz}`);
  }
});

test("20 dBZ cyan is light rain (level 1)", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 20);
  assert.ok(c);
  assert.equal(rgbaToLevel(c.r, c.g, c.b, c.a), 1);
});

test("35 dBZ yellow is moderate (level 2)", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 35);
  assert.ok(c);
  assert.equal(rgbaToLevel(c.r, c.g, c.b, c.a), 2);
});

test("45 dBZ orange-red is heavy (level 3)", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 45);
  assert.ok(c);
  assert.equal(rgbaToLevel(c.r, c.g, c.b, c.a), 3);
});

test("50 dBZ dark red is severe (level 4)", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 50);
  assert.ok(c);
  assert.equal(rgbaToLevel(c.r, c.g, c.b, c.a), 4);
});

test("14 dBZ beige is below the rain threshold", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 14);
  assert.ok(c);
  assert.equal(rgbaToLevel(c.r, c.g, c.b, c.a), 0);
});

test("nearest-neighbor still hits 20 dBZ from a nearby RGB", () => {
  const c = UNIVERSAL_BLUE_RAIN.find((x) => x.dbz === 20);
  assert.ok(c);
  assert.equal(rgbaToDbz(c.r + 2, c.g - 1, c.b, 255), 20);
});

test("dbzToLevel bins match operational 1–4", () => {
  assert.equal(dbzToLevel(null), 0);
  assert.equal(dbzToLevel(10), 0);
  assert.equal(dbzToLevel(15), 1);
  assert.equal(dbzToLevel(29), 1);
  assert.equal(dbzToLevel(30), 2);
  assert.equal(dbzToLevel(39), 2);
  assert.equal(dbzToLevel(40), 3);
  assert.equal(dbzToLevel(49), 3);
  assert.equal(dbzToLevel(50), 4);
  assert.equal(dbzToLevel(65), 4);
});

test("old heuristic purple is not blindly level 4 without a palette match", () => {
  const dbz = rgbaToDbz(200, 80, 200, 255);
  assert.ok(dbz === null || dbz >= 15);
});
