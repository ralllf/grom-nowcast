import { createServerFn } from "@tanstack/react-start";
import { PNG } from "pngjs";
import { z } from "zod";
import { lonLatToTile, tilePixelToLonLat } from "./geo";
import { ANALYSIS_COLOR_OPTIONS, rgbaToLevel } from "./palette";
import {
  LruCache,
  NOMINATIM_CACHE_MAX,
  NOMINATIM_CACHE_TTL_MS,
  NOMINATIM_MIN_GAP_MS,
  NOMINATIM_UA,
  RequestThrottle,
} from "./nominatim";
import { capSamplesFairly } from "./sample-cap";
import { applyTerytFallback } from "./teryt";
import type {
  OfficialWarning,
  Place,
  RadarFrameMeta,
  RadarLevel,
  RadarMemoryFrame,
  RadarSample,
  RadarScan,
  Snapshot,
} from "./types";

const UA = NOMINATIM_UA;

const mapsCache: { at: number; data: RainViewerMaps | null } = { at: 0, data: null };
const warningCache: { at: number; data: OfficialWarning[] | null } = { at: 0, data: null };
const placeCache = new LruCache<Place>(NOMINATIM_CACHE_MAX);
const nominatimGate = new RequestThrottle(NOMINATIM_MIN_GAP_MS);

type RainViewerMaps = {
  version: string;
  generated: number;
  host: string;
  radar: { past: RadarFrameMeta[]; nowcast: RadarFrameMeta[] };
};

async function fetchJson<T>(url: string, timeoutMs = 12_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

async function fetchBuf(url: string, timeoutMs = 10_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(t);
  }
}

async function getMaps(): Promise<RainViewerMaps> {
  const now = Date.now();
  if (mapsCache.data && now - mapsCache.at < 45_000) return mapsCache.data;
  const data = await fetchJson<RainViewerMaps>(
    "https://api.rainviewer.com/public/weather-maps.json",
  );
  mapsCache.data = data;
  mapsCache.at = now;
  return data;
}

type ImgwWarningRaw = {
  id: string;
  nazwa_zdarzenia: string;
  stopien: string;
  prawdopodobienstwo?: string;
  obowiazuje_od: string;
  obowiazuje_do: string;
  opublikowano: string;
  tresc: string;
  biuro?: string;
  teryt?: string[];
};

function isStormEvent(name: string) {
  const n = name.toLowerCase();
  return (
    n.includes("burz") ||
    n.includes("grad") ||
    n.includes("silny deszcz") ||
    n.includes("deszcz z burz")
  );
}

async function getImgwWarnings(): Promise<OfficialWarning[]> {
  const now = Date.now();
  if (warningCache.data && now - warningCache.at < 120_000) return warningCache.data;
  const raw = await fetchJson<ImgwWarningRaw[]>(
    "https://danepubliczne.imgw.pl/api/data/warningsmeteo",
  );
  const data: OfficialWarning[] = raw.map((w) => ({
    id: w.id,
    event: w.nazwa_zdarzenia,
    degree: Number(w.stopien) || 0,
    probability: w.prawdopodobienstwo ? Number(w.prawdopodobienstwo) : null,
    from: w.obowiazuje_od,
    to: w.obowiazuje_do,
    published: w.opublikowano,
    body: w.tresc,
    office: w.biuro ?? "IMGW-PIB",
    teryt: w.teryt ?? [],
    matchesPlace: false,
    stormRelated: isStormEvent(w.nazwa_zdarzenia),
  }));
  warningCache.data = data;
  warningCache.at = now;
  return data;
}

function normalizeTerc(value?: string | null): string | undefined {
  if (!value) return undefined;
  const digits = value.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return undefined;
}

type NominatimReverse = {
  display_name?: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    municipality?: string;
  };
  extratags?: Record<string, string>;
};

