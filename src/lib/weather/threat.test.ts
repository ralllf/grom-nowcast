import assert from "node:assert/strict";
import test from "node:test";
import { computeThreat } from "./threat.ts";
import type { Place, RadarLevel, RadarMemoryFrame, RadarSample } from "./types.ts";

function blob(lat: number, lon: number, level: RadarLevel = 3): RadarSample[] {
  const samples: RadarSample[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      samples.push({
        lat: lat + i * 0.04,
        lon: lon + j * 0.04,
        level,
      });
    }
  }
  return samples;
}

function frame(
  time: number,
  samples: RadarSample[],
  nearestKm: number,
): RadarMemoryFrame {
  const maxLevel = Math.max(0, ...samples.map((s) => s.level)) as RadarLevel;
  return { time, samples, maxLevel, nearestKm };
}

const city: Place = {
  lat: 50.0,
  lon: 21.0,
  label: "Testowo",
  terc: "9999",
};

test("incoming cell from the west gets ETA, comingFrom and a visible track", () => {
  const frames = [
    frame(1_000, blob(50.0, 20.4), 43),
    frame(1_600, blob(50.0, 20.55), 32),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1, "should draw at least one motion arrow");
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.toward, "wschód");
  assert.equal(threat.willHit, true);
  assert.ok(threat.etaMin !== null && threat.etaMin > 0, `expected future ETA, got ${threat.etaMin}`);
  assert.ok(threat.etaMin !== null && threat.etaMin <= 50, `ETA too large: ${threat.etaMin}`);
  assert.ok(threat.expect?.includes("deszcz") || threat.expect?.includes("ulew"));
  assert.match(threat.detail, /Idzie od zachodu/);
  assert.match(threat.detail, /Spodziewaj się/);
  assert.match(threat.detail, /Dojście nad Testowo/);
});

test("precip already over the pin is ETA teraz", () => {
  const frames = [
    frame(1_000, blob(50.0, 21.0, 2), 1.2),
    frame(1_600, blob(50.02, 21.03, 2), 2.1),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.etaMin, 0);
  assert.equal(threat.willHit, true);
  assert.match(threat.detail, /teraz/);
});

test("cell passing far north does not claim a hit on the pin", () => {
  const frames = [
    frame(1_000, blob(51.2, 20.4, 2), 140),
    frame(1_600, blob(51.2, 20.55, 2), 138),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.willHit, false);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, null);
});
