import assert from "node:assert/strict";
import test from "node:test";
import {
  ALL_CLEAR_DEBOUNCE_MIN,
  DEFAULT_ALERT_SETTINGS,
  EMPTY_ALERT_MEMORY,
  EPISODE_TTL_MIN,
  evaluateAlert,
  isQuietHour,
  type AlertMemory,
  type AlertSettings,
} from "./alerts.ts";
import type { RadarLevel, Threat } from "./types.ts";

const MIN = 60_000;
const T0 = 1_700_000_000_000;

function threat(over: Partial<Threat> = {}): Threat {
  return {
    level: "clear",
    title: "Czysto",
    detail: "",
    etaMin: null,
    approaching: false,
    receding: false,
    speedKmh: null,
    nearestKm: null,
    maxLevel: 0,
    pinLevel: 0,
    cellLevel: 0,
    chancePct: 10,
    comingFrom: null,
    toward: null,
    willHit: false,
    missKm: null,
    expect: null,
    track: null,
    tracks: [],
    matchedWarnings: [],
    timeline: [],
    timelineAdvected: false,
    ...over,
  };
}

const incoming = (etaMin: number, level: RadarLevel = 3) =>
  threat({
    level: "imminent",
    etaMin,
    approaching: true,
    willHit: true,
    speedKmh: 40,
    nearestKm: 30,
    cellLevel: level,
    chancePct: 70,
    comingFrom: "zachodu",
    toward: "wschód",
    expect: "ulewę i porywisty wiatr",
  });

const overPin = (level: RadarLevel = 3) =>
  threat({
    level: "now",
    etaMin: 0,
    willHit: true,
    nearestKm: 4,
    maxLevel: level,
    pinLevel: level,
    cellLevel: level,
    chancePct: 85,
    expect: "ulewę i porywisty wiatr",
  });

const clear = () => threat();

const on: AlertSettings = { ...DEFAULT_ALERT_SETTINGS, enabled: true };

function run(
  steps: Array<[Threat, number]>,
  settings: AlertSettings = on,
  memory: AlertMemory = EMPTY_ALERT_MEMORY,
) {
  const fired: string[] = [];
  let mem = memory;
  for (const [t, atMin] of steps) {
    const now = T0 + atMin * MIN;
    const r = evaluateAlert(t, settings, mem, now, {
      placeLabel: "Kraków",
      radarTime: Math.floor(now / 1000) - 300,
    });
    mem = r.memory;
    if (r.event) fired.push(r.event.kind);
  }
  return { fired, mem };
}

test("disabled settings never fire", () => {
  const { fired } = run([[incoming(15), 0]], { ...on, enabled: false });
  assert.deepEqual(fired, []);
});

test("incoming fires once, then now once, then all-clear once per episode", () => {
  const { fired, mem } = run([
    [clear(), 0],
    [incoming(25), 2],
    [incoming(22), 4],
    [incoming(10), 12],
    [overPin(), 22],
    [overPin(), 24],
    [threat({ nearestKm: 25, receding: true, toward: "wschód" }), 40],
    [threat({ nearestKm: 30, receding: true, toward: "wschód" }), 42],
    [threat({ nearestKm: 40, receding: true, toward: "wschód" }), 44],
    [clear(), 60],
  ]);
  assert.deepEqual(fired, ["incoming", "now", "allclear"]);
  assert.equal(mem.stage, "idle");
});

test("incoming copy reads like a sentence", () => {
  const now = T0;
  const r = evaluateAlert(incoming(18), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000),
  });
  assert.ok(r.event);
  assert.equal(r.event.title, "Ulewa i wiatr za ok. 18 min");
  assert.match(r.event.body, /^Idzie od zachodu \(~40 km\/h\) na Kraków\. Szansa ~70%\./);
  assert.match(r.event.body, /Spodziewaj się: ulewę i porywisty wiatr\./);
  assert.equal(r.event.id.endsWith(":incoming"), true);
});

test("incoming title and etaMin subtract radar age (18 − 11 → 7)", () => {
  const now = T0;
  const r = evaluateAlert(incoming(18), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000) - 11 * 60,
  });
  assert.ok(r.event);
  assert.equal(r.event.title, "Ulewa i wiatr za ok. 7 min");
  assert.equal(r.event.etaMin, 7);
  assert.match(r.event.body, /sprzed 11 min/);
});

