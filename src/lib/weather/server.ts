import { createServerFn } from "@tanstack/react-start";
import { PNG } from "pngjs";
import { z } from "zod";
import { lonLatToTile, tilePixelToLonLat } from "./geo";
import { ANALYSIS_COLOR_OPTIONS, dbzFromRgba, rateFromDbz } from "./palette";
import {
  LruCache,
  NOMINATIM_CACHE_MAX,
  NOMINATIM_CACHE_TTL_MS,
  NOMINATIM_MIN_GAP_MS,
  NOMINATIM_UA,
  RequestThrottle,
} from "./nominatim";
import { fetchPerunPolska, type FetchText, type LightningScan } from "./perun";
import { aggregate, inPolandRadar, maxLevelOf, PL_RADAR_BBOX, type RawHit } from "./radar-grid";
import { resolveAnalysis, type RainViewerMaps, type SampledFrame } from "./radar-source";
import { loadSnapshot } from "./snapshot";
import {
  hitsFromSriGrid,
  parseSriListing,
  SRI_DATASTORE_PATH,
  SRI_HISTORY_FRAMES,
  SRI_LIST_URL,
  sriFileUrl,
} from "./sri";
import { applyTerytFallback } from "./teryt";
import type { OfficialWarning, Place, RadarFrameMeta, Snapshot } from "./types";

export { PL_RADAR_BBOX, PL_RADAR_ORIGIN } from "./radar-grid";

const UA = NOMINATIM_UA;

const mapsCache: { at: number; data: RainViewerMaps | null } = { at: 0, data: null };
const warningCache: { at: number; data: OfficialWarning[] | null } = { at: 0, data: null };
const lightningCache: { at: number; data: LightningScan | null } = { at: 0, data: null };
const placeCache = new LruCache<Place>(NOMINATIM_CACHE_MAX);
const nominatimGate = new RequestThrottle(NOMINATIM_MIN_GAP_MS);

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

async function fetchText(
  url: string,
  init: RequestInit = {},
  timeoutMs = 12_000,
): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "User-Agent": UA, ...init.headers },
    });
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return await res.text();
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

