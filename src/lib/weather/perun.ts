import { haversineKm } from "./geo.ts";
import type { LightningStrike } from "./types.ts";

/** Last ~15 min of PERUN strikes is the live layer (Slice 5). */
export const STRIKE_WINDOW_MS = 15 * 60_000;
/** Lightning "in the cell" — cores are a few km; 20 km covers the mass without the next county. */
export const NEAR_CELL_KM = 20;

export const PERUN_NO_STRIKES = "Brak wyładowań w tej sesji";

export const PERUN_LIST_PATH = "Oper/Perun/PERUN_Polska";
export const PERUN_LIST_URL = "https://danepubliczne.imgw.pl/pl/datastore/getFilesList";
/** Same scheme that serves POLCOMP PNGs. Perun currently 307-bounces to the datastore HTML. */
export const PERUN_FILE_URL_PREFIX =
  "https://danepubliczne.imgw.pl/pl/datastore/getfiledown/Oper/Perun/PERUN_Polska/";

export type { LightningStrike };

export type LightningScan = {
  strikes: LightningStrike[];
  fetchedAt: number;
  unavailable: boolean;
  newestFile: string | null;
};

export type FetchText = (url: string, init?: RequestInit) => Promise<{
  url: string;
  status: number;
  contentType: string;
  body: string;
}>;

export function emptyLightningScan(now = Date.now(), unavailable = true): LightningScan {
  return { strikes: [], fetchedAt: now, unavailable, newestFile: null };
}

export function isHtmlBounce(body: string): boolean {
  const head = body.slice(0, 400).toLowerCase();
  return (
    head.includes("<!doctype") ||
    head.includes("<html") ||
    head.includes("<div") ||
    head.includes("katalog nie istnieje") ||
    head.includes("datastore")
  );
}

const CSV_NAME = /(\d{4}\.\d{2}\.\d{2}\.\d{2}\.\d{2}\.ld\.csv)/g;

export function listPerunCsvNames(html: string): string[] {
  const names = new Set<string>();
  for (const m of html.matchAll(CSV_NAME)) {
    if (m[1]) names.add(m[1]);
  }
  return [...names].sort();
}

/** `2026.08.31.12.51.ld.csv` → UTC ms (filename clock matches wall UTC in today's probe). */
export function csvTimeMs(name: string): number | null {
  const m = name.match(/^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})\.ld\.csv$/);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
}

function splitLine(line: string): string[] {
  const delim = line.includes(";") && line.split(";").length >= line.split(",").length ? ";" : ",";
  return line.split(delim).map((c) => c.trim());
}