test("wall-clock ETA at 0 titles the incoming alert teraz, not za ok. 0", () => {
  const now = T0;
  const r = evaluateAlert(incoming(8), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000) - 11 * 60,
  });
  assert.ok(r.event);
  assert.equal(r.event.kind, "incoming");
  assert.equal(r.event.title, "Ulewa i wiatr teraz");
  assert.equal(r.event.etaMin, 0);
});

test("leadMin compares wall-clock minutes so a 35 frame-min cell fires after 11 min of age", () => {
  const now = T0;
  const fresh = evaluateAlert(incoming(35), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000),
  });
  assert.equal(fresh.event, null);
  const aged = evaluateAlert(incoming(35), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000) - 11 * 60,
  });
  assert.equal(aged.event?.kind, "incoming");
  assert.equal(aged.event?.etaMin, 24);
});

test("a fresh cell after an all-clear starts a new episode and alerts again", () => {
  const { fired } = run([
    [incoming(20), 0],
    [overPin(), 20],
    [clear(), 30],
    [clear(), 30 + ALL_CLEAR_DEBOUNCE_MIN],
    [incoming(20), 90],
  ]);
  assert.deepEqual(fired, ["incoming", "now", "allclear", "incoming"]);
});

test("track that misses fires a 'minęło bokiem' all-clear, not 'now'", () => {
  const steps: Array<[Threat, number]> = [
    [incoming(20), 0],
    [threat({ nearestKm: 22, missKm: 15, comingFrom: "zachodu" }), 10],
    [threat({ nearestKm: 26, missKm: 15 }), 14],
  ];
  let mem: AlertMemory = EMPTY_ALERT_MEMORY;
  const bodies: string[] = [];
  for (const [t, atMin] of steps) {
    const now = T0 + atMin * MIN;
    const r = evaluateAlert(t, on, mem, now, { placeLabel: "Kraków", radarTime: now / 1000 });
    mem = r.memory;
    if (r.event) bodies.push(`${r.event.kind}|${r.event.body}`);
  }
  assert.equal(bodies.length, 2);
  assert.match(bodies[1]!, /^allclear\|Komórka minęła Kraków bokiem/);
});

test("all-clear needs the debounce — one clear poll is not enough", () => {
  const { fired, mem } = run([
    [incoming(20), 0],
    [clear(), 5],
    [clear(), 5 + ALL_CLEAR_DEBOUNCE_MIN - 1],
  ]);
  assert.deepEqual(fired, ["incoming"]);
  assert.notEqual(mem.stage, "idle");
});

test("all-clear can be switched off; episode still ends", () => {
  const { fired, mem } = run(
    [
      [overPin(), 0],
      [clear(), 5],
      [clear(), 5 + ALL_CLEAR_DEBOUNCE_MIN],
    ],
    { ...on, allClear: false },
  );
  assert.deepEqual(fired, ["now"]);
  assert.equal(mem.stage, "idle");
});

test("ETA beyond lead time waits; fires once it comes inside", () => {
  const { fired } = run(
    [
      [incoming(50), 0],
      [incoming(40), 5],
      [incoming(28), 10],
      [incoming(20), 15],
    ],
    { ...on, leadMin: 30 },
  );
  assert.deepEqual(fired, ["incoming"]);
});

test("weak echo below the intensity threshold is ignored, both incoming and over pin", () => {
  const { fired } = run(
    [
      [incoming(15, 1), 0],
      [overPin(1), 10],
    ],
    { ...on, minLevel: 2 },
  );
  assert.deepEqual(fired, []);
  const { fired: fired1 } = run([[incoming(15, 1), 0]], { ...on, minLevel: 1 });
  assert.deepEqual(fired1, ["incoming"]);
});

test("low chance is ignored", () => {
  const { fired } = run([[threat({ ...incoming(15), chancePct: 30 }), 0]], {
    ...on,
    minChancePct: 50,
  });
  assert.deepEqual(fired, []);
});

test("receding echo never counts as incoming", () => {
  const { fired } = run([[threat({ ...incoming(15), receding: true }), 0]]);
  assert.deepEqual(fired, []);
});

