import assert from "node:assert/strict";
import test from "node:test";
import { bearingDeg, haversineKm } from "./geo.ts";
import { computeThreat, TRACK_MAX_KM } from "./threat.ts";
import type { Place, RadarLevel, RadarMemoryFrame, RadarSample } from "./types.ts";

function angleDiffDeg(a: number, b: number) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

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

function frame(time: number, samples: RadarSample[], nearestKm: number): RadarMemoryFrame {
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
  const frames = [frame(1_000, blob(50.0, 20.4), 43), frame(1_600, blob(50.0, 20.55), 32)];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1, "should draw at least one motion arrow");
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.toward, "wschód");
  assert.equal(threat.willHit, true);
  assert.ok(
    threat.etaMin !== null && threat.etaMin > 0,
    `expected future ETA, got ${threat.etaMin}`,
  );
  assert.ok(threat.etaMin !== null && threat.etaMin <= 50, `ETA too large: ${threat.etaMin}`);
  assert.ok(threat.expect?.includes("deszcz") || threat.expect?.includes("ulew"));
  assert.match(threat.detail, /Idzie od zachodu/);
  assert.match(threat.detail, /Spodziewaj się/);
  assert.match(threat.detail, /Dojście nad Testowo/);
});

test("precip already over the pin is ETA teraz", () => {
  const frames = [frame(1_000, blob(50.0, 21.0, 2), 1.2), frame(1_600, blob(50.02, 21.03, 2), 2.1)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.etaMin, 0);
  assert.equal(threat.willHit, true);
  assert.match(threat.detail, /teraz/);
});

test("cell passing ~90 km north is drawn but does not claim a hit on the pin", () => {
  const frames = [frame(1_000, blob(50.85, 20.5, 2), 95), frame(1_600, blob(50.85, 20.65, 2), 93)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.willHit, false);
  assert.ok(threat.tracks.length >= 1);
  assert.ok(
    threat.nearestKm !== null && threat.nearestKm <= TRACK_MAX_KM,
    `nearest should stay inside ${TRACK_MAX_KM} km, got ${threat.nearestKm}`,
  );
  assert.equal(threat.comingFrom, null);
});

test("cell 300 km away is not a pin threat (may still get a domain arrow)", () => {
  const frames = [frame(1_000, blob(50.0, 25.3, 4), 308), frame(1_600, blob(50.0, 25.45, 4), 318)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.willHit, false);
  assert.equal(threat.comingFrom, null);
  assert.equal(threat.nearestKm, null);
  assert.equal(threat.expect, null);
  assert.match(threat.detail, /100 km/);
});

test("near cell owns pin narrative over a stronger storm 300 km away", () => {
  const frames = [
    frame(1_000, [...blob(50.0, 20.4, 2), ...blob(50.0, 25.3, 4)], 43),
    frame(1_600, [...blob(50.0, 20.55, 2), ...blob(50.0, 25.45, 4)], 32),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.willHit, true);
  assert.ok(threat.nearestKm !== null && threat.nearestKm < 50);
  assert.ok(threat.track, "pin narrative track");
  const dLat = threat.track!.now.lat - city.lat;
  const dLon = threat.track!.now.lon - city.lon;
  const roughKm = Math.hypot(dLat * 111, dLon * 71);
  assert.ok(roughKm <= TRACK_MAX_KM + 5, `pin track ${roughKm.toFixed(0)} km from pin`);
});

test("Zgorzelec: pin narrative follows German cell, not a cell over central Poland", () => {
  const frames = [
    frame(1_000, [...blob(51.15, 14.35, 3), ...blob(51.25, 19.12, 4)], 46),
    frame(1_600, [...blob(51.15, 14.5, 3), ...blob(51.25, 19.28, 4)], 36),
  ];
  const threat = computeThreat(zgorzelec, frames, [], 40);
  assert.ok(threat.tracks.length >= 1, "west cell over Saxony should be tracked");
  assert.ok(threat.comingFrom === "zachodu" || threat.willHit);
  assert.ok(threat.nearestKm !== null && threat.nearestKm < 80);
  assert.ok(threat.track, "pin narrative");
  assert.ok(
    threat.track!.now.lon < 16,
    `pin narrative should use Saxony cell, got lon ${threat.track!.now.lon}`,
  );
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
});

