import assert from "node:assert/strict";
import test from "node:test";
import { historyIsDegraded, radarHistoryFromScan } from "./radar-history.ts";
import type { RadarScan } from "./types.ts";

function scan(over: Partial<RadarScan> = {}): RadarScan {
  return {
    host: "https://example",
    generated: 1,
    latestTime: 200,
    past: [],
    nowcast: [],
    samples: [{ lat: 52, lon: 21, level: 2 }],
    prevSamples: [{ lat: 52, lon: 20.9, level: 2 }],
    prevTime: 100,
    history: [],
    maxLevel: 2,
    nearestKm: 4,
    echoCount: 1,
    cellKm: 3,
    ...over,
  };
}

test("prefers server history when present", () => {
  const history = [
    { time: 1, samples: [], maxLevel: 0 as const, nearestKm: null },
    { time: 2, samples: [{ lat: 1, lon: 2, level: 1 as const }], maxLevel: 1 as const, nearestKm: 3 },
  ];
  assert.equal(radarHistoryFromScan(scan({ history })).length, 2);
});

test("rebuilds two frames from prev + latest when history is empty", () => {
  const frames = radarHistoryFromScan(scan());
  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.time, 100);
  assert.equal(frames[1]?.time, 200);
  assert.equal(frames[1]?.maxLevel, 2);
});

test("latest-only scan still yields one frame", () => {
  const frames = radarHistoryFromScan(scan({ prevTime: null, prevSamples: [] }));
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.time, 200);
});

test("degraded is true if any frame failed a tile", () => {
  assert.equal(
    historyIsDegraded([
      { time: 1, samples: [], maxLevel: 0, nearestKm: null },
      { time: 2, samples: [], maxLevel: 0, nearestKm: null, degraded: true },
    ]),
    true,
  );
  assert.equal(
    historyIsDegraded([{ time: 1, samples: [], maxLevel: 0, nearestKm: null }]),
    false,
  );
});

test("empty scan has no frames", () => {
  assert.deepEqual(
    radarHistoryFromScan(scan({ latestTime: null, prevTime: null, prevSamples: [], samples: [] })),
    [],
  );
});
