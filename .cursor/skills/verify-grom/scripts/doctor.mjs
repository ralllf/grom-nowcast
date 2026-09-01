#!/usr/bin/env node
/**
 * Read-only: is this GROM Vite instance worth driving?
 * GET / then POST getSnapshot for Warszawa. No clicks, no localStorage writes.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { toJSONAsync } from "seroval";

const BASE = (process.env.BASE || "http://127.0.0.1:8080").replace(/\/$/, "");
const OUT = process.env.DOCTOR_OUT || "";

const WARSAW = {
  lat: 52.2297,
  lon: 21.0122,
  radiusKm: 25,
  place: {
    lat: 52.2297,
    lon: 21.0122,
    label: "Warszawa",
    city: "Warszawa",
    state: "województwo mazowieckie",
    terc: "1465",
  },
};

const STALE_RADAR_MIN = 30;

function fail(report, reason) {
  report.ok = false;
  report.reason = reason;
  emit(report);
  process.exit(1);
}

function emit(report) {
  const json = JSON.stringify(report, null, 2);
  process.stdout.write(json + "\n");
  if (OUT) {
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, json);
  }
}

function serovalVal(node) {
  if (node == null || typeof node !== "object") return node;
  const t = node.t;
  if (t === 0 || t === 1) return node.s;
  if (t === 2) {
    const map = { 0: null, 1: undefined, 2: true, 3: false };
    return Object.prototype.hasOwnProperty.call(map, node.s) ? map[node.s] : node.s;
  }
  if (t === 9) return (node.a || []).map(serovalVal);
  if (t === 10) {
    const o = {};
    (node.p?.k || []).forEach((k, i) => {
      o[k] = serovalVal(node.p.v[i]);
    });
    return o;
  }
  return { _t: t };
}

async function snapshotId() {
  const res = await fetch(`${BASE}/src/lib/weather/server.ts`);
  if (!res.ok) throw new Error(`cannot load server.ts transform: ${res.status}`);
  const js = await res.text();
  const m = js.match(
    /export const getSnapshot = createServerFn\(\{ method: "POST" \}\)\.handler\(createClientRpc\("([^"]+)"\)\)/,
  );
  if (!m) throw new Error("getSnapshot createClientRpc id not found (is this npm run dev?)");
  return m[1];
}

const report = {
  ok: false,
  base: BASE,
  checkedAt: new Date().toISOString(),
  html: null,
  snapshot: null,
  reason: "",
};

let htmlRes;
try {
  htmlRes = await fetch(`${BASE}/`);
} catch (e) {
  fail(report, `GET / failed: ${e.message}`);
}

const htmlBuf = Buffer.from(await htmlRes.arrayBuffer());
const html = htmlBuf.toString("utf8").split("\0")[0];
report.html = {
  status: htmlRes.status,
  hasTitle: html.includes("<title>GROM</title>"),
  hasSheet: html.includes('id="grom-threat-sheet"'),
  hasErrorPage: html.includes("Coś poszło nie tak"),
};

if (htmlRes.status !== 200 || !report.html.hasTitle || !report.html.hasSheet || report.html.hasErrorPage) {
  fail(report, "HTML shell is not a live GROM / page");
}

let id;
try {
  id = await snapshotId();
} catch (e) {
  fail(report, e.message);
}

const body = JSON.stringify(await toJSONAsync({ data: WARSAW }));
const t0 = Date.now();
const snapRes = await fetch(`${BASE}/_serverFn/${id}`, {
  method: "POST",
  headers: {
    "x-tsr-serverFn": "true",
    "content-type": "application/json",
    accept: "application/json",
    origin: BASE,
    referer: `${BASE}/`,
    "sec-fetch-site": "same-origin",
  },
  body,
});
const ms = Date.now() - t0;
if (!snapRes.ok) {
  fail(report, `getSnapshot HTTP ${snapRes.status} in ${ms}ms (403 = missing Origin/Sec-Fetch-Site)`);
}

const raw = await snapRes.json();
const envelope = serovalVal(raw);
const snap = envelope.result ?? envelope;
const radar = snap.radar || {};
const ageMin =
  typeof radar.latestTime === "number" ? (Date.now() / 1000 - radar.latestTime) / 60 : Infinity;

report.snapshot = {
  ms,
  functionId: id,
  radarUnavailable: snap.radarUnavailable === true,
  warningsUnavailable: snap.warningsUnavailable === true,
  lightningUnavailable: snap.lightningUnavailable === true,
  analysisSource: radar.analysisSource ?? null,
  latestTime: radar.latestTime ?? null,
  latestAgeMin: Number.isFinite(ageMin) ? Math.round(ageMin * 10) / 10 : null,
  overlayCount: Array.isArray(radar.overlays) ? radar.overlays.length : 0,
  pastCount: Array.isArray(radar.past) ? radar.past.length : 0,
  echoCount: radar.echoCount ?? null,
  stormWarningCount: snap.stormWarningCount ?? null,
  place: snap.place?.label ?? null,
  terc: snap.place?.terc ?? null,
};

if (report.snapshot.radarUnavailable) {
  fail(report, "radarUnavailable — do not treat empty scan as Czysto");
}
if (!report.snapshot.latestTime || ageMin > STALE_RADAR_MIN) {
  fail(report, `radar stale or missing (ageMin=${report.snapshot.latestAgeMin}, need ≤ ${STALE_RADAR_MIN})`);
}
if (report.snapshot.analysisSource !== "sri" && report.snapshot.analysisSource !== "rainviewer") {
  fail(report, `unexpected analysisSource ${report.snapshot.analysisSource}`);
}

report.ok = true;
report.reason = "worth driving";
if (report.snapshot.warningsUnavailable) {
  report.reason += " (IMGW warnings unavailable — skip imgw-warnings assertions)";
}
if (report.snapshot.lightningUnavailable) {
  report.reason += " (PERUN unavailable — expect Wyładowania chwilowo niedostępne)";
}
emit(report);
