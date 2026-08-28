import assert from "node:assert/strict";
import test from "node:test";
import { capSamplesFairly, SAMPLE_CAP_CELL_DEG } from "./sample-cap.ts";
import { cellKey } from "./spatial-hash.ts";
import type { RadarSample } from "./types.ts";

function grid(lat0: number, lon0: number, n: number, level: RadarSample["level"] = 1): RadarSample[] {
  const out: RadarSample[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ lat: lat0 + (i % 8) * 0.01, lon: lon0 + Math.floor(i / 8) * 0.01, level });
  }
  return out;
}

test("under the cap, samples pass through unchanged", () => {
  const s = grid(50, 20, 10);
  assert.deepEqual(capSamplesFairly(s, 100), s);
});

test("north and south cells both keep samples when the cap is tight", () => {
  const north = grid(54.5, 18.5, 80, 1);
  const south = grid(50.0, 19.9, 80, 1);
  const kept = capSamplesFairly([...north, ...south], 40);
  const nN = kept.filter((s) => s.lat > 53).length;
  const nS = kept.filter((s) => s.lat < 51).length;
  assert.ok(nN >= 8, `north starved: ${nN}`);
  assert.ok(nS >= 8, `south starved: ${nS}`);
  assert.ok(Math.abs(nN - nS) <= 8, `lat bias N=${nN} S=${nS}`);
});

test("sort-by-latitude slice is biased; fair cap keeps both belts", () => {
  const north = grid(54.8, 18.0, 200, 2);
  const south = grid(49.8, 20.0, 200, 2);
  const all = [...north, ...south];
  // Current main: level desc, then lat asc — that keeps the south first.
  const biased = [...all].sort((a, b) => b.level - a.level || a.lat - b.lat).slice(0, 80);
  const biasedNorth = biased.filter((s) => s.lat > 53).length;
  const biasedSouth = biased.filter((s) => s.lat < 51).length;
  const fair = capSamplesFairly(all, 80);
  const fairNorth = fair.filter((s) => s.lat > 53).length;
  const fairSouth = fair.filter((s) => s.lat < 51).length;
  assert.ok(
    biasedNorth < 15 || biasedSouth < 15,
    `sanity: lat sort is lopsided N=${biasedNorth} S=${biasedSouth}`,
  );
  assert.ok(fairNorth >= 25, `fair cap kept ${fairNorth} northern samples`);
  assert.ok(fairSouth >= 25, `fair cap kept ${fairSouth} southern samples`);
  assert.ok(
    Math.abs(fairNorth - fairSouth) < Math.abs(biasedNorth - biasedSouth),
    "fair cap should be less lopsided than a lat sort",
  );
});

test("stronger echo wins inside a cell", () => {
  const weak: RadarSample[] = [{ lat: 52, lon: 19, level: 1 }];
  const strong: RadarSample[] = [{ lat: 52.01, lon: 19.01, level: 4 }];
  const extra = grid(52.0, 19.0, 30, 1);
  const kept = capSamplesFairly([...weak, ...strong, ...extra], 1);
  assert.equal(kept.length, 1);
  assert.equal(kept[0]?.level, 4);
});

test("occupied cells get a first-round seat before any cell takes a second", () => {
  const a = grid(50.0, 15.0, 20, 1);
  const b = grid(54.0, 23.0, 20, 1);
  const kept = capSamplesFairly([...a, ...b], 2);
  const keys = new Set(kept.map((s) => cellKey(s.lat, s.lon, SAMPLE_CAP_CELL_DEG)));
  assert.equal(keys.size, 2);
});

test("empty input stays empty", () => {
  assert.deepEqual(capSamplesFairly([], 10), []);
});

test("cap of zero returns nothing", () => {
  assert.equal(capSamplesFairly(grid(52, 19, 5), 0).length, 0);
});
