/**
 * Hindcast: score GROM's nowcast and alert engine against what the radar actually did.
 *
 *   npm run hindcast            # download the last 2 h of frames and score
 *   npm run hindcast -- --cached  # re-score the frames cached in the OS temp dir
 *
 * Downloads RainViewer frames for Poland (~117 tile requests, paced for the 100 req/min
 * limit), decodes them exactly like the server does, then for a lattice of pins runs
 * computeThreat on frames t−30…t and compares the 0–60 min timeline and evaluateAlert()
 * with the frames that followed. Reports POD / FAR / CSI per lead time against a
 * persistence baseline. Frames are cached in the OS temp dir, never in the repo.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_ALERT_MEMORY,
  evaluateAlert,
} from "../src/lib/weather/alerts.ts";
import { haversineKm, lonLatToTile, tilePixelToLonLat } from "../src/lib/weather/geo.ts";
import { dbzFromRgba, levelFromRate, rateFromDbz } from "../src/lib/weather/palette.ts";
import { computeThreat } from "../src/lib/weather/threat.ts";
import type { RadarLevel, RadarMemoryFrame, RadarSample } from "../src/lib/weather/types.ts";

const BBOX = { minLat: 48.8, maxLat: 55.15, minLon: 13.8, maxLon: 24.6 };
const ORIGIN = { lat: 52.1, lon: 19.35 };
const OBS_KM = 8;
const LEADS = [10, 20, 30, 40, 50, 60];
const CACHE = join(tmpdir(), "grom-hindcast-frames.json");

async function loadFrames(): Promise<RadarMemoryFrame[]> {
  if (existsSync(CACHE) && process.argv.includes("--cached")) {
    return JSON.parse(readFileSync(CACHE, "utf8")) as RadarMemoryFrame[];
  }
  const maps = (await (
    await fetch("https://api.rainviewer.com/public/weather-maps.json")
  ).json()) as {
    host: string;
    radar: { past: { time: number; path: string }[] };
  };
  const z = 6;
  const a = lonLatToTile(BBOX.minLon, BBOX.maxLat, z);
  const b = lonLatToTile(BBOX.maxLon, BBOX.minLat, z);
  const tiles: { x: number; y: number }[] = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) tiles.push({ x, y });
  const out: RadarMemoryFrame[] = [];
  let req = 0;
  for (const frame of maps.radar.past) {
    const cells = new Map<number, { lat: number; lon: number; rate: number }>();
    for (const t of tiles) {
      if (req && req % 80 === 0) {
        console.log("  …pausing 62 s for the RainViewer rate limit");
        await new Promise((r) => setTimeout(r, 62_000));
      }
      const res = await fetch(`${maps.host}${frame.path}/256/${z}/${t.x}/${t.y}/2/0_0.png`);
      req++;
      if (!res.ok) continue;
      const png = PNG.sync.read(Buffer.from(await res.arrayBuffer()));
      for (let py = 0; py < 256; py += 2) {
        for (let px = 0; px < 256; px += 2) {
          const i = (256 * py + px) << 2;
          const dbz = dbzFromRgba(
            png.data[i]!,
            png.data[i + 1]!,
            png.data[i + 2]!,
            png.data[i + 3]!,
          );
          if (dbz === null) continue;
          const ll = tilePixelToLonLat(z, t.x, t.y, px, py, 256);
          if (
            ll.lat < BBOX.minLat ||
            ll.lat > BBOX.maxLat ||
            ll.lon < BBOX.minLon ||
            ll.lon > BBOX.maxLon
          )
            continue;
          const rate = rateFromDbz(dbz);
          const ci = Math.floor((ll.lat - BBOX.minLat) / 0.027);
          const cj = Math.floor((ll.lon - BBOX.minLon) / 0.044);
          const k = ci * 4096 + cj;
          const cur = cells.get(k);
          if (!cur) {
            cells.set(k, {
              lat: BBOX.minLat + (ci + 0.5) * 0.027,
              lon: BBOX.minLon + (cj + 0.5) * 0.044,
              rate,
            });
          } else if (rate > cur.rate) cur.rate = rate;
        }
      }
    }
    const samples: RadarSample[] = [...cells.values()]
      .map((c) => ({
        lat: +c.lat.toFixed(3),
        lon: +c.lon.toFixed(3),
        level: levelFromRate(c.rate),
        rate: +c.rate.toFixed(1),
      }))
      .filter((s) => s.level > 0);
    const maxLevel = samples.reduce<RadarLevel>((m, s) => (s.level > m ? s.level : m), 0);
    out.push({ time: frame.time, samples, maxLevel, nearestKm: null });
    console.log(
      `  ${new Date(frame.time * 1000).toISOString().slice(11, 16)}Z  ${samples.length} samples`,
    );
  }
  writeFileSync(CACHE, JSON.stringify(out));
  return out;
}

function obsLevel(samples: RadarSample[], lat: number, lon: number): RadarLevel {
  let m: RadarLevel = 0;
  for (const s of samples)
    if (haversineKm(lat, lon, s.lat, s.lon) <= OBS_KM && s.level > m) m = s.level;
  return m;
}

type Tab = { hit: number; miss: number; fa: number; cn: number };
const mk = (): Tab => ({ hit: 0, miss: 0, fa: 0, cn: 0 });
function score(t: Tab, pred: boolean, obs: boolean) {
  if (pred && obs) t.hit++;
  else if (!pred && obs) t.miss++;
  else if (pred && !obs) t.fa++;
  else t.cn++;
}
function fmt(t: Tab) {
  const pod = t.hit / Math.max(1, t.hit + t.miss);
  const far = t.fa / Math.max(1, t.hit + t.fa);
  const csi = t.hit / Math.max(1, t.hit + t.miss + t.fa);
  const p = (x: number) => `${(x * 100).toFixed(0).padStart(3)}%`;
  return `POD ${p(pod)}  FAR ${p(far)}  CSI ${p(csi)}  (n=${t.hit + t.miss + t.fa + t.cn}, obs=${t.hit + t.miss})`;
}

console.log("Loading frames…");
const frames = await loadFrames();
const pins: { lat: number; lon: number }[] = [];
for (let lat = 49.3; lat <= 54.7; lat += 0.45) {
  for (let lon = 14.5; lon <= 23.9; lon += 0.7)
    pins.push({ lat: +lat.toFixed(2), lon: +lon.toFixed(2) });
}

for (const thr of [1, 2] as const) {
  const nowcast = new Map(LEADS.map((l) => [l, mk()]));
  const persist = new Map(LEADS.map((l) => [l, mk()]));
  const alert = mk();
  const etaErr: number[] = [];
  let cases = 0;
  let advected = 0;
  let ms = 0;
  for (let i = 3; i + 6 < frames.length; i++) {
    const hist = frames.slice(i - 3, i + 1);
    const now = frames[i]!;
    for (const pin of pins) {
      const t0 = Date.now();
      const th = computeThreat({ lat: pin.lat, lon: pin.lon, label: "pin" }, hist, [], 40, ORIGIN);
      ms += Date.now() - t0;
      cases++;
      if (th.timelineAdvected) advected++;
      if (th.nearestKm === null) continue; // nothing within 100 km — trivially dry
      let firstObs: number | null = null;
      for (const lead of LEADS) {
        const obs = obsLevel(frames[i + lead / 10]!.samples, pin.lat, pin.lon) >= thr;
        if (obs && firstObs === null) firstObs = lead;
        score(nowcast.get(lead)!, th.timeline.find((p) => p.t === lead)!.level >= thr, obs);
        score(persist.get(lead)!, th.pinLevel >= thr, obs);
      }
      if (th.pinLevel < thr) {
        const ev = evaluateAlert(
          th,
          { ...DEFAULT_ALERT_SETTINGS, enabled: true, leadMin: 60, minLevel: thr, minChancePct: 0 },
          EMPTY_ALERT_MEMORY,
          now.time * 1000,
          { placeLabel: "pin", radarTime: now.time },
        );
        const pred = ev.event?.kind === "incoming";
        score(alert, pred, firstObs !== null);
        if (pred && firstObs !== null && ev.event?.etaMin != null)
          etaErr.push(ev.event.etaMin - firstObs);
      }
    }
  }
  console.log(
    `\n=== level ≥ ${thr} (${thr === 1 ? "any rain" : "≥ 1 mm/h"}), pins with echo ≤ 100 km ===`,
  );
  for (const lead of LEADS) {
    console.log(`+${String(lead).padStart(2)} min  nowcast  ${fmt(nowcast.get(lead)!)}`);
    console.log(`         persist  ${fmt(persist.get(lead)!)}`);
  }
  console.log(`ALERT dry now → level ≥ ${thr} within 60 min: evaluateAlert()  ${fmt(alert)}`);
  if (etaErr.length) {
    etaErr.sort((a, b) => a - b);
    const q = (f: number) => etaErr[Math.floor(etaErr.length * f)];
    console.log(`  ETA − first observed (min): median ${q(0.5)}, p10 ${q(0.1)}, p90 ${q(0.9)}`);
  }
  console.log(
    `  ${cases} cases, motion vector in ${((100 * advected) / cases).toFixed(0)} %, computeThreat ${(ms / cases).toFixed(0)} ms avg`,
  );
}
