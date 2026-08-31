import { deflateSync, crc32 } from "node:zlib";
import { LEVEL_MIN_RATE } from "./palette.ts";
import type { SriGrid } from "./sri.ts";
import {
  SWATCH_RGB,
  classesFromSriGrid,
  overlayCorners,
} from "./sri-overlay.ts";
import type { RadarScan, SriOverlayMeta } from "./types.ts";

/** Indexed PNG: transparent + the four legend swatches. Node-only (zlib). */
export function encodeClassPng(classes: Uint8Array, nx: number, ny: number): Buffer {
  if (classes.length !== nx * ny) throw new Error("overlay class grid size mismatch");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(nx, 0);
  ihdr.writeUInt32BE(ny, 4);
  ihdr[8] = 8;
  ihdr[9] = 3;
  const plte = Buffer.from([
    0, 0, 0,
    ...SWATCH_RGB[1],
    ...SWATCH_RGB[2],
    ...SWATCH_RGB[3],
    ...SWATCH_RGB[4],
  ]);
  const trns = Buffer.from([0, 255, 255, 255, 255]);
  const raw = Buffer.alloc(ny * (1 + nx));
  for (let y = 0; y < ny; y++) {
    const row = y * nx;
    const dest = y * (1 + nx);
    raw[dest] = 0;
    raw.set(classes.subarray(row, row + nx), dest + 1);
  }
  const idat = deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("PLTE", plte),
    pngChunk("tRNS", trns),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type: string, data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([len, body, crc]);
}

const OVERLAY_CACHE_MAX = 12;

type CachedOverlay = {
  time: number;
  classes: Uint8Array;
  drizzle: Uint8Array;
  grid: SriGrid;
};

const overlayFields = new Map<number, CachedOverlay>();
const overlayPngs = new Map<string, Buffer>();

export function resetSriOverlayCache() {
  overlayFields.clear();
  overlayPngs.clear();
}

export function rememberSriOverlay(
  time: number,
  data: ArrayLike<number>,
  grid: SriGrid,
): CachedOverlay {
  const classes = classesFromSriGrid(data, grid);
  const drizzle = new Uint8Array(classes.length);
  for (let i = 0; i < classes.length; i++) {
    if (classes[i] !== 0) continue;
    const raw = Number(data[i]);
    if (!Number.isFinite(raw) || raw === grid.nodata || raw === grid.undetect) continue;
    const rate = raw * grid.gain + grid.offset;
    if (rate > 0 && rate < LEVEL_MIN_RATE[1]) drizzle[i] = 1;
  }
  const cached = { time, classes, drizzle, grid };
  overlayFields.set(time, cached);
  overlayPngs.delete(`${time}:0`);
  overlayPngs.delete(`${time}:1`);
  while (overlayFields.size > OVERLAY_CACHE_MAX) {
    const oldest = overlayFields.keys().next().value;
    if (oldest === undefined) break;
    overlayFields.delete(oldest);
    overlayPngs.delete(`${oldest}:0`);
    overlayPngs.delete(`${oldest}:1`);
  }
  return cached;
}

function paintCached(cached: CachedOverlay, drizzle: boolean): Uint8Array {
  if (!drizzle) return cached.classes;
  const out = cached.classes.slice();
  for (let i = 0; i < out.length; i++) {
    if (out[i] === 0 && cached.drizzle[i]) out[i] = 1;
  }
  return out;
}

export function sriOverlayPng(time: number, drizzle: boolean): Buffer | null {
  const cached = overlayFields.get(time);
  if (!cached) return null;
  const key = `${time}:${drizzle ? 1 : 0}`;
  const hit = overlayPngs.get(key);
  if (hit) return hit;
  const png = encodeClassPng(paintCached(cached, drizzle), cached.grid.nx, cached.grid.ny);
  overlayPngs.set(key, png);
  return png;
}

export function sriOverlayMetaFor(time: number): SriOverlayMeta | null {
  const cached = overlayFields.get(time);
  if (!cached) return null;
  return { time, corners: overlayCorners(cached.grid) };
}

export function attachSriOverlays(scan: RadarScan, source: "sri" | "rainviewer"): RadarScan {
  if (source !== "sri") return { ...scan, overlay: null, overlays: [] };
  const overlays: SriOverlayMeta[] = [];
  for (const frame of scan.history) {
    const meta = sriOverlayMetaFor(frame.time);
    if (meta) overlays.push(meta);
  }
  return { ...scan, overlay: overlays.at(-1) ?? null, overlays };
}
