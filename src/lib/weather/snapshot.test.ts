import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_ALERT_SETTINGS, EMPTY_ALERT_MEMORY, evaluateAlert } from "./alerts.ts";
import { canTrustRadar, emptyRadarScan, IMGW_WARNINGS_UNAVAILABLE, PERUN_NO_STRIKES, loadSnapshot } from "./snapshot.ts";
import type { OfficialWarning, Place, RadarScan } from "./types.ts";

const place: Place = {
  lat: 50.06,
  lon: 19.94,
  label: "Kraków",
  terc: "1261",
};

function warning(partial: Partial<OfficialWarning> & Pick<OfficialWarning, "id" | "event">): OfficialWarning {
  return {
    degree: 1,
    probability: 80,
    from: "2026-08-31 12:00:00",
    to: "2026-08-31 22:00:00",
    published: "2026-08-31 11:00:00",
    body: "Burze z gradem.",
    office: "IMGW-PIB",
    teryt: [],
    matchesPlace: false,
    stormRelated: true,
    ...partial,
  };
}

const localStorm = warning({
  id: "local",
  event: "Burze",
  teryt: ["1261"],
  stormRelated: true,
});

const nationalStorm = warning({
  id: "national",
  event: "Burze",
  teryt: ["1465"],
  stormRelated: true,
});

const farHeat = warning({
  id: "heat",
  event: "Upał",
  teryt: ["1465"],
  stormRelated: false,
});

const radar: RadarScan = {
  host: "https://tilecache.rainviewer.com",
  generated: 1_700_000_000,
  latestTime: 1_700_000_100,
  past: [{ time: 1_700_000_100, path: "/v2/radar/1700000100" }],
  nowcast: [],
  samples: [],
  prevSamples: [],
  prevTime: null,
  history: [
    {
      time: 1_700_000_100,
      samples: [],
      packed: "abc",
      maxLevel: 3,
      nearestKm: null,
      degraded: false,
    },
  ],
  cellKm: 3,
  maxLevel: 3,
  nearestKm: null,
  echoCount: 12,
};

function http404(url: string) {
  return new Error(`404 ${url}`);
}

function timeout() {
  const err = new Error("This operation was aborted");
  err.name = "AbortError";
  return err;
}

test("both sources up: radar unchanged, IMGW tagged, no unavailable notice", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => radar,
    getImgwWarnings: async () => [localStorm, nationalStorm, farHeat],
  });

  assert.equal(snap.warningsUnavailable, false);
  assert.equal(snap.radarUnavailable, false);
  assert.equal(canTrustRadar(snap), true);
  assert.equal(snap.radar, radar);
  assert.equal(snap.place, place);
  assert.equal(snap.stormWarningCount, 2);
  assert.deepEqual(
    snap.warnings.map((w) => ({ id: w.id, matchesPlace: w.matchesPlace })),
    [
      { id: "local", matchesPlace: true },
      { id: "national", matchesPlace: false },
    ],
  );
  assert.ok(!snap.warnings.some((w) => w.id === "heat"));
});

test("IMGW 404 leaves radar fully functional and shows the notice", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => radar,
    getImgwWarnings: async () => {
      throw http404("https://danepubliczne.imgw.pl/api/data/warningsmeteo");
    },
  });

  assert.equal(snap.radar, radar);
  assert.equal(snap.radar.latestTime, 1_700_000_100);
  assert.equal(snap.radar.echoCount, 12);
  assert.deepEqual(snap.warnings, []);
  assert.equal(snap.stormWarningCount, 0);
  assert.equal(snap.warningsUnavailable, true);
  assert.equal(snap.radarUnavailable, false);
  assert.equal(canTrustRadar(snap), true);
  assert.equal(IMGW_WARNINGS_UNAVAILABLE, "Ostrzeżenia IMGW chwilowo niedostępne");
});

test("IMGW timeout leaves radar fully functional and shows the notice", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => radar,
    getImgwWarnings: async () => {
      throw timeout();
    },
  });

  assert.equal(snap.radar, radar);
  assert.equal(snap.warningsUnavailable, true);
  assert.deepEqual(snap.warnings, []);
});

