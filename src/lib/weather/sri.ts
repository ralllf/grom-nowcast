import { aeqdForward, aeqdInverse, SRI_LAT0, SRI_LON0, SRI_R } from "./aeqd.ts";
import { inPolandRadar, type RawHit } from "./radar-grid.ts";

/** Datastore directory — do not use the lagging `/api/data/product` mirror. */
export const SRI_DATASTORE_PATH = "Oper/Polrad/Produkty/POLCOMP/COMPO_SRI.comp.sri";
export const SRI_LIST_URL = "https://danepubliczne.imgw.pl/pl/datastore/getFilesList";
export const SRI_FILE_BASE = `https://danepubliczne.imgw.pl/pl/datastore/getfiledown/${SRI_DATASTORE_PATH}`;

export const SRI_CADENCE_SEC = 5 * 60;
export const SRI_HISTORY_FRAMES = 7;

/**
 * Live COMPO_SRI `where` attrs (probed 2026-08-31). 800×800, not the 900×900
 * that older notes assumed. File `xscale`/`yscale` are nominal arc lengths;
 * plane pixel size comes from ODIM UL/LR corners at decode.
 */
export type SriGrid = {
  nx: number;
  ny: number;
  xscale: number;
  yscale: number;
  /** Outer UL corner in aeqd metres (ODIM convention). */
  x0: number;
  y0: number;
  lat0: number;
  lon0: number;
  radiusM: number;
  nodata: number;
  undetect: number;
  gain: number;
  offset: number;
};

const ATTR_XSCALE = 1163.641987013176;
const ATTR_YSCALE = 1153.6468207035664;

export const POLCOMP_SRI_GRID: SriGrid = {
  nx: 800,
  ny: 800,
  xscale: ATTR_XSCALE,
  yscale: ATTR_YSCALE,
  x0: -(800 / 2) * ATTR_XSCALE,
  y0: (800 / 2) * ATTR_YSCALE,
  lat0: SRI_LAT0,
  lon0: SRI_LON0,
  radiusM: SRI_R,
  nodata: -2,
  undetect: -1,
  gain: 1,
  offset: 0,
};

/** Plane pixel size and UL origin from ODIM outer-corner lon/lat. */
export function sriGeorefFromCorners(
  ulLon: number,
  ulLat: number,
  lrLon: number,
  lrLat: number,
  nx: number,
  ny: number,
  lat0 = SRI_LAT0,
  lon0 = SRI_LON0,
  radiusM = SRI_R,
): { xscale: number; yscale: number; x0: number; y0: number } {
  const ul = aeqdForward(ulLat, ulLon, lat0, lon0, radiusM);
  const lr = aeqdForward(lrLat, lrLon, lat0, lon0, radiusM);
  return {
    xscale: (lr.x - ul.x) / nx,
    yscale: (ul.y - lr.y) / ny,
    x0: ul.x,
    y0: ul.y,
  };
}

const H5_NAME = /^(\d{8})(\d{6})00dBR\.sri\.h5$/;
const H5_IN_HTML = /(\d{16}dBR\.sri\.h5)/g;

export type SriFile = { name: string; time: number };

export function sriFilenameTime(name: string): number | null {
  const m = H5_NAME.exec(name);
  if (!m) return null;
  const ymd = m[1]!;
  const hms = m[2]!;
  const t = Date.UTC(
    Number(ymd.slice(0, 4)),
    Number(ymd.slice(4, 6)) - 1,
    Number(ymd.slice(6, 8)),
    Number(hms.slice(0, 2)),
    Number(hms.slice(2, 4)),
    Number(hms.slice(4, 6)),
  );
  return t / 1000;
}

export function sriFileUrl(name: string): string {
  return `${SRI_FILE_BASE}/${name}`;
}

/** Parse the HTML listing from POST datastore/getFilesList. Oldest → newest. */
export function parseSriListing(html: string): SriFile[] {
  const seen = new Set<string>();
  const files: SriFile[] = [];
  for (const m of html.matchAll(H5_IN_HTML)) {
    const name = m[1]!;
    if (seen.has(name)) continue;
    const time = sriFilenameTime(name);
    if (time == null) continue;
    seen.add(name);
    files.push({ name, time });
  }
  files.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
  return files;
}

/** Pixel centre in aeqd metres → lon/lat. Row 0 is north (ODIM cartesian). */
export function sriPixelToLonLat(
  col: number,
  row: number,
  grid: SriGrid = POLCOMP_SRI_GRID,
): { lat: number; lon: number } {
  const x = grid.x0 + (col + 0.5) * grid.xscale;
  const y = grid.y0 - (row + 0.5) * grid.yscale;
  return aeqdInverse(x, y, grid.lat0, grid.lon0, grid.radiusM);
}

const RATE_MIN = 0.1;

export function hitsFromSriGrid(data: ArrayLike<number>, grid: SriGrid): RawHit[] {
  const hits: RawHit[] = [];
  const n = grid.nx * grid.ny;
  for (let i = 0; i < n; i++) {
    const raw = Number(data[i]);
    if (!Number.isFinite(raw) || raw === grid.nodata || raw === grid.undetect) continue;
    const rate = raw * grid.gain + grid.offset;
    if (rate < RATE_MIN) continue;
    const col = i % grid.nx;
    const row = (i - col) / grid.nx;
    const ll = sriPixelToLonLat(col, row, grid);
    if (!inPolandRadar(ll.lat, ll.lon)) continue;
    hits.push({ lat: ll.lat, lon: ll.lon, rate });
  }
  return hits;
}
