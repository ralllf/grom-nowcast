import assert from "node:assert/strict";
import test from "node:test";
import { framesFromScan, packSamples, unpackSamples } from "./pack.ts";
import type { RadarSample, RadarScan } from "./types.ts";

const samples: RadarSample[] = [
  { lat: 51.149, lon: 15.008, level: 2, rate: 3.4 },
  { lat: 50.0, lon: 21.0, level: 4, rate: 25.1 },
];

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
});
