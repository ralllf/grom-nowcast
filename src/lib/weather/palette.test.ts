import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dbzFromRgba, HAIL_RATE, LEVEL_SWATCH, levelFromRate, rateFromDbz } from "./palette.ts";

test("exact palette colours map to their dBZ", () => {
  assert.equal(dbzFromRgba(0x88, 0xdd, 0xee, 255), 15);
  assert.equal(dbzFromRgba(0x00, 0x47, 0x68, 255), 34);
  assert.equal(dbzFromRgba(0xff, 0xee, 0x00, 255), 35);
  assert.equal(dbzFromRgba(0xff, 0x81, 0x00, 255), 44);
  assert.equal(dbzFromRgba(0xc1, 0x00, 0x00, 255), 50);
  assert.equal(dbzFromRgba(0xff, 0xaa, 0xff, 255), 55);
  assert.equal(dbzFromRgba(0xff, 0xff, 0xff, 255), 65);
});

test("translucent beige (< 15 dBZ) and transparent pixels are no echo", () => {
  assert.equal(dbzFromRgba(0, 0, 0, 0), null);
  assert.equal(dbzFromRgba(0xde, 0xd0, 0x97, 0xbe), null);
});

test("nearest-colour fallback tolerates small drift but rejects foreign colours", () => {
  assert.equal(dbzFromRgba(0xff, 0x83, 0x02, 255), 44);
  assert.equal(dbzFromRgba(0x10, 0xd0, 0x10, 255), null);
});

test("Marshall–Palmer rates and class thresholds line up with palette families", () => {
  assert.ok(rateFromDbz(15) > 0.1 && rateFromDbz(15) < 0.5);
  assert.equal(levelFromRate(rateFromDbz(15)), 1);
  assert.equal(levelFromRate(rateFromDbz(23)), 1);
  assert.equal(levelFromRate(rateFromDbz(24)), 2);
  assert.equal(levelFromRate(rateFromDbz(32)), 2);
  assert.equal(levelFromRate(rateFromDbz(33)), 3);
  assert.equal(levelFromRate(rateFromDbz(39)), 3);
  assert.equal(levelFromRate(rateFromDbz(40)), 4);
  assert.equal(levelFromRate(rateFromDbz(44)), 4);
  assert.equal(levelFromRate(rateFromDbz(65)), 4);
  assert.ok(HAIL_RATE > 90 && HAIL_RATE < 110);
});

test("the old heuristic's inversions are gone: orange ≥ yellow, white is extreme", () => {
  const lvl = (hex: number) =>
    levelFromRate(rateFromDbz(dbzFromRgba(hex >> 16, (hex >> 8) & 0xff, hex & 0xff, 255)!));
  assert.ok(lvl(0xff8100) >= lvl(0xffee00));
  assert.equal(lvl(0xffffff), 4);
  assert.ok(lvl(0x004768) > lvl(0x88ddee));
});

const TRACK_AMBER = "#f0a202";
const RAIN_L4 = "#e62800";
const VECTOR_VERMILION = "#e4572e";

test("L3 swatch is gold so it reads on Positron; L4 stays rain red", () => {
  assert.equal(LEVEL_SWATCH[3], "#e8b400");
  assert.notEqual(LEVEL_SWATCH[3], "#ffc500");
  assert.equal(LEVEL_SWATCH[4], RAIN_L4);
});

test("tracks are amber, not vermilion or rain-L4 red", async () => {
  const css = await readFile(new URL("../../styles.css", import.meta.url), "utf8");
  const map = await readFile(new URL("../../components/radar-map.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../../components/grom-app.tsx", import.meta.url), "utf8");

  assert.match(css, /--color-vector:\s*#f0a202\b/);
  assert.doesNotMatch(css, /--color-vector:\s*#e4572e\b/);

  assert.match(map, /const AMBER = "#f0a202"/);
  assert.match(map, /const AMBER_SOFT = "#f0a202"/);
  assert.doesNotMatch(map, /#e4572e/);
  assert.equal(map.includes(RAIN_L4), false);
  assert.match(map, /"raster-opacity": 0\.85/);
  assert.doesNotMatch(map, /"raster-opacity": 0\.78/);

  assert.match(app, /tracksMap \? "#f0a202"/);
  assert.doesNotMatch(app, /tracksMap \? "#e4572e"/);

  assert.equal(TRACK_AMBER, "#f0a202");
  assert.notEqual(TRACK_AMBER, VECTOR_VERMILION);
  assert.notEqual(TRACK_AMBER, RAIN_L4);
  assert.notEqual(TRACK_AMBER, LEVEL_SWATCH[4]);
});