const fetchPerunText: FetchText = async (url, init) => {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(url, {
      ...init,
      redirect: "follow",
      signal: ctrl.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/plain, text/csv, text/html, */*",
        ...(init?.headers ?? {}),
      },
    });
    return {
      url,
      status: res.status,
      contentType: res.headers.get("content-type") ?? "",
      body: await res.text(),
    };
  } finally {
    clearTimeout(t);
  }
};

async function getPerunStrikes(): Promise<LightningScan> {
  const now = Date.now();
  if (lightningCache.data && now - lightningCache.at < 60_000) return lightningCache.data;
  const data = await fetchPerunPolska(now, fetchPerunText);
  lightningCache.data = data;
  lightningCache.at = now;
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
  const city = json.address?.city || json.address?.town || json.address?.village || json.name;
  const county = json.address?.county || json.address?.municipality;
  const state = json.address?.state;
  const terc = normalizeTerc(json.extratags?.["teryt:terc"]);
  const label = city || county || json.display_name?.split(",")[0] || "Wybrany punkt";
  const place = await applyTerytFallback({ lat, lon, label, city, county, state, terc });
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
  return Promise.all(
    json.map((item) => {
      const lat = Number(item.lat);
      const lon = Number(item.lon);
      const city = item.address?.city || item.address?.town || item.address?.village || item.name;
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
    }),
  );
}

/**
 * RainViewer fallback tiles: zoom 6 → ~1.5 km/px; stride 2 → ~3 km samples.
 * Overlay still uses these URLs even when analysis is SRI.
 */
const RADAR_ZOOM = 6;
const PIXEL_STRIDE = 2;
const MAX_RADAR_TILES = 24;
const FRAME_CACHE_MAX = 12;

const sriListCache: { at: number; html: string | null } = { at: 0, html: null };

/** Decoded frames keyed by scan timestamp — frames never change once published. */
const frameCache = new Map<number, SampledFrame>();
const frameInFlight = new Map<number, Promise<SampledFrame>>();

let radarScanCache: { key: string; at: number; scan: Awaited<ReturnType<typeof resolveAnalysis>>["scan"] } | null =
  null;

function rememberFrame(decoded: SampledFrame) {
  if (!decoded.complete) return;
  frameCache.set(decoded.time, decoded);
  while (frameCache.size > FRAME_CACHE_MAX) {
    const oldest = frameCache.keys().next().value;
    if (oldest === undefined) break;
    frameCache.delete(oldest);
  }
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

async function decodeFrame(host: string, frame: RadarFrameMeta): Promise<SampledFrame> {
  const z = RADAR_ZOOM;
  const tiles = tilesForPoland(z);
  const hits: RawHit[] = [];
  let tilesOk = 0;
  await Promise.all(
    tiles.map(async (tile) => {
      // color scheme 2 (Universal Blue), smooth=0, snow=0 → exact palette colours.
      const url = `${host}${frame.path}/256/${z}/${tile.x}/${tile.y}/${ANALYSIS_COLOR_OPTIONS}.png`;
      try {
        const buf = await fetchBuf(url);
        const png = PNG.sync.read(buf);
        for (let py = 0; py < png.height; py += PIXEL_STRIDE) {
          for (let px = 0; px < png.width; px += PIXEL_STRIDE) {
            const idx = (png.width * py + px) << 2;
            const dbz = dbzFromRgba(
              png.data[idx] ?? 0,
              png.data[idx + 1] ?? 0,
              png.data[idx + 2] ?? 0,
              png.data[idx + 3] ?? 0,
            );
            if (dbz === null) continue;
            const ll = tilePixelToLonLat(z, tile.x, tile.y, px, py, png.width);
            if (!inPolandRadar(ll.lat, ll.lon)) continue;
            hits.push({ lat: ll.lat, lon: ll.lon, rate: rateFromDbz(dbz) });
          }
        }
        tilesOk++;
      } catch {
        // missing tile: frame stays "incomplete" and is not cached
      }
    }),
  );
  const { samples, cellKm } = aggregate(hits);
  return {
    time: frame.time,
    samples,
    maxLevel: maxLevelOf(samples),
    nearestKm: null,
    cellKm,
    complete: tilesOk === tiles.length,
  };
}

function sampleCached(key: number, load: () => Promise<SampledFrame>): Promise<SampledFrame> {
  const hit = frameCache.get(key);
  if (hit) return Promise.resolve(hit);
  const pending = frameInFlight.get(key);
  if (pending) return pending;
  const job = load()
    .then((decoded) => {
      rememberFrame(decoded);
      return decoded;
    })
    .finally(() => frameInFlight.delete(key));
  frameInFlight.set(key, job);
  return job;
}

function sampleFrame(host: string, frame: RadarFrameMeta): Promise<SampledFrame> {
  return sampleCached(frame.time, () => decodeFrame(host, frame));
}

async function listSriHtml(): Promise<string> {
  const now = Date.now();
  if (sriListCache.html && now - sriListCache.at < 45_000) return sriListCache.html;
  const html = await fetchText(SRI_LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body: `path=${encodeURIComponent(SRI_DATASTORE_PATH)}`,
  });
  sriListCache.html = html;
  sriListCache.at = now;
  return html;
}

async function decodeSriFile(name: string, time: number): Promise<SampledFrame> {
  const { decodeSriH5 } = await import("./sri-h5");
  const buf = await fetchBuf(sriFileUrl(name), 15_000);
  const decoded = await decodeSriH5(new Uint8Array(buf));
  const { samples, cellKm } = aggregate(hitsFromSriGrid(decoded.data, decoded.grid));
  return {
    time,
    samples,
    maxLevel: maxLevelOf(samples),
    nearestKm: null,
    cellKm,
    complete: true,
  };
}

async function sampleSriFrames(): Promise<SampledFrame[]> {
  const files = parseSriListing(await listSriHtml()).slice(-SRI_HISTORY_FRAMES);
  if (files.length === 0) throw new Error("SRI listing empty");
  const sampled = await Promise.all(
    files.map((file) =>
      sampleCached(file.time, () => decodeSriFile(file.name, file.time)).catch(() => null),
    ),
  );
  const ok = sampled.filter((f): f is SampledFrame => f != null);
  if (ok.length === 0) throw new Error("SRI frames failed to decode");
  return ok;
}

async function loadRainViewerFrames(maps: RainViewerMaps): Promise<SampledFrame[]> {
  const take = (maps.radar.past ?? []).slice(-4);
  if (take.length === 0) return [];
  return Promise.all(take.map((frame) => sampleFrame(maps.host, frame)));
}

async function sampleRadar() {
  if (radarScanCache && Date.now() - radarScanCache.at < 90_000) return radarScanCache.scan;
  const resolved = await resolveAnalysis({
    loadSri: sampleSriFrames,
    getMaps,
    loadRainViewerFrames,
  });
  radarScanCache = {
    key: `${resolved.source}:${resolved.scan.latestTime ?? 0}`,
    at: Date.now(),
    scan: resolved.scan,
  };
  return resolved.scan;
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
    const placeP = (
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
          )
    ).then(applyTerytFallback);

    return loadSnapshot(placeP, { sampleRadar, getImgwWarnings, getPerunStrikes });
  });

const searchInput = z.object({ query: z.string().min(2).max(80) });

export const searchPlaces = createServerFn({ method: "POST" })
  .validator(searchInput)
  .handler(async ({ data }) => searchNominatim(data.query));
