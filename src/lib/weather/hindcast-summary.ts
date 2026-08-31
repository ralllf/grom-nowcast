/**
 * Hindcast scoring + comparable JSON summary (Slice 0).
 * Does not change nowcast math — it only measures what computeThreat / evaluateAlert already do.
 */
import {
  DEFAULT_ALERT_SETTINGS,
  EMPTY_ALERT_MEMORY,
  evaluateAlert,
  type AlertSettings,
} from "./alerts.ts";
import { haversineKm } from "./geo.ts";
import { computeThreat } from "./threat.ts";
import type { RadarLevel, RadarMemoryFrame } from "./types.ts";

export const HINDCAST_LEADS = [10, 20, 30, 40, 50, 60] as const;
export const HINDCAST_ORIGIN = { lat: 52.1, lon: 19.35 };
/** Same 9 000-sample coarsen rule as server.ts `aggregate()` — logged, not applied here. */
export const MAX_RADAR_SAMPLES = 9_000;

export const RESEARCH_ALERT_CONFIG = {
  name: "research" as const,
  leadMin: 60,
  minChancePct: 0,
};

export const SHIPPED_ALERT_CONFIG = {
  name: "shipped" as const,
  leadMin: 30,
  minLevel: 2 as const,
  minChancePct: 50,
};

export type SkillCounts = { hit: number; miss: number; fa: number; cn: number };
export type SkillRates = SkillCounts & {
  pod: number;
  far: number;
  csi: number;
  n: number;
  obs: number;
};

export type Percentiles = { n: number; p10: number; p50: number; p90: number };

export type SzansaRow = {
  bucket: string;
  lo: number;
  hi: number;
  n: number;
  meanChancePct: number;
  observedRate: number;
};

export type AlertSkill = {
  skill: SkillRates;
  etaBiasMin: Percentiles | null;
};

export type HindcastSummary = {
  date: string;
  runAt: string;
  radar: {
    from: string;
    to: string;
    frames: number;
    latestAgeSec: number | null;
  };
  cellKm: number[];
  sampleCount: { min: number; max: number };
  motion: {
    allCases: number;
    echoCases: number;
    advectedPct: number;
    persistPct: number;
    crudeEtaPct: number;
  };
  nowcast: Record<string, Record<string, SkillRates>>;
  persist: Record<string, Record<string, SkillRates>>;
  alerts: {
    research: {
      leadMin: number;
      minChancePct: number;
      byThreshold: Record<string, AlertSkill>;
    };
    shipped: {
      leadMin: number;
      minLevel: number;
      minChancePct: number;
    } & AlertSkill;
  };
  szansa: SzansaRow[];
};

const SZANSA_EDGES: { lo: number; hi: number; label: string }[] = [
  { lo: 0, hi: 19, label: "0-19" },
  { lo: 20, hi: 29, label: "20-29" },
  { lo: 30, hi: 39, label: "30-39" },
  { lo: 40, hi: 49, label: "40-49" },
  { lo: 50, hi: 59, label: "50-59" },
  { lo: 60, hi: 69, label: "60-69" },
  { lo: 70, hi: 79, label: "70-79" },
  { lo: 80, hi: 89, label: "80-89" },
  { lo: 90, hi: 100, label: "90-100" },
];

export function wantsJson(argv: string[]): boolean {
  return argv.includes("--json");
}

export function mk(): SkillCounts {
  return { hit: 0, miss: 0, fa: 0, cn: 0 };
}

export function score(t: SkillCounts, pred: boolean, obs: boolean) {
  if (pred && obs) t.hit++;
  else if (!pred && obs) t.miss++;
  else if (pred && !obs) t.fa++;
  else t.cn++;
}

export function rates(t: SkillCounts): SkillRates {
  const n = t.hit + t.miss + t.fa + t.cn;
  const obs = t.hit + t.miss;
  const pod = t.hit / Math.max(1, t.hit + t.miss);
  const far = t.fa / Math.max(1, t.hit + t.fa);
  const csi = t.hit / Math.max(1, t.hit + t.miss + t.fa);
  return { ...t, pod, far, csi, n, obs };
}

export function percentiles(sortedAsc: number[]): Percentiles | null {
  if (sortedAsc.length === 0) return null;
  const q = (f: number) => sortedAsc[Math.floor(sortedAsc.length * f)]!;
  return { n: sortedAsc.length, p10: q(0.1), p50: q(0.5), p90: q(0.9) };
}

export function szansaBucketLabel(chancePct: number): string {
  const edge = SZANSA_EDGES.find((e) => chancePct >= e.lo && chancePct <= e.hi);
  return edge?.label ?? "0-19";
}

