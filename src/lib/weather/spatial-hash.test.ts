import assert from "node:assert/strict";
import test from "node:test";
import { haversineKm } from "./geo.ts";
import { SpatialHash, cellKey } from "./spatial-hash.ts";

test("neighbors within radius include the nearby point and skip the far one", () => {
  const a = { lat: 52.0, lon: 21.0 };
  const b = { lat: 52.05, lon: 21.05 };
  const c = { lat: 54.0, lon: 18.0 };
  const hash = new SpatialHash([a, b, c], 16);
  const near = hash.neighbors(52.0, 21.0, 20);
  assert.ok(near.includes(a));
  assert.ok(near.includes(b));
  assert.ok(!near.includes(c));
});

test("pairsWithin is undirected and distance-gated", () => {
  const pts = [
    { lat: 50.0, lon: 20.0, id: 1 },
    { lat: 50.04, lon: 20.04, id: 2 },
    { lat: 53.0, lon: 22.0, id: 3 },
  ];
  const hash = new SpatialHash(pts, 10);
  const pairs = hash.pairsWithin(pts, 12);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0]![0].id + pairs[0]![1].id, 3);
});

test("spatial hash does not drop a neighbor that O(n²) would find", () => {
  const pts: { lat: number; lon: number }[] = [];
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 12; j++) {
      pts.push({ lat: 51.5 + i * 0.08, lon: 17.0 + j * 0.08 });
    }
  }
  const linkKm = 16;
  const hash = new SpatialHash(pts, linkKm);
  let brute = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (haversineKm(pts[i]!.lat, pts[i]!.lon, pts[j]!.lat, pts[j]!.lon) <= linkKm) brute++;
    }
  }
  assert.equal(hash.pairsWithin(pts, linkKm).length, brute);
});

test("cellKey is stable for points in the same cell", () => {
  assert.equal(cellKey(52.11, 19.21, 0.4), cellKey(52.12, 19.22, 0.4));
  assert.notEqual(cellKey(52.11, 19.21, 0.4), cellKey(53.0, 21.0, 0.4));
});

test("hash.size counts occupied cells", () => {
  const hash = new SpatialHash(
    [
      { lat: 50, lon: 15 },
      { lat: 50.01, lon: 15.01 },
      { lat: 54, lon: 23 },
    ],
    20,
  );
  assert.ok(hash.size >= 2);
});