/** Contiguous W→E band ~100 km long, leading edge ~7 km west of pin (Frankfurt-like). */
function contiguousFront(dLon: number): RadarSample[] {
  const s: RadarSample[] = [];
  for (let j = -12; j <= 1; j++) {
    for (let i = -2; i <= 2; i++) {
      s.push({
        lat: 50.0 + i * 0.05,
        lon: 21.0 + dLon + j * 0.08,
        level: j >= -2 ? 3 : 2,
      });
    }
  }
  return s;
}

test("one contiguous front yields exactly one arrow (not two chunks of the same mass)", () => {
  const frames = [
    frame(0, contiguousFront(-0.24), 24),
    frame(600, contiguousFront(-0.16), 16),
    frame(1_200, contiguousFront(-0.08), 10),
    frame(1_800, contiguousFront(0), 7),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.tracks.length, 1, `one mass → one arrow, got ${threat.tracks.length}`);
  assert.ok(threat.track !== null);
  assert.ok(threat.tracks.includes(threat.track!) || threat.track, "pin narrative track exists");
  assert.equal(threat.comingFrom, "zachodu");
  assert.ok(threat.nearestKm !== null && threat.nearestKm < 15);
});

test("arrow sits on the rain mass center and points with the mass, not at the pin", () => {
  // Storm well west of pin, translating east. Arrow must stay on the storm, bearing eastward.
  const frames = [
    frame(0, blob(50.0, 20.4, 3), 43),
    frame(600, blob(50.0, 20.55, 3), 32),
    frame(1_200, blob(50.0, 20.7, 3), 21),
    frame(1_800, blob(50.0, 20.85, 3), 11),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.tracks.length, 1);
  const t = threat.tracks[0]!;
  assert.ok(t.now.lon < city.lon - 0.08, `arrow on mass west of pin, got lon=${t.now.lon}`);
  assert.ok(
    haversineKm(t.now.lat, t.now.lon, city.lat, city.lon) > 8,
    "arrow must not collapse onto the pin",
  );
  assert.equal(threat.comingFrom, "zachodu");
  assert.equal(threat.toward, "wschód");
  // Motion glyph points along advection, not toward the pin
  assert.ok(t.soon.lon > t.now.lon, "grot should point east with the rain");
});

test("arrow anchors on reflectivity core, not the fringe pulled toward the pin", () => {
  function storm(dLon: number): RadarSample[] {
    const s: RadarSample[] = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        s.push({ lat: 50.0 + i * 0.04, lon: 20.35 + dLon + j * 0.04, level: 3 });
      }
    }
    // Weak fringe reaching toward the pin — old 1/d anchor would sit here
    for (let j = 0; j <= 10; j++) {
      s.push({ lat: 50.0, lon: 20.5 + dLon + j * 0.05, level: 1 });
    }
    return s;
  }
  const frames = [
    frame(0, storm(-0.2), 40),
    frame(600, storm(-0.13), 32),
    frame(1_200, storm(-0.06), 22),
    frame(1_800, storm(0), 12),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
  const t = threat.tracks[0]!;
  assert.ok(t.now.lon < 20.45, `core centroid should stay west (~20.35), got lon=${t.now.lon}`);
  assert.ok(
    haversineKm(t.now.lat, t.now.lon, city.lat, city.lon) > 35,
    `arrow too close to pin (${haversineKm(t.now.lat, t.now.lon, city.lat, city.lon).toFixed(0)} km)`,
  );
  assert.equal(threat.comingFrom, "zachodu");
  assert.ok(t.soon.lon > t.now.lon);
});

test("two disconnected storms yield two arrows", () => {
  const frames = [
    frame(0, [...blob(50.0, 20.55, 3), ...blob(50.7, 20.4, 3)], 32),
    frame(600, [...blob(50.0, 20.68, 3), ...blob(50.7, 20.55, 3)], 23),
    frame(1_200, [...blob(50.0, 20.82, 3), ...blob(50.7, 20.7, 3)], 13),
    frame(1_800, [...blob(50.0, 20.95, 3), ...blob(50.7, 20.85, 3)], 4),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.tracks.length, 2, `two masses → two arrows, got ${threat.tracks.length}`);
  const lats = threat.tracks.map((t) => t.now.lat).sort((a, b) => a - b);
  assert.ok(lats[1]! - lats[0]! > 0.4, "arrows should sit on distinct masses");
});