test("radar 404 leaves IMGW warnings fully functional", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => {
      throw http404("https://api.rainviewer.com/public/weather-maps.json");
    },
    getImgwWarnings: async () => [localStorm, nationalStorm, farHeat],
  });

  assert.equal(snap.warningsUnavailable, false);
  assert.equal(snap.radarUnavailable, true);
  assert.equal(canTrustRadar(snap), false);
  assert.equal(snap.radar.latestTime, null);
  assert.deepEqual(snap.radar.history, []);
  assert.deepEqual(snap.radar.past, []);
  assert.equal(snap.stormWarningCount, 2);
  assert.deepEqual(
    snap.warnings.map((w) => ({ id: w.id, matchesPlace: w.matchesPlace })),
    [
      { id: "local", matchesPlace: true },
      { id: "national", matchesPlace: false },
    ],
  );
});

test("radar timeout leaves IMGW warnings fully functional", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => {
      throw timeout();
    },
    getImgwWarnings: async () => [localStorm],
  });

  assert.equal(snap.warningsUnavailable, false);
  assert.equal(snap.radarUnavailable, true);
  assert.equal(canTrustRadar(snap), false);
  assert.equal(snap.radar.latestTime, null);
  assert.equal(snap.warnings[0]?.id, "local");
  assert.equal(snap.warnings[0]?.matchesPlace, true);
});

test("radar-down snapshot is stale for alerts (existing honesty)", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => {
      throw timeout();
    },
    getImgwWarnings: async () => [localStorm],
  });

  const incoming = {
    level: "imminent" as const,
    title: "Ulewa nadciąga",
    detail: "",
    etaMin: 10,
    approaching: true,
    receding: false,
    speedKmh: 40,
    nearestKm: 12,
    maxLevel: 3 as const,
    pinLevel: 0 as const,
    cellLevel: 3 as const,
    chancePct: 70,
    comingFrom: "zachodu",
    toward: "wschód",
    willHit: true,
    missKm: null,
    expect: "ulewa",
    track: null,
    tracks: [],
    matchedWarnings: snap.warnings,
    timeline: [],
    timelineAdvected: false,
    lightningNearCell: false,
  };

  const result = evaluateAlert(
    incoming,
    { ...DEFAULT_ALERT_SETTINGS, enabled: true },
    EMPTY_ALERT_MEMORY,
    Date.now(),
    { placeLabel: place.label, radarTime: snap.radar.latestTime },
  );
  assert.equal(result.reason, "stale");
  assert.equal(result.event, null);
});

test("maps-up but empty past is not a radar outage", async () => {
  const empty = emptyRadarScan();
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => empty,
    getImgwWarnings: async () => [localStorm],
  });
  assert.equal(snap.radarUnavailable, false);
  assert.equal(canTrustRadar(snap), true);
  assert.equal(snap.radar, empty);
});

test("PERUN bounce leaves radar and IMGW intact and ships no fake strikes", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => radar,
    getImgwWarnings: async () => [localStorm],
    getPerunStrikes: async () => {
      throw new Error("307 https://danepubliczne.imgw.pl/pl/datastore/getfiledown/Oper/Perun/PERUN_Polska/x");
    },
  });
  assert.equal(snap.radar, radar);
  assert.equal(snap.warningsUnavailable, false);
  assert.equal(snap.lightningUnavailable, true);
  assert.deepEqual(snap.lightning, []);
  assert.equal(PERUN_NO_STRIKES, "Brak wyładowań w tej sesji");
});

test("PERUN CSV that actually downloads is kept on the snapshot", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => radar,
    getImgwWarnings: async () => [localStorm],
    getPerunStrikes: async () => ({
      strikes: [{ lat: 50.06, lon: 19.94, timeMs: 1_700_000_000_000 }],
      fetchedAt: 1_700_000_000_000,
      unavailable: false,
      newestFile: "2026.08.31.12.51.ld.csv",
    }),
  });
  assert.equal(snap.lightningUnavailable, false);
  assert.equal(snap.lightning.length, 1);
  assert.equal(snap.lightning[0]!.lat, 50.06);
});

test("both sources down: IMGW notice, radar untrusted, no throw", async () => {
  const snap = await loadSnapshot(place, {
    sampleRadar: async () => {
      throw timeout();
    },
    getImgwWarnings: async () => {
      throw http404("https://danepubliczne.imgw.pl/api/data/warningsmeteo");
    },
  });
  assert.equal(snap.warningsUnavailable, true);
  assert.equal(snap.radarUnavailable, true);
  assert.equal(canTrustRadar(snap), false);
  assert.deepEqual(snap.warnings, []);
});