/** What production `aggregate()` would report given a 3 km cell count. Scoring stays at 3 km. */
export function cellKmFromSampleCount(n: number): number {
  let factor = 1;
  let cells = n;
  while (cells > MAX_RADAR_SAMPLES && factor < 8) {
    factor *= 2;
    cells = Math.ceil(n / (factor * factor));
  }
  return Math.round(3 * factor * 10) / 10;
}

function iso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString();
}

function firstObsLead(
  frames: RadarMemoryFrame[],
  i: number,
  lat: number,
  lon: number,
  thr: RadarLevel,
  maxLead: number,
): number | null {
  let first: number | null = null;
  for (const lead of HINDCAST_LEADS) {
    if (lead > maxLead) break;
    if (obsLevel(frames[i + lead / 10]!.samples, lat, lon) >= thr && first === null) first = lead;
  }
  return first;
}

function obsLevel(
  samples: RadarMemoryFrame["samples"],
  lat: number,
  lon: number,
): RadarLevel {
  let m: RadarLevel = 0;
  for (const s of samples) {
    if (haversineKm(lat, lon, s.lat, s.lon) <= 8 && s.level > m) m = s.level;
  }
  return m;
}

function shippedSettings(): AlertSettings {
  return {
    ...DEFAULT_ALERT_SETTINGS,
    enabled: true,
    leadMin: SHIPPED_ALERT_CONFIG.leadMin,
    minLevel: SHIPPED_ALERT_CONFIG.minLevel,
    minChancePct: SHIPPED_ALERT_CONFIG.minChancePct,
  };
}

function researchSettings(thr: RadarLevel): AlertSettings {
  return {
    ...DEFAULT_ALERT_SETTINGS,
    enabled: true,
    leadMin: RESEARCH_ALERT_CONFIG.leadMin,
    minLevel: thr,
    minChancePct: RESEARCH_ALERT_CONFIG.minChancePct,
  };
}

