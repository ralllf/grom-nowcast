import assert from "node:assert/strict";
import test from "node:test";
import type { RadarLevel, RadarMemoryFrame, RadarSample } from "./types.ts";
import {
  HINDCAST_LEADS,
  RESEARCH_ALERT_CONFIG,
  SHIPPED_ALERT_CONFIG,
  cellKmFromSampleCount,
  percentiles,
  rates,
  scoreHindcast,
  szansaBucketLabel,
  wantsJson,
} from "./hindcast-summary.ts";

function blob(lat: number, lon: number, level: RadarLevel = 3): RadarSample[] {
  const samples: RadarSample[] = [];
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      samples.push({ lat: lat + i * 0.04, lon: lon + j * 0.04, level });
    }
  }
  return samples;
}

function frame(time: number, samples: RadarSample[]): RadarMemoryFrame {
  const maxLevel = Math.max(0, ...samples.map((s) => s.level)) as RadarLevel;
  return { time, samples, maxLevel, nearestKm: null };
}

test("wantsJson is true only when --json is present", () => {
  assert.equal(wantsJson(["--cached"]), false);
  assert.equal(wantsJson(["--json"]), true);
  assert.equal(wantsJson(["--cached", "--json"]), true);
});

test("rates compute POD/FAR/CSI with the hindcast denominators", () => {
  const r = rates({ hit: 6, miss: 4, fa: 2, cn: 8 });
  assert.equal(r.pod, 0.6);
  assert.equal(r.far, 0.25);
  assert.equal(r.csi, 0.5);
  assert.equal(r.n, 20);
  assert.equal(r.obs, 10);
});

test("rates stay defined on empty tabs", () => {
  const r = rates({ hit: 0, miss: 0, fa: 0, cn: 0 });
  assert.equal(r.pod, 0);
  assert.equal(r.far, 0);
  assert.equal(r.csi, 0);
});

test("percentiles return p10/p50/p90 on a sorted series", () => {
  const p = percentiles([-20, -10, 0, 5, 10, 20, 30]);
  assert.ok(p);
  assert.equal(p.n, 7);
  assert.equal(p.p10, -20);
  assert.equal(p.p50, 5);
  assert.equal(p.p90, 30);
});

test("percentiles are null when there are no hits", () => {
  assert.equal(percentiles([]), null);
});

test("szansa buckets are 10-pt chancePct bins", () => {
  assert.equal(szansaBucketLabel(10), "0-19");
  assert.equal(szansaBucketLabel(25), "20-29");
  assert.equal(szansaBucketLabel(70), "70-79");
  assert.equal(szansaBucketLabel(90), "90-100");
});

test("scoreHindcast emits a comparable summary for both alert configs", () => {
  const pin = { lat: 50.0, lon: 21.0 };
  // Cell marches east toward the pin (~15 km / 10 min), then sits on it.
  const frames: RadarMemoryFrame[] = [];
  const lons = [20.4, 20.55, 20.7, 20.85, 21.0, 21.0, 21.0, 21.0, 21.0, 21.0];
  const t0 = 1_777_766_000;
  for (let i = 0; i < 10; i++) {
    frames.push(frame(t0 + i * 600, blob(50.0, lons[i]!, 3)));
  }
  const nowMs = (t0 + 9 * 600) * 1000 + 90_000;
  const summary = scoreHindcast({
    frames,
    pins: [pin],
    origin: { lat: 50.0, lon: 21.0 },
    nowMs,
    downloadedAtMs: nowMs,
  });

  assert.equal(summary.date, new Date((t0 + 9 * 600) * 1000).toISOString().slice(0, 10));
  assert.equal(summary.radar.frames, 10);
  assert.equal(summary.radar.latestAgeSec, 90);
  assert.deepEqual(summary.cellKm, [3]);
  assert.ok(summary.sampleCount.max >= 25);

  assert.equal(summary.alerts.research.leadMin, RESEARCH_ALERT_CONFIG.leadMin);
  assert.equal(summary.alerts.research.minChancePct, RESEARCH_ALERT_CONFIG.minChancePct);
  assert.equal(summary.alerts.shipped.leadMin, SHIPPED_ALERT_CONFIG.leadMin);
  assert.equal(summary.alerts.shipped.minLevel, SHIPPED_ALERT_CONFIG.minLevel);
  assert.equal(summary.alerts.shipped.minChancePct, SHIPPED_ALERT_CONFIG.minChancePct);

  for (const lead of HINDCAST_LEADS) {
    assert.ok(summary.nowcast["2"]![String(lead)], `missing nowcast +${lead}`);
    assert.ok(summary.persist["2"]![String(lead)], `missing persist +${lead}`);
  }
  assert.ok(summary.alerts.research.byThreshold["1"]);
  assert.ok(summary.alerts.research.byThreshold["2"]);
  assert.ok(summary.alerts.shipped.skill);

  assert.ok(summary.motion.echoCases >= 1);
  assert.ok(
    Math.abs(
      summary.motion.advectedPct + summary.motion.persistPct + summary.motion.crudeEtaPct - 100,
    ) < 0.01,
  );

  const calibN = summary.szansa.reduce((s, b) => s + b.n, 0);
  assert.ok(calibN >= 1, "Szansa table should score echo cases");
  for (const b of summary.szansa) {
    assert.ok(b.observedRate >= 0 && b.observedRate <= 1);
    assert.ok(b.meanChancePct >= 0 && b.meanChancePct <= 100);
  }
});

test("latestAgeSec is null without a download stamp (cached re-score)", () => {
  const t0 = 1_777_766_000;
  const still = blob(50.0, 21.0, 2);
  const frames: RadarMemoryFrame[] = Array.from({ length: 10 }, (_, i) =>
    frame(t0 + i * 600, still),
  );
  const summary = scoreHindcast({
    frames,
    pins: [{ lat: 50.0, lon: 21.0 }],
    origin: { lat: 50.0, lon: 21.0 },
    nowMs: t0 * 1000 + 86_400_000,
  });
  assert.equal(summary.radar.latestAgeSec, null);
});

test("cellKmFromSampleCount is a 3 km echo-cell proxy, not server aggregate()", () => {
  assert.equal(cellKmFromSampleCount(100), 3);
  assert.equal(cellKmFromSampleCount(9000), 3);
  assert.equal(cellKmFromSampleCount(9001), 6);
  assert.equal(cellKmFromSampleCount(36_001), 12);
});

test("shipped 30 min window ignores rain that research 60 min still scores", () => {
  const pin = { lat: 50.0, lon: 21.0 };
  // Stationary cell sits 40 km west through +30, then jumps onto the pin at +50.
  // Crude, but firstObs(30) is null and firstObs(60) is 50 — the window split.
  const west = blob(50.0, 20.45, 3);
  const over = blob(50.0, 21.0, 3);
  const t0 = 1_777_800_000;
  const frames: RadarMemoryFrame[] = [];
  for (let i = 0; i < 10; i++) {
    frames.push(frame(t0 + i * 600, i >= 8 ? over : west));
  }
  const summary = scoreHindcast({
    frames,
    pins: [pin],
    origin: { lat: 50.0, lon: 21.0 },
    downloadedAtMs: (t0 + 9 * 600) * 1000,
  });
  assert.equal(summary.alerts.research.byThreshold["2"]!.skill.obs >= 1, true);
  assert.equal(summary.alerts.shipped.skill.obs, 0);
  assert.ok(
    summary.nowcast["2"]!["50"]!.obs >= 1,
    "klasa ≥ 2 must be over the pin at +50",
  );
  assert.equal(summary.nowcast["2"]!["30"]!.obs, 0);
});
