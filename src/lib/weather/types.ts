export type ThreatLevel = "clear" | "watch" | "nearby" | "imminent" | "now";

export type RadarLevel = 0 | 1 | 2 | 3 | 4;

export type RadarSample = {
  lat: number;
  lon: number;
  level: RadarLevel;
  /** Rain rate in mm/h (IMGW SRI, or Marshall–Palmer from RainViewer dBZ). */
  rate?: number;
};

export type RadarFrameMeta = {
  time: number;
  path: string;
};

export type RadarMemoryFrame = {
  time: number;
  samples: RadarSample[];
  maxLevel: RadarLevel;
  nearestKm: number | null;
  /** Wire form: base64, 8 bytes per sample — see pack.ts. `samples` is then empty. */
  packed?: string;
  /** True when at least one Poland-domain tile failed to fetch. */
  degraded?: boolean;
};

export type RadarScan = {
  host: string;
  generated: number;
  latestTime: number | null;
  past: RadarFrameMeta[];
  nowcast: RadarFrameMeta[];
  samples: RadarSample[];
  prevSamples: RadarSample[];
  prevTime: number | null;
  /** Oldest → newest sampled frames (up to 4) used for motion. */
  history: RadarMemoryFrame[];
  /** Approximate sample spacing in km after grid aggregation. */
  cellKm: number;
  maxLevel: RadarLevel;
  nearestKm: number | null;
  echoCount: number;
  /** Analysis decoder. Overlay tiles stay RainViewer either way. */
  analysisSource?: "sri" | "rainviewer";
};

export type Place = {
  lat: number;
  lon: number;
  label: string;
  city?: string;
  county?: string;
  state?: string;
  terc?: string;
};

export type OfficialWarning = {
  id: string;
  event: string;
  degree: number;
  probability: number | null;
  from: string;
  to: string;
  published: string;
  body: string;
  office: string;
  teryt: string[];
  matchesPlace: boolean;
  stormRelated: boolean;
};

export type Snapshot = {
  fetchedAt: number;
  place: Place;
  radar: RadarScan;
  warnings: OfficialWarning[];
  stormWarningCount: number;
  /** True when the IMGW warnings API failed; radar may still be fresh. */
  warningsUnavailable: boolean;
  /** True when analysis radar failed; do not treat the empty scan as "Czysto". */
  radarUnavailable: boolean;
};

export type CellTrack = {
  from: { lat: number; lon: number };
  now: { lat: number; lon: number };
  soon: { lat: number; lon: number };
  speedKmh: number;
  bearing: number;
  threatening: boolean;
  /** 0–100 motion confidence; glyphs only drawn when high enough. */
  confidence: number;
};

/** One step of the pin rain timeline (advection nowcast, MeteoSwiss-style strip). */
export type TimelinePoint = {
  /** Minutes from the latest radar scan. */
  t: number;
  level: RadarLevel;
  /** mm/h */
  rate: number;
};

export type Threat = {
  level: ThreatLevel;
  title: string;
  detail: string;
  etaMin: number | null;
  approaching: boolean;
  receding: boolean;
  speedKmh: number | null;
  nearestKm: number | null;
  /** Strongest echo within 25 km — context, not "over you". */
  maxLevel: RadarLevel;
  /** Strongest echo over the pin itself (within OVER_KM). */
  pinLevel: RadarLevel;
  /** Intensity the pin should brace for: over-pin level, or the incoming cell's core level. */
  cellLevel: RadarLevel;
  chancePct: number;
  comingFrom: string | null;
  toward: string | null;
  willHit: boolean;
  missKm: number | null;
  expect: string | null;
  track: CellTrack | null;
  tracks: CellTrack[];
  matchedWarnings: OfficialWarning[];
  /** 0–90 min rain at the pin, 5-min steps. Empty when there is no radar. */
  timeline: TimelinePoint[];
  /** Whether the timeline uses a measured motion vector (else persistence). */
  timelineAdvected: boolean;
};