export async function reversePlace(lat: number, lon: number): Promise<Place> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = placeCache.get(key, Date.now(), NOMINATIM_CACHE_TTL_MS);
  if (hit) return applyTerytFallback({ ...hit, lat, lon });

  await nominatimGate.wait();
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
    `&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1&extratags=1&accept-language=pl`;
  const json = await fetchJson<NominatimReverse>(url);
  const city =
    json.address?.city || json.address?.town || json.address?.village || json.name;
  const county = json.address?.county || json.address?.municipality;
  const state = json.address?.state;
  const terc = normalizeTerc(json.extratags?.["teryt:terc"]);
  const label = city || county || json.display_name?.split(",")[0] || "Wybrany punkt";
  const place = applyTerytFallback({ lat, lon, label, city, county, state, terc });
  placeCache.set(key, place);
  return place;
}

type NominatimSearch = {
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
  address?: NominatimReverse["address"];
  extratags?: Record<string, string>;
};

export async function searchNominatim(query: string): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  await nominatimGate.wait();
  const url =
    `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}` +
    `&countrycodes=pl&addressdetails=1&extratags=1&limit=6&accept-language=pl`;
  const json = await fetchJson<NominatimSearch[]>(url);
  return json.map((item) => {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    const city =
      item.address?.city || item.address?.town || item.address?.village || item.name;
    const county = item.address?.county;
    const state = item.address?.state;
    const terc = normalizeTerc(item.extratags?.["teryt:terc"]);
    return applyTerytFallback({
      lat,
      lon,
      label: city || item.display_name.split(",")[0] || q,
      city,
      county,
      state,
      terc,
    });
  });
}

function warningMatches(w: OfficialWarning, place: Place): boolean {
  if (place.terc && w.teryt.includes(place.terc)) return true;
  return false;
}

/** Poland + border strip — fixed radar domain (not pin-centered). */
export const PL_RADAR_BBOX = {
  minLat: 48.8,
  maxLat: 55.15,
  minLon: 13.8,
  maxLon: 24.6,
} as const;

export const PL_RADAR_ORIGIN = { lat: 52.1, lon: 19.35 };

const MAX_RADAR_TILES = 48;
const MAX_RADAR_SAMPLES = 5_000;

let radarScanCache: { key: number; at: number; scan: RadarScan } | null = null;

function inPolandRadar(lat: number, lon: number) {
  return (
    lat >= PL_RADAR_BBOX.minLat &&
    lat <= PL_RADAR_BBOX.maxLat &&
    lon >= PL_RADAR_BBOX.minLon &&
    lon <= PL_RADAR_BBOX.maxLon
  );
}

function tilesForPoland(z: number) {
  const set = new Map<string, { x: number; y: number }>();
  const a = lonLatToTile(PL_RADAR_BBOX.minLon, PL_RADAR_BBOX.maxLat, z);
  const b = lonLatToTile(PL_RADAR_BBOX.maxLon, PL_RADAR_BBOX.minLat, z);
  for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
      set.set(`${x},${y}`, { x, y });
    }
  }
  return [...set.values()].slice(0, MAX_RADAR_TILES);
}

async function sampleFrame(
  host: string,
  frame: RadarFrameMeta,
): Promise<{
  samples: RadarSample[];
  maxLevel: RadarLevel;
  nearestKm: number | null;
  degraded: boolean;
}> {
  const z = 5;
  const tiles = tilesForPoland(z);
  const samples: RadarSample[] = [];
  let tilesFailed = 0;
  await Promise.all(
    tiles.map(async (tile) => {
      const url = `${host}${frame.path}/256/${z}/${tile.x}/${tile.y}/${ANALYSIS_COLOR_OPTIONS}.png`;
      try {
        const buf = await fetchBuf(url);
        const png = PNG.sync.read(buf);
        const stride = 2;
        for (let py = 0; py < png.height; py += stride) {
          for (let px = 0; px < png.width; px += stride) {
            const idx = (png.width * py + px) << 2;
            const level = rgbaToLevel(
              png.data[idx] ?? 0,
              png.data[idx + 1] ?? 0,
              png.data[idx + 2] ?? 0,
              png.data[idx + 3] ?? 0,
            );
            if (level === 0) continue;
            const ll = tilePixelToLonLat(z, tile.x, tile.y, px, py, png.width);
            if (!inPolandRadar(ll.lat, ll.lon)) continue;
            samples.push({ lat: ll.lat, lon: ll.lon, level });
          }
        }
      } catch {
        tilesFailed += 1;
      }
    }),
  );
  const kept = capSamplesFairly(samples, MAX_RADAR_SAMPLES);

  let maxLevel: RadarLevel = 0;
  for (const s of kept) {
    if (s.level > maxLevel) maxLevel = s.level;
  }
  return { samples: kept, maxLevel, nearestKm: null, degraded: tilesFailed > 0 };
}