test("a wide stratiform blob is one mass → one arrow", () => {
  const rain: RadarSample[] = [];
  for (let i = -6; i <= 6; i++) {
    for (let j = -4; j <= 4; j++) {
      rain.push({ lat: 50.0 + i * 0.08, lon: 20.7 + j * 0.08, level: 2 });
    }
  }
  const frames = [
    frame(
      0,
      rain.map((s) => ({ ...s, lon: s.lon - 0.12 })),
      20,
    ),
    frame(
      600,
      rain.map((s) => ({ ...s, lon: s.lon - 0.08 })),
      16,
    ),
    frame(
      1_200,
      rain.map((s) => ({ ...s, lon: s.lon - 0.04 })),
      12,
    ),
    frame(1_800, rain, 8),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.tracks.length, 1, `one blob → one arrow, got ${threat.tracks.length}`);
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
  assert.equal(threat.tracks.length, 1, `one front → one arrow, got ${threat.tracks.length}`);
});

test("echo growth toward the pin is not mistaken for advection toward the pin", () => {
  // Stationary core; each frame adds a stronger SE arm aimed at the pin.
  // fieldShift alone invents ~SE motion (~22 km/h) aligned with the pin — wrong.
  function growing(tArm: number): RadarSample[] {
    const s: RadarSample[] = [];
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        s.push({ lat: 51.9 + i * 0.05, lon: 15.5 + j * 0.05, level: 3 });
      }
    }
    for (let k = 0; k < tArm; k++) {
      s.push({ lat: 51.9 - k * 0.04, lon: 15.55 + k * 0.06, level: 3 });
    }
    return s;
  }
  const pin: Place = { lat: 51.55, lon: 16.2, label: "Pin", terc: "0000" };
  const frames = [
    frame(0, growing(2), 40),
    frame(600, growing(5), 35),
    frame(1_200, growing(8), 30),
    frame(1_800, growing(12), 25),
  ];
  const threat = computeThreat(pin, frames, [], 40);
  if (threat.tracks.length === 0) {
    assert.ok(true, "no arrow is acceptable when only growth is detected");
    return;
  }
  const tr = threat.tracks[0]!;
  const toPin = bearingDeg(tr.now.lat, tr.now.lon, pin.lat, pin.lon);
  assert.ok(
    angleDiffDeg(tr.bearing, toPin) > 35,
    `motion ${tr.bearing.toFixed(0)}° too close to pin bearing ${toPin.toFixed(0)}° (Δ=${angleDiffDeg(tr.bearing, toPin).toFixed(0)})`,
  );
});

test("same rain frames → same motion bearing for nearby pins (pin is not an input to advection)", () => {
  const frames = [
    frame(0, blob(50.0, 20.4, 3), 43),
    frame(600, blob(50.0, 20.55, 3), 32),
    frame(1_200, blob(50.0, 20.7, 3), 21),
    frame(1_800, blob(50.0, 20.85, 3), 11),
  ];
  const pinA: Place = { lat: 50.0, lon: 21.0, label: "A", terc: "1" };
  const pinB: Place = { lat: 50.12, lon: 21.08, label: "B", terc: "1" };
  const a = computeThreat(pinA, frames, [], 40);
  const b = computeThreat(pinB, frames, [], 40);
  assert.ok(a.tracks.length >= 1 && b.tracks.length >= 1);
  assert.ok(
    angleDiffDeg(a.tracks[0]!.bearing, b.tracks[0]!.bearing) < 5,
    `bearing must be pin-independent: ${a.tracks[0]!.bearing} vs ${b.tracks[0]!.bearing}`,
  );
});

test("same rain frames + same sample origin → identical arrows for any pin (place only affects warnings/ETA)", () => {
  // Two storms in one window; ranking by pin distance would swap which get drawn.
  const west = (t: number) => blob(50.05, 19.6 + t * 0.02, 3);
  const east = (t: number) => blob(50.2, 20.5 + t * 0.02, 4);
  const frames = [0, 1, 2, 3].map((t) => frame(t * 600, [...west(t), ...east(t)], 40));
  const origin = { lat: 50.1, lon: 20.0 };
  const pinNearWest: Place = { lat: 50.05, lon: 19.85, label: "W", terc: "1" };
  const pinNearEast: Place = { lat: 50.2, lon: 20.7, label: "E", terc: "2" };
  const a = computeThreat(pinNearWest, frames, [], 40, origin);
  const b = computeThreat(pinNearEast, frames, [], 40, origin);
  assert.equal(a.tracks.length, b.tracks.length);
  assert.ok(a.tracks.length >= 1);
  for (let i = 0; i < a.tracks.length; i++) {
    const ta = a.tracks[i]!;
    const tb = b.tracks[i]!;
    assert.ok(
      Math.abs(ta.now.lat - tb.now.lat) < 0.01 && Math.abs(ta.now.lon - tb.now.lon) < 0.01,
      `arrow ${i} anchor moved with pin: ${ta.now.lat},${ta.now.lon} vs ${tb.now.lat},${tb.now.lon}`,
    );
    assert.ok(
      angleDiffDeg(ta.bearing, tb.bearing) < 5,
      `arrow ${i} bearing moved with pin: ${ta.bearing} vs ${tb.bearing}`,
    );
    assert.equal(ta.threatening, tb.threatening, "glyph style must not depend on pin");
  }
});