function headerIndex(cells: string[], names: string[]): number {
  const lower = cells.map((c) => c.toLowerCase().replace(/^\uFEFF/, ""));
  for (const name of names) {
    const i = lower.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function parseWhen(raw: string): number | null {
  const t = raw.trim();
  if (!t || !/[-T:]/.test(t) || /^[+-]?\d+(\.\d+)?$/.test(t)) return null;
  const iso = t.includes("T") ? t : t.replace(" ", "T");
  const withZ = /Z$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withZ);
  return Number.isFinite(ms) ? ms : null;
}

function isLat(n: number) {
  return n >= 48 && n <= 56;
}
function isLon(n: number) {
  return n >= 13 && n <= 25;
}

export function parsePerunCsv(
  text: string,
  opts: { fallbackTimeMs?: number; nowMs?: number } = {},
): LightningStrike[] {
  if (!text || isHtmlBounce(text)) return [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];

  let latCol = -1;
  let lonCol = -1;
  let timeCol = -1;
  let start = 0;
  const first = splitLine(lines[0]!);
  const looksHeader = first.some((c) => /[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(c) && Number.isNaN(Number(c)));
  if (looksHeader) {
    latCol = headerIndex(first, ["lat", "latitude", "szerokosc", "szerokość", "szer"]);
    lonCol = headerIndex(first, ["lon", "lng", "longitude", "dlugosc", "długość", "dług"]);
    timeCol = headerIndex(first, ["time", "czas", "datetime", "timestamp", "data"]);
    start = 1;
  }

  const out: LightningStrike[] = [];
  const windowStart = opts.nowMs != null ? opts.nowMs - STRIKE_WINDOW_MS : null;
  for (const line of lines.slice(start)) {
    const cells = splitLine(line);
    let lat = latCol >= 0 ? Number(cells[latCol]) : NaN;
    let lon = lonCol >= 0 ? Number(cells[lonCol]) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isLat(lat) || !isLon(lon)) {
      lat = NaN;
      lon = NaN;
      for (let i = 0; i < cells.length; i++) {
        const a = Number(cells[i]);
        if (!isLat(a)) continue;
        for (let j = 0; j < cells.length; j++) {
          if (j === i) continue;
          const b = Number(cells[j]);
          if (isLon(b)) {
            lat = a;
            lon = b;
            break;
          }
        }
        if (Number.isFinite(lat)) break;
      }
    }
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    let timeMs = timeCol >= 0 ? parseWhen(cells[timeCol] ?? "") : null;
    if (timeMs == null) {
      for (const c of cells) {
        timeMs = parseWhen(c);
        if (timeMs != null) break;
      }
    }
    if (timeMs == null) timeMs = opts.fallbackTimeMs ?? null;
    if (timeMs == null) continue;
    if (windowStart != null && timeMs < windowStart) continue;
    out.push({ lat, lon, timeMs });
  }
  return out;
}

export function strikeNearCell(
  strikes: LightningStrike[],
  cell: { lat: number; lon: number },
  km = NEAR_CELL_KM,
): boolean {
  return strikes.some((s) => haversineKm(s.lat, s.lon, cell.lat, cell.lon) <= km);
}

export function strikeOpacity(ageMs: number, windowMs = STRIKE_WINDOW_MS): number {
  if (ageMs < 0) return 0.95;
  if (ageMs > windowMs) return 0;
  return 0.95 - (0.8 * ageMs) / windowMs;
}

export function lightningCaption(count: number, _unavailable: boolean): string {
  if (count === 0) return PERUN_NO_STRIKES;
  return `${count} wyładowań · 15 min`;
}

function filesInWindow(names: string[], nowMs: number): string[] {
  const start = nowMs - STRIKE_WINDOW_MS - 60_000;
  return names.filter((n) => {
    const t = csvTimeMs(n);
    return t != null && t >= start && t <= nowMs + 60_000;
  });
}

/**
 * List PERUN_Polska, then GET the newest `.ld.csv` files over the same URL
 * scheme as POLCOMP. One HTML bounce → empty scan, no invented strikes.
 */
export async function fetchPerunPolska(nowMs: number, fetchText: FetchText): Promise<LightningScan> {
  const listed = await fetchText(PERUN_LIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "text/html" },
    body: `path=${PERUN_LIST_PATH}`,
  });
  const names = listPerunCsvNames(listed.body);
  const want = filesInWindow(names, nowMs).sort().reverse();
  if (want.length === 0) return { ...emptyLightningScan(nowMs, true), newestFile: names.at(-1) ?? null };

  const strikes: LightningStrike[] = [];
  let newestFile: string | null = want[0] ?? null;
  for (const name of want.slice(0, 16)) {
    const url = `${PERUN_FILE_URL_PREFIX}${name}`;
    const res = await fetchText(url);
    if (res.status >= 300 || isHtmlBounce(res.body)) {
      return { strikes: [], fetchedAt: nowMs, unavailable: true, newestFile };
    }
    strikes.push(...parsePerunCsv(res.body, { fallbackTimeMs: csvTimeMs(name) ?? nowMs, nowMs }));
  }
  return { strikes, fetchedAt: nowMs, unavailable: false, newestFile };
}