test("stale radar never alerts and leaves memory untouched", () => {
  const now = T0;
  const r = evaluateAlert(incoming(10), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: Math.floor(now / 1000) - 45 * 60,
  });
  assert.equal(r.event, null);
  assert.equal(r.reason, "stale");
  assert.deepEqual(r.memory, EMPTY_ALERT_MEMORY);
  const r2 = evaluateAlert(incoming(10), on, EMPTY_ALERT_MEMORY, now, {
    placeLabel: "Kraków",
    radarTime: null,
  });
  assert.equal(r2.reason, "stale");
});

test("an episode that just fades (cell dissolves) expires silently after the TTL", () => {
  const { fired, mem } = run([
    [incoming(20), 0],
    // Echo lingers 15 km away but never qualifies again, then vanishes long after.
    [threat({ nearestKm: 15, cellLevel: 1, maxLevel: 1 }), 10],
    [clear(), EPISODE_TTL_MIN + 20],
  ]);
  assert.deepEqual(fired, ["incoming"]);
  assert.equal(mem.stage, "idle");
});

test("going straight to 'now' from idle skips incoming", () => {
  const { fired } = run([
    [overPin(), 0],
    [overPin(), 2],
  ]);
  assert.deepEqual(fired, ["now"]);
});

test("quiet hours handle a window that wraps midnight", () => {
  const s = { quietFrom: 22, quietTo: 7 };
  assert.equal(isQuietHour(s, new Date(2026, 0, 1, 23, 30)), true);
  assert.equal(isQuietHour(s, new Date(2026, 0, 1, 3, 0)), true);
  assert.equal(isQuietHour(s, new Date(2026, 0, 1, 7, 0)), false);
  assert.equal(isQuietHour(s, new Date(2026, 0, 1, 12, 0)), false);
  assert.equal(isQuietHour({ quietFrom: 9, quietTo: 17 }, new Date(2026, 0, 1, 12, 0)), true);
  assert.equal(isQuietHour({ quietFrom: null, quietTo: 7 }, new Date(2026, 0, 1, 3, 0)), false);
});

test("drizzle over the pin now with a downpour 20 min out fires 'incoming' for the downpour", () => {
  const t = threat({
    level: "now",
    etaMin: 0,
    willHit: true,
    nearestKm: 2,
    maxLevel: 1,
    pinLevel: 1,
    cellLevel: 3,
    chancePct: 75,
    comingFrom: "zachodu",
    speedKmh: 45,
    timelineAdvected: true,
    timeline: Array.from({ length: 19 }, (_, i) => ({
      t: i * 5,
      level: (i * 5 >= 20 ? 3 : 1) as 1 | 3,
      rate: i * 5 >= 20 ? 6 : 0.4,
    })),
  });
  const r = evaluateAlert(t, on, EMPTY_ALERT_MEMORY, T0, {
    placeLabel: "Kraków",
    radarTime: T0 / 1000,
  });
  assert.ok(r.event, "expected an event");
  assert.equal(r.event.kind, "incoming");
  assert.equal(r.event.title, "Ulewa i wiatr za ok. 20 min");
  // …and once the downpour is over the pin, 'now' follows in the same episode.
  const r2 = evaluateAlert(
    threat({ ...t, pinLevel: 3, maxLevel: 3, timeline: [], timelineAdvected: false }),
    on,
    r.memory,
    T0 + 20 * MIN,
    { placeLabel: "Kraków", radarTime: T0 / 1000 + 1200 },
  );
  assert.equal(r2.event?.kind, "now");
});

test("'now' needs the threshold intensity over the pin, not within 25 km", () => {
  const t = threat({
    level: "now",
    etaMin: 0,
    willHit: true,
    nearestKm: 3,
    maxLevel: 3, // strong cell 20 km away
    pinLevel: 1, // drizzle here
    cellLevel: 1,
    chancePct: 60,
  });
  const r = evaluateAlert(t, { ...on, minLevel: 2 }, EMPTY_ALERT_MEMORY, T0, {
    placeLabel: "Kraków",
    radarTime: T0 / 1000,
  });
  assert.equal(r.event, null);
});