test("faster cell draws a longer forward shaft than a slower cell", () => {
  const slowFrames = [
    frame(0, blob(50.0, 19.5, 3), 40),
    frame(600, blob(50.0, 19.55, 3), 35),
    frame(1_200, blob(50.0, 19.6, 3), 30),
    frame(1_800, blob(50.0, 19.65, 3), 25),
  ];
  const fastFrames = [
    frame(0, blob(50.0, 19.5, 3), 40),
    frame(600, blob(50.0, 19.7, 3), 30),
    frame(1_200, blob(50.0, 19.9, 3), 20),
    frame(1_800, blob(50.0, 20.1, 3), 10),
  ];
  const origin = { lat: 50.0, lon: 20.0 };
  const slow = computeThreat(city, slowFrames, [], 40, origin);
  const fast = computeThreat(city, fastFrames, [], 40, origin);
  assert.ok(slow.tracks[0] && fast.tracks[0]);
  const slowLen = haversineKm(
    slow.tracks[0]!.now.lat,
    slow.tracks[0]!.now.lon,
    slow.tracks[0]!.soon.lat,
    slow.tracks[0]!.soon.lon,
  );
  const fastLen = haversineKm(
    fast.tracks[0]!.now.lat,
    fast.tracks[0]!.now.lon,
    fast.tracks[0]!.soon.lat,
    fast.tracks[0]!.soon.lon,
  );
  assert.ok(
    fastLen > slowLen * 1.4,
    `fast shaft ${fastLen.toFixed(1)} km should clearly exceed slow ${slowLen.toFixed(1)} km`,
  );
  assert.ok(
    Math.abs(fastLen - fast.tracks[0]!.speedKmh * 0.5) < 3,
    `forward length should be ~30 min of travel (got ${fastLen.toFixed(1)} vs ${(fast.tracks[0]!.speedKmh * 0.5).toFixed(1)})`,
  );
});

test("after a front splits, the main core keeps ~north motion (no mega-mass teleport)", () => {
  // t0: one huge connected front. Later: splits into west core (real N motion) + NE chip.
  function band(
    lat0: number,
    lon0: number,
    w: number,
    h: number,
    level: RadarLevel,
  ): RadarSample[] {
    const out: RadarSample[] = [];
    for (let i = -h; i <= h; i++) {
      for (let j = -w; j <= w; j++) {
        out.push({ lat: lat0 + i * 0.04, lon: lon0 + j * 0.04, level });
      }
    }
    return out;
  }
  const frames = [
    frame(0, band(52.5, 16.5, 12, 8, 3), 40),
    frame(600, [...band(52.55, 16.5, 8, 6, 3), ...band(53.2, 17.5, 3, 3, 2)], 40),
    frame(1_200, [...band(52.65, 16.5, 8, 6, 3), ...band(53.25, 17.6, 3, 3, 2)], 40),
    frame(1_800, [...band(52.75, 16.5, 8, 6, 3), ...band(53.3, 17.7, 3, 3, 2)], 40),
  ];
  const threat = computeThreat(city, frames, [], 40, { lat: 52.5, lon: 17.0 });
  const west = threat.tracks.find((t) => t.now.lon < 17.0 && t.now.lat < 53.0);
  assert.ok(west, "west core should be tracked");
  assert.ok(
    west!.bearing < 40 || west!.bearing > 320,
    `west core should move ~north, got bearing ${west!.bearing.toFixed(0)}`,
  );
  // Teleport from mega-centroid onto a distant fragment would imply extreme speed.
  for (const t of threat.tracks) {
    assert.ok(
      t.speedKmh <= 95,
      `implausible speed ${t.speedKmh} — likely matched across a split mega-mass`,
    );
  }
});

