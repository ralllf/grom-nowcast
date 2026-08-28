import assert from "node:assert/strict";
import test from "node:test";
import { computeThreat, TRACK_MAX_KM } from "./threat.ts";
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

const zgorzelec: Place = {
  lat: 51.149,
  lon: 15.008,
  label: "Zgorzelec",
  terc: "0225",
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

test("cell passing ~90 km north is drawn but does not claim a hit on the pin", () => {
  const frames = [
    frame(1_000, blob(50.85, 20.5, 2), 95),
    frame(1_600, blob(50.85, 20.65, 2), 93),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.willHit, false);
  assert.ok(threat.tracks.length >= 1);
  assert.ok(
    threat.nearestKm !== null && threat.nearestKm <= TRACK_MAX_KM,
    `nearest should stay inside ${TRACK_MAX_KM} km, got ${threat.nearestKm}`,
  );
  assert.equal(threat.comingFrom, null);
});

test("cell 300 km away is ignored — not a nowcast threat", () => {
  const frames = [
    frame(1_000, blob(50.0, 25.3, 4), 308),
    frame(1_600, blob(50.0, 25.45, 4), 318),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.tracks.length, 0);
  assert.equal(threat.willHit, false);
  assert.equal(threat.comingFrom, null);
  assert.equal(threat.nearestKm, null);
  assert.equal(threat.expect, null);
  assert.match(threat.detail, /100 km/);
});

test("near cell wins over a stronger storm 300 km away", () => {
  const frames = [
    frame(1_000, [...blob(50.0, 20.4, 2), ...blob(50.0, 25.3, 4)], 43),
    frame(1_600, [...blob(50.0, 20.55, 2), ...blob(50.0, 25.45, 4)], 32),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.willHit, true);
  assert.ok(threat.nearestKm !== null && threat.nearestKm < 50);
  for (const track of threat.tracks) {
    const dLat = track.now.lat - city.lat;
    const dLon = track.now.lon - city.lon;
    const roughKm = Math.hypot(dLat * 111, dLon * 71);
    assert.ok(roughKm <= TRACK_MAX_KM + 5, `track ${roughKm.toFixed(0)} km from pin`);
  }
});

test("Zgorzelec: German cell to the west, not a cell over central Poland", () => {
  const frames = [
    frame(1_000, [...blob(51.15, 14.35, 3), ...blob(51.25, 19.12, 4)], 46),
    frame(1_600, [...blob(51.15, 14.5, 3), ...blob(51.25, 19.28, 4)], 36),
  ];
  const threat = computeThreat(zgorzelec, frames, [], 40);
  assert.ok(threat.tracks.length >= 1, "west cell over Saxony should be tracked");
  assert.ok(threat.comingFrom === "zachodu" || threat.willHit);
  assert.ok(threat.nearestKm !== null && threat.nearestKm < 80);
  for (const track of threat.tracks) {
    assert.ok(track.now.lon < 16, `should not track the Łódź/centrum cell at lon ${track.now.lon}`);
  }
});

test("four frames: jittered centroid still yields eastward motion", () => {
  const frames = [
    frame(0, blob(50.0, 20.3), 50),
    frame(600, blob(50.22, 20.45), 48),
    frame(1_200, blob(50.01, 20.6), 36),
    frame(1_800, blob(50.0, 20.75), 25),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.toward, "wschód");
  assert.equal(threat.willHit, true);
  assert.ok(threat.etaMin !== null && threat.etaMin > 0);
});

test("four steady frames give a track even when the last pair barely moves", () => {
  const frames = [
    frame(0, blob(50.0, 20.2), 57),
    frame(600, blob(50.0, 20.4), 43),
    frame(1_200, blob(50.0, 20.58), 30),
    frame(1_800, blob(50.0, 20.62), 27),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "zachodu");
  assert.ok(threat.speedKmh !== null && threat.speedKmh >= 4);
});

test("echo 7 km from the pin is teraz, not minie, even if a far centroid would miss", () => {
  const frames = [
    frame(0, [...blob(50.0, 21.09, 2), ...blob(50.55, 20.3, 3)], 7),
    frame(600, [...blob(50.0, 21.1, 2), ...blob(50.55, 20.45, 3)], 7),
    frame(1_200, [...blob(50.01, 21.1, 2), ...blob(50.55, 20.6, 3)], 7),
    frame(1_800, [...blob(50.0, 21.11, 2), ...blob(50.55, 20.75, 3)], 7),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.nearestKm !== null && threat.nearestKm <= 12);
  assert.equal(threat.etaMin, 0);
  assert.equal(threat.willHit, true);
  assert.ok(threat.chancePct >= 70, `chance too low for rain overhead: ${threat.chancePct}`);
  assert.doesNotMatch(threat.detail, /minie/);
  assert.match(threat.detail, /teraz/);
  assert.ok(threat.tracks.length <= 2, `too many arrows: ${threat.tracks.length}`);
});

test("a wide stratiform blob does not sprout six arrows", () => {
  const rain: RadarSample[] = [];
  for (let i = -6; i <= 6; i++) {
    for (let j = -4; j <= 4; j++) {
      rain.push({ lat: 50.0 + i * 0.08, lon: 20.7 + j * 0.08, level: 2 });
    }
  }
  const frames = [
    frame(0, rain.map((s) => ({ ...s, lon: s.lon - 0.12 })), 20),
    frame(600, rain.map((s) => ({ ...s, lon: s.lon - 0.08 })), 16),
    frame(1_200, rain.map((s) => ({ ...s, lon: s.lon - 0.04 })), 12),
    frame(1_800, rain, 8),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length <= 2, `too many arrows: ${threat.tracks.length}`);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "zachodu");
  assert.ok(threat.willHit || (threat.etaMin !== null && threat.etaMin === 0));
});

test("cell moving NE is coming from the southwest", () => {
  const frames = [
    frame(0, blob(49.7, 20.55, 3), 48),
    frame(600, blob(49.78, 20.68, 3), 38),
    frame(1_200, blob(49.86, 20.81, 3), 28),
    frame(1_800, blob(49.94, 20.94, 3), 16),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "południowego zachodu");
  assert.equal(threat.toward, "północny wschód");
});

test("east-edge pin on a west-heavy NE-moving front still reads southwest origin", () => {
  function front(dLat: number, dLon: number): RadarSample[] {
    const s: RadarSample[] = [];
    for (let i = -5; i <= 2; i++) {
      for (let j = -7; j <= 1; j++) {
        s.push({
          lat: 50.0 + dLat + i * 0.08,
          lon: 21.0 + dLon + j * 0.08,
          level: 2,
        });
      }
    }
    return s;
  }
  const frames = [
    frame(0, front(-0.12, -0.2), 18),
    frame(600, front(-0.08, -0.13), 14),
    frame(1_200, front(-0.04, -0.06), 10),
    frame(1_800, front(0, 0), 7),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.comingFrom, "południowego zachodu");
  assert.equal(threat.toward, "północny wschód");
  assert.ok(threat.tracks.length <= 2);
});
