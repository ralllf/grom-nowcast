import assert from "node:assert/strict";
import test from "node:test";
import { framesFromScan, packSamples, unpackSamples } from "./pack.ts";
import type { RadarSample, RadarScan } from "./types.ts";

const samples: RadarSample[] = [
  { lat: 51.149, lon: 15.008, level: 2, rate: 3.4 },
  { lat: 50.0, lon: 21.0, level: 4, rate: 25.1 },
];

test("pack/unpack keeps a composite sample west of 13°E", () => {
  const west: RadarSample = { lat: 53.4285, lon: 12.2, level: 2, rate: 4.1 };
  const back = unpackSamples(packSamples([west]));
  assert.equal(back.length, 1);
  assert.ok(Math.abs(back[0]!.lat - west.lat) < 0.0006);
  assert.ok(Math.abs(back[0]!.lon - west.lon) < 0.0006, `packed lon ${back[0]!.lon} lost the west of 13°E`);
  assert.ok(back[0]!.lon < 13);
});

test("old 8-byte pack blobs still unpack level + max rate", () => {
  // Frozen wire from the 8-byte era (u16le lat, lon, level, rate×10). Not re-packed.
  const old = "TQyoDwIAIgA="; // 51.149, 15.008, level 2, 3.4 mm/h
  const also = "0AcQJwQA+wA="; // 50.000, 21.000, level 4, 25.1 mm/h
  const a = unpackSamples(old);
  const b = unpackSamples(also);
  assert.equal(a.length, 1);
  assert.ok(Math.abs(a[0]!.lat - 51.149) < 0.0006);
  assert.ok(Math.abs(a[0]!.lon - 15.008) < 0.0006);
  assert.equal(a[0]!.level, 2);
  assert.ok(Math.abs((a[0]!.rate ?? 0) - 3.4) < 0.06);
  assert.equal(b.length, 1);
  assert.equal(b[0]!.level, 4);
  assert.ok(Math.abs((b[0]!.rate ?? 0) - 25.1) < 0.06);
});

test("pack/unpack round-trips samples to 0.001° and 0.1 mm/h", () => {
  const back = unpackSamples(packSamples(samples));
  assert.equal(back.length, 2);
  back.forEach((b, i) => {
    assert.ok(Math.abs(b.lat - samples[i]!.lat) < 0.0006);
    assert.ok(Math.abs(b.lon - samples[i]!.lon) < 0.0006);
    assert.equal(b.level, samples[i]!.level);
    assert.ok(Math.abs((b.rate ?? 0) - (samples[i]!.rate ?? 0)) < 0.06);
  });
  assert.deepEqual(unpackSamples(""), []);
  // 8 bytes per sample → base64 grows ~10.7 chars per sample.
  const big = Array.from({ length: 4000 }, (_, i) => ({
    lat: 49 + i * 0.001,
    lon: 14 + i * 0.002,
    level: 2 as const,
    rate: 3.3,
  }));
  assert.ok(packSamples(big).length < 4000 * 11);
});

test("framesFromScan prefers packed history and keeps order", () => {
  const scan: RadarScan = {
    host: "",
    generated: 0,
    latestTime: 2,
    past: [],
    nowcast: [],
    samples: [],
    prevSamples: [],
    prevTime: null,
    maxLevel: 0,
    nearestKm: null,
    echoCount: 0,
    cellKm: 3,
    history: [
      {
        time: 1,
        samples: [],
        maxLevel: 2,
        nearestKm: null,
        packed: packSamples(samples.slice(0, 1)),
      },
      { time: 2, samples: [], maxLevel: 4, nearestKm: null, packed: packSamples(samples) },
    ],
  };
  const frames = framesFromScan(scan);
  assert.equal(frames.length, 2);
  assert.equal(frames[0]!.samples.length, 1);
  assert.equal(frames[1]!.samples.length, 2);
  assert.equal(frames[1]!.samples[1]!.rate, 25.1);
  assert.equal(frames[0]!.cellKm, 3);
  assert.equal(frames[1]!.cellKm, 3);
});

test("framesFromScan keeps a 6 km scan cellKm on every frame", () => {
  const scan: RadarScan = {
    host: "",
    generated: 0,
    latestTime: 2,
    past: [],
    nowcast: [],
    samples: [],
    prevSamples: [],
    prevTime: null,
    maxLevel: 0,
    nearestKm: null,
    echoCount: 0,
    cellKm: 6,
    history: [
      { time: 1, samples: [], maxLevel: 2, nearestKm: null, packed: packSamples(samples.slice(0, 1)) },
      { time: 2, samples: [], maxLevel: 4, nearestKm: null, packed: packSamples(samples), cellKm: 6 },
    ],
  };
  const frames = framesFromScan(scan);
  assert.equal(frames[0]!.cellKm, 6);
  assert.equal(frames[1]!.cellKm, 6);
});

test("framesFromScan keeps SRI nccCellKm=2 off the 3 km pack", () => {
  const scan: RadarScan = {
    host: "",
    generated: 0,
    latestTime: 2,
    past: [],
    nowcast: [],
    samples: [],
    prevSamples: [],
    prevTime: null,
    maxLevel: 0,
    nearestKm: null,
    echoCount: 0,
    cellKm: 3,
    analysisSource: "sri",
    history: [
      {
        time: 1,
        samples: [],
        maxLevel: 2,
        nearestKm: null,
        packed: packSamples(samples.slice(0, 1)),
        cellKm: 3,
        nccCellKm: 2,
      },
      {
        time: 2,
        samples: [],
        maxLevel: 4,
        nearestKm: null,
        packed: packSamples(samples),
        cellKm: 3,
        nccCellKm: 2,
      },
    ],
  };
  const frames = framesFromScan(scan);
  assert.equal(frames[0]!.cellKm, 3);
  assert.equal(frames[1]!.cellKm, 3);
  assert.equal(frames[0]!.nccCellKm, 2);
  assert.equal(frames[1]!.nccCellKm, 2);
});
