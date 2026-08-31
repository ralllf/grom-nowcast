/**
 * Hindcast: score GROM's nowcast and alert engine against what the radar actually did.
 *
 *   npm run hindcast                 # last 2 h of frames, human report
 *   npm run hindcast -- --cached     # re-score frames cached in the OS temp dir
 *   npm run --silent hindcast -- --json          # one comparable JSON summary on stdout
 *   npm run --silent hindcast -- --json --cached
 *
 * Downloads RainViewer frames for Poland (~117 tile requests, paced for the 100 req/min
 * limit), decodes them exactly like the server does, then for a lattice of pins runs
 * computeThreat on frames t−30…t and compares the 0–60 min timeline and evaluateAlert()
 * with the frames that followed. Reports POD / FAR / CSI per lead time against a
 * persistence baseline — for both shipped alert defaults and the research config.
 * Frames are cached in the OS temp dir, never in the repo.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG } from "pngjs";
import { lonLatToTile, tilePixelToLonLat } from "../src/lib/weather/geo.ts";
import {
  HINDCAST_LEADS,
  HINDCAST_ORIGIN,
  fmtEta,
  fmtSkill,
  scoreHindcast,
  wantsJson,
} from "../src/lib/weather/hindcast-summary.ts";
import { dbzFromRgba, levelFromRate, rateFromDbz } from "../src/lib/weather/palette.ts";
import type { RadarLevel, RadarMemoryFrame, RadarSample } from "../src/lib/weather/types.ts";

const BBOX = { minLat: 48.8, maxLat: 55.15, minLon: 13.8, maxLon: 24.6 };
const CACHE = join(tmpdir(), "grom-hindcast-frames.json");
const json = wantsJson(process.argv);

type FrameCache = { downloadedAtMs: number; frames: RadarMemoryFrame[] };

function log(msg: string) {
  (json ? console.error : console.log)(msg);
}

function readCache(): { frames: RadarMemoryFrame[]; downloadedAtMs: number | null } {
  const raw = JSON.parse(readFileSync(CACHE, "utf8")) as FrameCache | RadarMemoryFrame[];
  if (Array.isArray(raw)) return { frames: raw, downloadedAtMs: null };
  if (raw && Array.isArray(raw.frames)) {
    return { frames: raw.frames, downloadedAtMs: raw.downloadedAtMs ?? null };
  }
  throw new Error(`unreadable hindcast cache at ${CACHE}`);
}

async function loadFrames(): Promise<{ frames: RadarMemoryFrame[]; downloadedAtMs: number | null }> {
  if (existsSync(CACHE) && process.argv.includes("--cached")) {
    return readCache();
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
        log("  …pausing 62 s for the RainViewer rate limit");
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
    log(`  ${new Date(frame.time * 1000).toISOString().slice(11, 16)}Z  ${samples.length} samples`);
  }
  const downloadedAtMs = Date.now();
  writeFileSync(CACHE, JSON.stringify({ downloadedAtMs, frames: out } satisfies FrameCache));
  return { frames: out, downloadedAtMs };
}

function printHuman(summary: ReturnType<typeof scoreHindcast>) {
  const pct = (x: number) => `${x.toFixed(0)}%`;
  console.log(
    `\nRadar ${summary.radar.from.slice(11, 16)}–${summary.radar.to.slice(11, 16)}Z  ${summary.radar.frames} frames  age ${summary.radar.latestAgeSec ?? "?"} s  cellKm ${summary.cellKm.join(",")}  samples ${summary.sampleCount.min}–${summary.sampleCount.max}`,
  );
  console.log(
    `Motion (echo ≤ 100 km): advected ${pct(summary.motion.advectedPct)}  persist ${pct(summary.motion.persistPct)}  crude-ETA ${pct(summary.motion.crudeEtaPct)}  (echo=${summary.motion.echoCases}, all=${summary.motion.allCases})`,
  );

  for (const thr of ["1", "2"] as const) {
    console.log(
      `\n=== level ≥ ${thr} (${thr === "1" ? "any rain" : "≥ 1 mm/h"}), pins with echo ≤ 100 km ===`,
    );
    for (const lead of HINDCAST_LEADS) {
      const key = String(lead);
      console.log(`+${String(lead).padStart(2)} min  nowcast  ${fmtSkill(summary.nowcast[thr]![key]!)}`);
      console.log(`         persist  ${fmtSkill(summary.persist[thr]![key]!)}`);
    }
    const a = summary.alerts.research.byThreshold[thr]!;
    console.log(
      `ALERT research (leadMin ${summary.alerts.research.leadMin}, minChancePct ${summary.alerts.research.minChancePct}) dry now → ≥ ${thr} within 60 min:  ${fmtSkill(a.skill)}`,
    );
    console.log(`  ETA − first observed (min): ${fmtEta(a.etaBiasMin)}`);
  }

  const s = summary.alerts.shipped;
  console.log(
    `\n=== shipped defaults (leadMin ${s.leadMin}, minLevel ${s.minLevel}, minChancePct ${s.minChancePct}) ===`,
  );
  console.log(`ALERT dry now → ≥ ${s.minLevel} within ${s.leadMin} min:  ${fmtSkill(s.skill)}`);
  console.log(`  ETA − first observed (min): ${fmtEta(s.etaBiasMin)}`);

  console.log(`\n=== Szansa calibration (chancePct vs rain ≥ 1 at pin within 60 min) ===`);
  console.log("bucket   n   mean%  observed%");
  for (const row of summary.szansa) {
    if (row.n === 0) continue;
    console.log(
      `${row.bucket.padEnd(8)}${String(row.n).padStart(4)}  ${row.meanChancePct.toFixed(0).padStart(5)}  ${(row.observedRate * 100).toFixed(0).padStart(8)}`,
    );
  }
}

log("Loading frames…");
const { frames, downloadedAtMs } = await loadFrames();
const pins: { lat: number; lon: number }[] = [];
for (let lat = 49.3; lat <= 54.7; lat += 0.45) {
  for (let lon = 14.5; lon <= 23.9; lon += 0.7)
    pins.push({ lat: +lat.toFixed(2), lon: +lon.toFixed(2) });
}

const summary = scoreHindcast({ frames, pins, origin: HINDCAST_ORIGIN, downloadedAtMs });
if (json) console.log(JSON.stringify(summary, null, 2));
else printHuman(summary);