test("oversized translating front splits into local arrows pointing with the rain", () => {
  // ~250 km wide slab moving east — must not vanish; local pieces should track east.
  function slab(lon0: number, half: number): RadarSample[] {
    const out: RadarSample[] = [];
    for (let i = -3; i <= 3; i++) {
      for (let j = -half; j <= half; j++) {
        out.push({ lat: 52.0 + i * 0.05, lon: lon0 + j * 0.05, level: 3 });
      }
    }
    return out;
  }
  const frames = [
    frame(0, slab(17.0, 25), 40),
    frame(600, slab(17.15, 25), 40),
    frame(1_200, slab(17.3, 25), 40),
    frame(1_800, slab(17.45, 25), 40),
  ];
  const threat = computeThreat(city, frames, [], 40, { lat: 52.0, lon: 19.0 });
  assert.ok(threat.tracks.length >= 1, "split local masses should still yield arrows");
  for (const tr of threat.tracks) {
    assert.ok(
      tr.bearing > 50 && tr.bearing < 130,
      `split piece should move ~east, got ${tr.bearing.toFixed(0)}`,
    );
  }
});

test("clear multi-frame translation is high-confidence and drawn", () => {
  const frames = [
    frame(0, blob(50.0, 19.5, 3), 40),
    frame(600, blob(50.0, 19.7, 3), 30),
    frame(1_200, blob(50.0, 19.9, 3), 20),
    frame(1_800, blob(50.0, 20.1, 3), 10),
  ];
  const threat = computeThreat(city, frames, [], 40, { lat: 50.0, lon: 20.0 });
  assert.ok(threat.tracks.length >= 1);
  assert.ok(
    (threat.tracks[0]!.confidence ?? 0) >= 65,
    `expected high confidence, got ${threat.tracks[0]!.confidence}`,
  );
});

test("ambiguous two-frame jitter is not drawn (low confidence)", () => {
  // Barely moves, only two frames — should stay hidden.
  const frames = [frame(0, blob(50.0, 20.0, 2), 40), frame(600, blob(50.02, 20.03, 2), 40)];
  const threat = computeThreat(city, frames, [], 40, { lat: 50.0, lon: 20.0 });
  assert.equal(threat.tracks.length, 0, "uncertain motion must not show an arrow");
});

test("bright core jumping SE must not beat bulk echo moving west", () => {
  function bulkWithBright(t: number): RadarSample[] {
    const samples: RadarSample[] = [];
    const lon0 = 17.5 - t * 0.07;
    for (let i = -4; i <= 4; i++) {
      for (let j = -7; j <= 7; j++) {
        samples.push({ lat: 54.4 + i * 0.04, lon: lon0 + j * 0.04, level: 2 });
      }
    }
    const bLat = 54.4 + t * 0.08;
    const bLon = 17.5 + t * 0.12;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        samples.push({ lat: bLat + i * 0.03, lon: bLon + j * 0.03, level: 4 });
      }
    }
    return samples;
  }
  const frames = [0, 1, 2, 3].map((t) => frame(t * 600, bulkWithBright(t), 40));
  const threat = computeThreat(city, frames, [], 40, { lat: 54.4, lon: 17.5 });
  for (const tr of threat.tracks) {
    // Bulk moves west (~270°); SE (~90–150°) would be the bright-core trap.
    assert.ok(
      tr.bearing > 200 || tr.bearing < 20,
      `expected ~west bulk motion, got ${tr.bearing.toFixed(0)}° at ${tr.now.lat.toFixed(2)},${tr.now.lon.toFixed(2)}`,
    );
  }
});

test("a strong cell 20 km away plus drizzle over the pin is not 'nad Tobą'", () => {
  // Level-3 core ~19 km north of the pin (nearest edge), level-1 samples right over it.
  const core = blob(50.25, 21.0, 3);
  const drizzle: RadarSample[] = [
    { lat: 50.0, lon: 21.0, level: 1 },
    { lat: 50.02, lon: 21.03, level: 1 },
  ];
  const frames = [frame(1_000, [...core, ...drizzle], 0), frame(1_600, [...core, ...drizzle], 0)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.pinLevel, 1);
  assert.equal(threat.maxLevel, 3, "context max within 25 km is still the strong cell");
  assert.notEqual(threat.level, "now", `expected not 'now', got ${threat.level}`);
  assert.equal(threat.etaMin, 0, "drizzle over the pin is still 'teraz'");
  assert.equal(threat.expect, "słaby deszcz");
});

