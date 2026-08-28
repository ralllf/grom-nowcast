import { createServerFn } from "@tanstack/react-start";
import { PNG } from "pngjs";
import { z } from "zod";
import { bboxForRadius, haversineKm, lonLatToTile, tilePixelToLonLat } from "./geo";
import type {
  OfficialWarning,
  Place,
  RadarFrameMeta,
  RadarLevel,
  RadarSample,
  RadarScan,
  Snapshot,
} from "./types";

const UA = "GROM/0.1 (storm nowcast mvp)";

const mapsCache: { at: number; data: RainViewerMaps | null } = { at: 0, data: null };
const warningCache: { at: number; data: OfficialWarning[] | null } = { at: 0, data: null };
const placeCache = new Map<string, { at: number; place: Place }>();

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

function rgbaToLevel(r: number, g: number, b: number, a: number): RadarLevel {
  if (a < 40) return 0;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (max < 30 && sat < 0.15) return 0;
  if (r > 170 && b > 150 && g < 120) return 4;
  if (r > 190 && g < 110) return 4;
  if (r > 180 && g > 140 && b < 90) return 3;
  if (g > 150 && r < 160 && b < 140) return 3;
  if (g > 120 && b < 180) return 2;
  if (b > 90) return 1;
  return 1;
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
  const hit = placeCache.get(key);
  if (hit && Date.now() - hit.at < 60 * 60_000) return { ...hit.place, lat, lon };

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
  const place: Place = { lat, lon, label, city, county, state, terc };
  placeCache.set(key, { at: Date.now(), place });
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
    return {
      lat,
      lon,
      label: city || item.display_name.split(",")[0] || q,
      city,
      county,
      state,
      terc,
    };
  });
}

function warningMatches(w: OfficialWarning, place: Place): boolean {
  if (place.terc && w.teryt.includes(place.terc)) return true;
  return false;
}

/** Neighborhood of the pin — including across the German/Czech border (Zgorzelec). */
const SAMPLE_KM = 110;
const LOCAL_MAX_KM = 25;

function tilesFor(lat: number, lon: number, z: number) {
  const set = new Map<string, { x: number; y: number }>();
  const box = bboxForRadius(lat, lon, SAMPLE_KM);
  const a = lonLatToTile(box.minLon, box.maxLat, z);
  const b = lonLatToTile(box.maxLon, box.minLat, z);
  for (let x = Math.min(a.x, b.x); x <= Math.max(a.x, b.x); x++) {
    for (let y = Math.min(a.y, b.y); y <= Math.max(a.y, b.y); y++) {
      set.set(`${x},${y}`, { x, y });
    }
  }
  return [...set.values()].slice(0, 9);
}

async function sampleFrame(
  lat: number,
  lon: number,
  host: string,
  frame: RadarFrameMeta,
): Promise<{ samples: RadarSample[]; maxLevel: RadarLevel; nearestKm: number | null }> {
  const z = 5;
  const tiles = tilesFor(lat, lon, z);
  const samples: RadarSample[] = [];
  await Promise.all(
    tiles.map(async (tile) => {
      const url = `${host}${frame.path}/256/${z}/${tile.x}/${tile.y}/2/1_1.png`;
      try {
        const buf = await fetchBuf(url);
        const png = PNG.sync.read(buf);
        const stride = 4;
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
            if (haversineKm(lat, lon, ll.lat, ll.lon) > SAMPLE_KM) continue;
            samples.push({ lat: ll.lat, lon: ll.lon, level });
          }
        }
      } catch {
        // missing tile is fine
      }
    }),
  );
  samples.sort((s, t) => {
    const ds = haversineKm(lat, lon, s.lat, s.lon);
    const dt = haversineKm(lat, lon, t.lat, t.lon);
    return t.level - s.level || ds - dt;
  });

  let nearestKm: number | null = null;
  let maxLevel: RadarLevel = 0;
  for (const s of samples) {
    const d = haversineKm(lat, lon, s.lat, s.lon);
    if (nearestKm === null || d < nearestKm) nearestKm = d;
    if (d <= LOCAL_MAX_KM && s.level > maxLevel) maxLevel = s.level;
  }
  return { samples: samples.slice(0, 400), maxLevel, nearestKm };
}

async function sampleRadar(lat: number, lon: number): Promise<RadarScan> {
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

  const sampled = await Promise.all(
    take.map(async (frame) => {
      const part = await sampleFrame(lat, lon, maps.host, frame);
      return {
        time: frame.time,
        samples: part.samples,
        maxLevel: part.maxLevel,
        nearestKm: part.nearestKm,
      };
    }),
  );
  const now = sampled.at(-1);
  const before = sampled.length >= 2 ? sampled.at(-2) : undefined;
  if (!now) return empty;

  return {
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
    const [radar, warnings, place] = await Promise.all([
      sampleRadar(data.lat, data.lon),
      getImgwWarnings(),
      data.place && data.place.terc
        ? Promise.resolve({ ...data.place, lat: data.lat, lon: data.lon })
        : reversePlace(data.lat, data.lon).catch(() => ({
            lat: data.lat,
            lon: data.lon,
            label: data.place?.label ?? "Wybrany punkt",
            terc: data.place?.terc,
            city: data.place?.city,
            county: data.place?.county,
            state: data.place?.state,
          })),
    ]);

    const tagged = warnings.map((w) => ({
      ...w,
      matchesPlace: warningMatches(w, place),
    }));

    const matched = tagged.filter((w) => w.matchesPlace);
    const nationalStorms = tagged.filter((w) => w.stormRelated && !w.matchesPlace);

    return {
      fetchedAt: Date.now(),
      place,
      radar,
      warnings: matched.length > 0 ? matched : nationalStorms.slice(0, 6),
      stormWarningCount: tagged.filter((w) => w.stormRelated).length,
    };
  });

const searchInput = z.object({ query: z.string().min(2).max(80) });

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(searchInput)
  .handler(async ({ data }) => searchNominatim(data.query));
