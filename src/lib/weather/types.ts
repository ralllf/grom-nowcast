export type ThreatLevel = "clear" | "watch" | "nearby" | "imminent" | "now";

export type RadarLevel = 0 | 1 | 2 | 3 | 4;

export type RadarSample = {
  lat: number;
  lon: number;
  level: RadarLevel;
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
  maxLevel: RadarLevel;
  nearestKm: number | null;
  echoCount: number;
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
};

export type CellTrack = {
  from: { lat: number; lon: number };
  now: { lat: number; lon: number };
  soon: { lat: number; lon: number };
  speedKmh: number;
  bearing: number;
  threatening: boolean;
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
  maxLevel: RadarLevel;
  chancePct: number;
  comingFrom: string | null;
  toward: string | null;
  willHit: boolean;
  missKm: number | null;
  expect: string | null;
  track: CellTrack | null;
  tracks: CellTrack[];
  matchedWarnings: OfficialWarning[];
};
