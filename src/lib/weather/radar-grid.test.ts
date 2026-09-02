import assert from "node:assert/strict";
import test from "node:test";
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

test("MAX_RADAR_SAMPLES covers a full 3 km COMPO_SRI composite", () => {
  // UL–LR of live COMPO_SRI (calc review 06). Must not import sri.ts (it imports us).
  const nLat = Math.ceil((56.3 - 48) / BASE_CELL_LAT);
  const nLon = Math.ceil((25.3 - 11.6) / BASE_CELL_LON);
  assert.ok(
    MAX_RADAR_SAMPLES >= nLat * nLon,
    `cap ${MAX_RADAR_SAMPLES} < ${nLat}×${nLon} 3 km cells in the SRI footprint`,
  );
});

test("a ~9k-hit SRI-like field stays on 3 km cells", () => {
  const { samples, cellKm } = aggregate(latticeHits(9_000));
  assert.equal(cellKm, 3);
  assert.equal(samples.length, 9_000);
});

test("a filled 3 km PL bbox does not jump to 6 km", () => {
  const nLat = Math.floor((PL_RADAR_BBOX.maxLat - PL_RADAR_BBOX.minLat) / BASE_CELL_LAT);
  const nLon = Math.floor((PL_RADAR_BBOX.maxLon - PL_RADAR_BBOX.minLon) / BASE_CELL_LON);
  const n = nLat * nLon;
  assert.ok(n > 9_000, `bbox lattice ${n} should exceed the old 9 000 cap`);
  const { samples, cellKm } = aggregate(latticeHits(n));
  assert.equal(cellKm, 3);
  assert.equal(samples.length, n);
});