export function scoreHindcast(opts: {
  frames: RadarMemoryFrame[];
  pins: { lat: number; lon: number }[];
  origin?: { lat: number; lon: number };
  nowMs?: number;
}): HindcastSummary {
  const frames = opts.frames;
  const origin = opts.origin ?? HINDCAST_ORIGIN;
  const nowMs = opts.nowMs ?? Date.now();
  const thresholds = [1, 2] as const;

  const nowcast = new Map<RadarLevel, Map<number, SkillCounts>>();
  const persist = new Map<RadarLevel, Map<number, SkillCounts>>();
  for (const thr of thresholds) {
    nowcast.set(thr, new Map(HINDCAST_LEADS.map((l) => [l, mk()])));
    persist.set(thr, new Map(HINDCAST_LEADS.map((l) => [l, mk()])));
  }
  const researchAlert = new Map<RadarLevel, SkillCounts>(thresholds.map((t) => [t, mk()]));
  const researchEta: Record<RadarLevel, number[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  const shippedAlert = mk();
  const shippedEta: number[] = [];
  const szansaAcc = new Map<string, { n: number; chanceSum: number; hits: number }>();

  let allCases = 0;
  let echoCases = 0;
  let advected = 0;
  let persistMotion = 0;
  let crudeEta = 0;

  for (let i = 3; i + 6 < frames.length; i++) {
    const hist = frames.slice(i - 3, i + 1);
    const now = frames[i]!;
    for (const pin of opts.pins) {
      const th = computeThreat(
        { lat: pin.lat, lon: pin.lon, label: "pin" },
        hist,
        [],
        40,
        origin,
      );
      allCases++;
      if (th.nearestKm === null) continue;
      echoCases++;

      if (th.timelineAdvected) advected++;
      else if (th.willHit && th.etaMin !== null && th.etaMin > 0) crudeEta++;
      else persistMotion++;

      const rainWithin60 = firstObsLead(frames, i, pin.lat, pin.lon, 1, 60) !== null;
      const bucket = szansaBucketLabel(th.chancePct);
      const acc = szansaAcc.get(bucket) ?? { n: 0, chanceSum: 0, hits: 0 };
      acc.n++;
      acc.chanceSum += th.chancePct;
      if (rainWithin60) acc.hits++;
      szansaAcc.set(bucket, acc);

      for (const thr of thresholds) {
        for (const lead of HINDCAST_LEADS) {
          const obs = obsLevel(frames[i + lead / 10]!.samples, pin.lat, pin.lon) >= thr;
          score(nowcast.get(thr)!.get(lead)!, th.timeline.find((p) => p.t === lead)!.level >= thr, obs);
          score(persist.get(thr)!.get(lead)!, th.pinLevel >= thr, obs);
        }
        if (th.pinLevel < thr) {
          const ev = evaluateAlert(
            th,
            researchSettings(thr),
            EMPTY_ALERT_MEMORY,
            now.time * 1000,
            { placeLabel: "pin", radarTime: now.time },
          );
          const pred = ev.event?.kind === "incoming";
          const first = firstObsLead(frames, i, pin.lat, pin.lon, thr, RESEARCH_ALERT_CONFIG.leadMin);
          score(researchAlert.get(thr)!, pred, first !== null);
          if (pred && first !== null && ev.event?.etaMin != null) {
            researchEta[thr]!.push(ev.event.etaMin - first);
          }
        }
      }

      if (th.pinLevel < SHIPPED_ALERT_CONFIG.minLevel) {
        const ev = evaluateAlert(th, shippedSettings(), EMPTY_ALERT_MEMORY, now.time * 1000, {
          placeLabel: "pin",
          radarTime: now.time,
        });
        const pred = ev.event?.kind === "incoming";
        const first = firstObsLead(
          frames,
          i,
          pin.lat,
          pin.lon,
          SHIPPED_ALERT_CONFIG.minLevel,
          SHIPPED_ALERT_CONFIG.leadMin,
        );
        score(shippedAlert, pred, first !== null);
        if (pred && first !== null && ev.event?.etaMin != null) {
          shippedEta.push(ev.event.etaMin - first);
        }
      }
    }
  }

  const packLeads = (m: Map<number, SkillCounts>): Record<string, SkillRates> => {
    const out: Record<string, SkillRates> = {};
    for (const lead of HINDCAST_LEADS) out[String(lead)] = rates(m.get(lead)!);
    return out;
  };

  const nowcastOut: Record<string, Record<string, SkillRates>> = {};
  const persistOut: Record<string, Record<string, SkillRates>> = {};
  const researchByThr: Record<string, AlertSkill> = {};
  for (const thr of thresholds) {
    nowcastOut[String(thr)] = packLeads(nowcast.get(thr)!);
    persistOut[String(thr)] = packLeads(persist.get(thr)!);
    const eta = researchEta[thr]!;
    eta.sort((a, b) => a - b);
    researchByThr[String(thr)] = { skill: rates(researchAlert.get(thr)!), etaBiasMin: percentiles(eta) };
  }
  shippedEta.sort((a, b) => a - b);

  const szansa: SzansaRow[] = SZANSA_EDGES.map((e) => {
    const acc = szansaAcc.get(e.label);
    return {
      bucket: e.label,
      lo: e.lo,
      hi: e.hi,
      n: acc?.n ?? 0,
      meanChancePct: acc && acc.n ? acc.chanceSum / acc.n : 0,
      observedRate: acc && acc.n ? acc.hits / acc.n : 0,
    };
  });

  const first = frames[0]!;
  const last = frames[frames.length - 1]!;
  const counts = frames.map((f) => f.samples.length);
  const cellKm = [...new Set(frames.map((f) => cellKmFromSampleCount(f.samples.length)))].sort(
    (a, b) => a - b,
  );
  const denom = Math.max(1, echoCases);

  return {
    date: iso(last.time).slice(0, 10),
    runAt: new Date(nowMs).toISOString(),
    radar: {
      from: iso(first.time),
      to: iso(last.time),
      frames: frames.length,
      latestAgeSec: Math.round(nowMs / 1000 - last.time),
    },
    cellKm,
    sampleCount: {
      min: counts.length ? Math.min(...counts) : 0,
      max: counts.length ? Math.max(...counts) : 0,
    },
    motion: {
      allCases,
      echoCases,
      advectedPct: (100 * advected) / denom,
      persistPct: (100 * persistMotion) / denom,
      crudeEtaPct: (100 * crudeEta) / denom,
    },
    nowcast: nowcastOut,
    persist: persistOut,
    alerts: {
      research: {
        leadMin: RESEARCH_ALERT_CONFIG.leadMin,
        minChancePct: RESEARCH_ALERT_CONFIG.minChancePct,
        byThreshold: researchByThr,
      },
      shipped: {
        leadMin: SHIPPED_ALERT_CONFIG.leadMin,
        minLevel: SHIPPED_ALERT_CONFIG.minLevel,
        minChancePct: SHIPPED_ALERT_CONFIG.minChancePct,
        skill: rates(shippedAlert),
        etaBiasMin: percentiles(shippedEta),
      },
    },
    szansa,
  };
}

export function fmtSkill(t: SkillRates): string {
  const p = (x: number) => `${(x * 100).toFixed(0).padStart(3)}%`;
  return `POD ${p(t.pod)}  FAR ${p(t.far)}  CSI ${p(t.csi)}  (n=${t.n}, obs=${t.obs})`;
}

export function fmtEta(p: Percentiles | null): string {
  if (!p) return "n/a (no hits)";
  return `median ${p.p50}, p10 ${p.p10}, p90 ${p.p90} (n=${p.n})`;
}