test("pin timeline: dry now, rain arrives when the advected cell reaches the pin", () => {
  const frames = [frame(1_000, blob(50.0, 20.4), 43), frame(1_600, blob(50.0, 20.55), 32)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.timelineAdvected, true);
  assert.equal(threat.timeline.length, 19);
  assert.equal(threat.timeline[0]!.level, 0, "nothing over the pin right now");
  const arrival = threat.timeline.find((p) => p.level >= 2);
  assert.ok(arrival, "rain should show up in the 90-min strip");
  assert.ok(arrival.t >= 15 && arrival.t <= 50, `arrival at ${arrival.t} min`);
  assert.ok(
    threat.etaMin !== null && Math.abs(arrival.t - threat.etaMin) <= 12,
    `timeline arrival ${arrival.t} vs ETA ${threat.etaMin}`,
  );
  // Rate carries through from samples when present; synthetic samples fall back to the class floor.
  assert.ok(arrival.rate >= 4);
});

test("pin timeline without motion is persistence, flagged as such", () => {
  const still = blob(50.0, 21.0, 2);
  const frames = [frame(1_000, still, 0), frame(1_600, still, 0)];
  const threat = computeThreat(city, frames, [], 40);
  assert.equal(threat.timelineAdvected, false);
  assert.ok(threat.timeline.every((p) => p.level === 2));
});

test("stationary echo (zero NCC shift) does not invent an arrow", () => {
  const rain = blob(50.2, 20.2, 3);
  const frames = [0, 1, 2, 3].map((t) => frame(t * 600, rain, 20));
  const threat = computeThreat(city, frames, [], 40, { lat: 50.2, lon: 20.2 });
  assert.equal(threat.tracks.length, 0);
});

test("degraded frames still produce a threat object", () => {
  const frames = [
    { ...frame(0, blob(50.0, 20.4, 3), 43), degraded: true },
    { ...frame(600, blob(50.0, 20.55, 3), 32), degraded: true },
    frame(1_200, blob(50.0, 20.7, 3), 21),
    frame(1_800, blob(50.0, 20.85, 3), 11),
  ];
  const threat = computeThreat(city, frames, [], 40);
  assert.ok(threat.tracks.length >= 1);
});

test("klasa 4 over the pin is Ulewa without lightning, Burza with a nearby strike", () => {
  const frames = [frame(1_000, blob(50.0, 21.0, 4), 1), frame(1_600, blob(50.02, 21.03, 4), 2)];
  const dry = computeThreat(city, frames, [], 40);
  assert.equal(dry.lightningNearCell, false);
  assert.equal(dry.title, "Ulewa nad Tobą");

  const wet = computeThreat(city, frames, [], 40, city, [
    { lat: 50.01, lon: 21.02, timeMs: Date.now() },
  ]);
  assert.equal(wet.lightningNearCell, true);
  assert.equal(wet.title, "Burza nad Tobą");
});

test("klasa 4 incoming is Ulewa unless lightning sits on that cell", () => {
  const frames = [frame(1_000, blob(50.0, 20.4, 4), 43), frame(1_600, blob(50.0, 20.55, 4), 32)];
  const dry = computeThreat(city, frames, [], 40);
  assert.match(dry.title, /Ulewa nadciąga/);
  assert.equal(dry.lightningNearCell, false);

  const onCell = computeThreat(city, frames, [], 40, city, [
    { lat: 50.0, lon: 20.55, timeMs: Date.now() },
  ]);
  assert.equal(onCell.lightningNearCell, true);
  assert.equal(onCell.title, "Burza nadciąga");

  const far = computeThreat(city, frames, [], 40, city, [
    { lat: 54.4, lon: 18.6, timeMs: Date.now() },
  ]);
  assert.equal(far.lightningNearCell, false);
  assert.equal(far.title, "Ulewa nadciąga");
});

test("klasa 3 plus lightning near the cell earns Burza (the F4 miss)", () => {
  const frames = [frame(1_000, blob(50.0, 20.4, 3), 43), frame(1_600, blob(50.0, 20.55, 3), 32)];
  const dry = computeThreat(city, frames, [], 40);
  assert.equal(dry.title, "Ulewa nadciąga");
  const wet = computeThreat(city, frames, [], 40, city, [
    { lat: 50.0, lon: 20.55, timeMs: Date.now() },
  ]);
  assert.equal(wet.title, "Burza nadciąga");
});
