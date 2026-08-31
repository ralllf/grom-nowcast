import { writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import h5wasm from "h5wasm/node";
import { SRI_LAT0, SRI_LON0, SRI_R } from "./aeqd.ts";
import { POLCOMP_SRI_GRID, type SriGrid } from "./sri.ts";

export type DecodedSri = {
  time: number;
  data: Float32Array;
  grid: SriGrid;
};

function numAttr(obj: { attrs: Record<string, { value: unknown }> }, name: string, fallback: number): number {
  const a = obj.attrs[name];
  if (!a) return fallback;
  const v = a.value;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function strAttr(obj: { attrs: Record<string, { value: unknown }> }, name: string, fallback: string): string {
  const a = obj.attrs[name];
  if (!a || a.value == null) return fallback;
  return String(a.value);
}

function parseProjOrigin(projdef: string): { lat0: number; lon0: number } {
  const lat = /lat_0=([+-]?\d+(?:\.\d+)?)/.exec(projdef);
  const lon = /lon_0=([+-]?\d+(?:\.\d+)?)/.exec(projdef);
  return {
    lat0: lat ? Number(lat[1]) : SRI_LAT0,
    lon0: lon ? Number(lon[1]) : SRI_LON0,
  };
}

function odimClock(date: string, time: string): number | null {
  const d = /^(\d{8})$/.exec(date.trim());
  const t = /^(\d{6})$/.exec(time.trim());
  if (!d || !t) return null;
  const ymd = d[1]!;
  const hms = t[1]!;
  return (
    Date.UTC(
      Number(ymd.slice(0, 4)),
      Number(ymd.slice(4, 6)) - 1,
      Number(ymd.slice(6, 8)),
      Number(hms.slice(0, 2)),
      Number(hms.slice(2, 4)),
      Number(hms.slice(4, 6)),
    ) / 1000
  );
}

let readyOnce: Promise<unknown> | null = null;

function ensureReady(): Promise<unknown> {
  readyOnce ??= h5wasm.ready;
  return readyOnce;
}

/**
 * Decode an ODIM_H5 COMPO_SRI buffer. RATE is already mm/h (gain/offset applied).
 * Writes a short-lived temp file — h5wasm's Node File reads from the real FS.
 */
export async function decodeSriH5(buf: Uint8Array): Promise<DecodedSri> {
  await ensureReady();
  const path = join(tmpdir(), `grom-sri-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.h5`);
  writeFileSync(path, buf);
  try {
    const f = new h5wasm.File(path, "r");
    try {
      const where = f.get("where");
      const what = f.get("what");
      const d1 = f.get("dataset1");
      const d1what = d1 && "get" in d1 ? d1.get("what") : null;
      const dataObj = d1 && "get" in d1 ? d1.get("data1") : null;
      const dataDs = dataObj && "get" in dataObj ? dataObj.get("data") : null;
      if (!dataDs || !("value" in dataDs) || dataDs.value == null) {
        throw new Error("SRI H5 missing /dataset1/data1/data");
      }

      const projdef = where && "attrs" in where ? strAttr(where, "projdef", "") : "";
      const origin = parseProjOrigin(projdef);
      const shape = "shape" in dataDs && Array.isArray(dataDs.shape) ? dataDs.shape : null;
      const ny = shape?.[0] ?? (where && "attrs" in where ? numAttr(where, "ysize", POLCOMP_SRI_GRID.ny) : POLCOMP_SRI_GRID.ny);
      const nx = shape?.[1] ?? (where && "attrs" in where ? numAttr(where, "xsize", POLCOMP_SRI_GRID.nx) : POLCOMP_SRI_GRID.nx);

      const grid: SriGrid = {
        nx,
        ny,
        xscale: where && "attrs" in where ? numAttr(where, "xscale", POLCOMP_SRI_GRID.xscale) : POLCOMP_SRI_GRID.xscale,
        yscale: where && "attrs" in where ? numAttr(where, "yscale", POLCOMP_SRI_GRID.yscale) : POLCOMP_SRI_GRID.yscale,
        lat0: origin.lat0,
        lon0: origin.lon0,
        radiusM: SRI_R,
        nodata: d1what && "attrs" in d1what ? numAttr(d1what, "nodata", POLCOMP_SRI_GRID.nodata) : POLCOMP_SRI_GRID.nodata,
        undetect: d1what && "attrs" in d1what ? numAttr(d1what, "undetect", POLCOMP_SRI_GRID.undetect) : POLCOMP_SRI_GRID.undetect,
        gain: d1what && "attrs" in d1what ? numAttr(d1what, "gain", 1) : 1,
        offset: d1what && "attrs" in d1what ? numAttr(d1what, "offset", 0) : 0,
      };

      const raw = dataDs.value;
      const data = raw instanceof Float32Array ? raw : Float32Array.from(raw as ArrayLike<number>, Number);

      const date = what && "attrs" in what ? strAttr(what, "date", "") : "";
      const clock = what && "attrs" in what ? strAttr(what, "time", "") : "";
      const time = odimClock(date, clock);
      if (time == null) throw new Error("SRI H5 missing /what date+time");

      return { time, data, grid };
    } finally {
      f.close();
    }
  } finally {
    try {
      unlinkSync(path);
    } catch {
      // temp file is best-effort
    }
  }
}
