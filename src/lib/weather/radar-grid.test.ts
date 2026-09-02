import assert from "node:assert/strict";
import test from "node:test";
import { packSamples } from "./pack.ts";
import {
  aggregate,
  BASE_CELL_LAT,
  BASE_CELL_LON,
  MAX_RADAR_SAMPLES,
  PL_RADAR_BBOX,
  type RawHit,
} from "./radar-grid.ts";

/** One hit per 3 km cell so aggregate cannot collapse them. */
function latticeHits(count: number, rate = 1.5): RawHit[] {
  const hits: RawHit[] = [];
  const nLon = Math.floor((PL_RADAR_BBOX.maxLon - PL_RADAR_BBOX.minLon) / BASE_CELL_LON);
  for (let n = 0; n < count; n++) {
    const i = Math.floor(n / nLon);
    const j = n % nLon;
    hits.push({
      lat: PL_RADAR_BBOX.minLat + (i + 0.5) * BASE_CELL_LAT,
      lon: PL_RADAR_BBOX.minLon + (j + 0.5) * BASE_CELL_LON,
      rate,
    });
  }
  return hits;
}

test("MAX_RADAR_SAMPLES stays a 9 000-sample pack cap", () => {
  assert.equal(MAX_RADAR_SAMPLES, 9_000);
});

test("9 000 hits stay on 3 km cells", () => {
  const { samples, cellKm } = aggregate(latticeHits(9_000));
  assert.equal(cellKm, 3);
  assert.equal(samples.length, 9_000);
});

test("9 001 hits coarsen to 6 km and stay under the pack cap", () => {
  const { samples, cellKm } = aggregate(latticeHits(9_001));
  assert.equal(cellKm, 6);
  assert.ok(samples.length <= MAX_RADAR_SAMPLES, `packed ${samples.length} > ${MAX_RADAR_SAMPLES}`);
  assert.ok(packSamples(samples).length < MAX_RADAR_SAMPLES * 11);
});
