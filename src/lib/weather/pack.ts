import type { RadarLevel, RadarMemoryFrame, RadarSample, RadarScan } from "./types.ts";

/**
 * Wire format for radar samples.
 *
 * TanStack Start serialises server-function results with a typed JSON encoder that
 * wraps every scalar (`{"t":0,"s":51.149}`), so an array of numbers costs ~17 bytes
 * per value. A single string is serialised once, so each frame travels as base64 of
 * 8 bytes per sample: u16 lat, u16 lon (thousandths of a degree from the bbox corner),
 * u16 level, u16 rate×10. ~4 000 samples ≈ 43 kB before gzip.
 */
const LAT0 = 48.0;
/** West of the old 13°E origin so COMPO_SRI (~11.6°E) survives the wire. */
const LON0 = 11.0;
const BYTES = 8;

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(b64, "base64"));
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function packSamples(samples: RadarSample[]): string {
  const buf = new Uint8Array(samples.length * BYTES);
  const view = new DataView(buf.buffer);
  let o = 0;
  for (const s of samples) {
    const lat = Math.max(0, Math.min(65535, Math.round((s.lat - LAT0) * 1000)));
    const lon = Math.max(0, Math.min(65535, Math.round((s.lon - LON0) * 1000)));
    const rate = Math.max(0, Math.min(65535, Math.round((s.rate ?? 0) * 10)));
    view.setUint16(o, lat, true);
    view.setUint16(o + 2, lon, true);
    view.setUint16(o + 4, s.level, true);
    view.setUint16(o + 6, rate, true);
    o += BYTES;
  }
  return bytesToBase64(buf);
}

export function unpackSamples(packed: string): RadarSample[] {
  if (!packed) return [];
  const bytes = base64ToBytes(packed);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out: RadarSample[] = [];
  for (let o = 0; o + BYTES <= bytes.byteLength; o += BYTES) {
    out.push({
      lat: LAT0 + view.getUint16(o, true) / 1000,
      lon: LON0 + view.getUint16(o + 2, true) / 1000,
      level: Math.min(4, view.getUint16(o + 4, true)) as RadarLevel,
      rate: view.getUint16(o + 6, true) / 10,
    });
  }
  return out;
}

/** Oldest → newest frames with samples materialised, whichever wire shape the scan uses. */
export function framesFromScan(radar: RadarScan): RadarMemoryFrame[] {
  if (radar.history?.length) {
    return radar.history.map((f) => ({
      time: f.time,
      maxLevel: f.maxLevel,
      nearestKm: f.nearestKm,
      samples: f.samples.length > 0 ? f.samples : f.packed ? unpackSamples(f.packed) : [],
      cellKm: f.cellKm ?? radar.cellKm,
    }));
  }
  // Legacy shape: samples / prevSamples on the scan itself.
  const frames: RadarMemoryFrame[] = [];
  if (radar.prevTime != null && radar.prevSamples.length > 0) {
    frames.push({
      time: radar.prevTime,
      samples: radar.prevSamples,
      maxLevel: radar.prevSamples.reduce<RadarLevel>((m, s) => (s.level > m ? s.level : m), 0),
      nearestKm: null,
      cellKm: radar.cellKm,
    });
  }
  if (radar.latestTime != null) {
    frames.push({
      time: radar.latestTime,
      samples: radar.samples,
      maxLevel: radar.maxLevel,
      nearestKm: radar.nearestKm,
      cellKm: radar.cellKm,
    });
  }
  return frames;
}