async function sampleRadar(): Promise<RadarScan> {
  const maps = await getMaps();
  const past = maps.radar.past ?? [];
  const nowcast = maps.radar.nowcast ?? [];
  const take = past.slice(-4);
  const latest = take.at(-1);
  const empty: RadarScan = {
    host: maps.host,
    generated: maps.generated,
    latestTime: latest?.time ?? null,
    past,
    nowcast,
    samples: [],
    prevSamples: [],
    prevTime: null,
    history: [],
    maxLevel: 0,
    nearestKm: null,
    echoCount: 0,
  };
  if (!latest) return empty;

  if (
    radarScanCache &&
    radarScanCache.key === latest.time &&
    Date.now() - radarScanCache.at < 90_000
  ) {
    return radarScanCache.scan;
  }

  const sampled = await Promise.all(
    take.map(async (frame) => {
      const part = await sampleFrame(maps.host, frame);
      const memory: RadarMemoryFrame = {
        time: frame.time,
        samples: part.samples,
        maxLevel: part.maxLevel,
        nearestKm: part.nearestKm,
        degraded: part.degraded,
      };
      return memory;
    }),
  );
  const now = sampled.at(-1);
  const before = sampled.length >= 2 ? sampled.at(-2) : undefined;
  if (!now) return empty;

  const scan: RadarScan = {
    host: maps.host,
    generated: maps.generated,
    latestTime: latest.time,
    past,
    nowcast,
    samples: now.samples,
    prevSamples: before?.samples ?? [],
    prevTime: before?.time ?? null,
    history: sampled,
    maxLevel: now.maxLevel,
    nearestKm: now.nearestKm,
    echoCount: now.samples.length,
  };
  radarScanCache = { key: latest.time, at: Date.now(), scan };
  return scan;
}

const snapshotInput = z.object({
  lat: z.number().min(48).max(56),
  lon: z.number().min(13).max(25),
  radiusKm: z.number().min(10).max(80),
  place: z
    .object({
      lat: z.number(),
      lon: z.number(),
      label: z.string(),
      city: z.string().optional(),
      county: z.string().optional(),
      state: z.string().optional(),
      terc: z.string().optional(),
    })
    .optional(),
});

export const getSnapshot = createServerFn({ method: "POST" })
  .validator(snapshotInput)
  .handler(async ({ data }): Promise<Snapshot> => {
    // Radar is always the Poland domain (pin-independent). data.place = user pin for TERYT.
    const userPlace = data.place;
    const [radar, warnings, place] = await Promise.all([
      sampleRadar(),
      getImgwWarnings(),
      userPlace?.terc
        ? Promise.resolve({ ...userPlace })
        : reversePlace(userPlace?.lat ?? data.lat, userPlace?.lon ?? data.lon).catch(() =>
            applyTerytFallback({
              lat: userPlace?.lat ?? data.lat,
              lon: userPlace?.lon ?? data.lon,
              label: userPlace?.label ?? "Wybrany punkt",
              terc: userPlace?.terc,
              city: userPlace?.city,
              county: userPlace?.county,
              state: userPlace?.state,
            }),
          ),
    ]);

    const placed = applyTerytFallback(place);
    const tagged = warnings.map((w) => ({
      ...w,
      matchesPlace: warningMatches(w, placed),
    }));

    const matched = tagged.filter((w) => w.matchesPlace);
    const storms = tagged.filter((w) => w.stormRelated);

    return {
      fetchedAt: Date.now(),
      place: placed,
      radar,
      // Enough national storms for the client to re-tag when the pin moves (radar is shared).
      warnings:
        matched.length > 0
          ? [...matched, ...storms.filter((w) => !matched.includes(w))].slice(0, 40)
          : storms.slice(0, 40),
      stormWarningCount: storms.length,
    };
  });

const searchInput = z.object({ query: z.string().min(2).max(80) });

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(searchInput)
  .handler(async ({ data }) => searchNominatim(data.query));
