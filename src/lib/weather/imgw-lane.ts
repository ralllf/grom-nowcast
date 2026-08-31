import { formatImgwRange, parseImgwWarsaw } from "./imgw-time.ts";
import type { OfficialWarning } from "./types.ts";
import type { PowiatBoundary } from "./teryt.ts";

/** On the day's list and not yet ended. Upcoming "dziś 14:00" still counts; history does not. */
export function isLiveStormWindow(_from: string, to: string, now = Date.now()): boolean {
  const end = parseImgwWarsaw(to);
  if (Number.isNaN(end)) return true;
  return now <= end;
}

export type ImgwGeoJSON = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    properties: { t: string; n: string; degree: number };
    geometry:
      | { type: "Polygon"; coordinates: number[][][] }
      | { type: "MultiPolygon"; coordinates: number[][][][] };
  }>;
};

export const IMGW_MAP_DEFAULT = true;

export function readImgwMapToggle(raw: unknown): boolean {
  return typeof raw === "boolean" ? raw : IMGW_MAP_DEFAULT;
}

export function shortStormEvent(event: string): string {
  const n = event.toLowerCase();
  if (n.includes("burz")) return "burze";
  if (n.includes("grad")) return "grad";
  if (n.includes("deszcz")) return "deszcz";
  return event.toLowerCase();
}

function countyBit(county: string | undefined): string {
  if (!county?.trim()) return "";
  const c = county.trim();
  const label = /^powiat\b/i.test(c) ? c : `powiat ${c}`;
  return ` · ${label}`;
}

export function formatImgwLane(
  warning: OfficialWarning,
  county: string | undefined,
  now = Date.now(),
): string {
  const event = shortStormEvent(warning.event);
  const when = formatImgwRange(warning.from, warning.to, now);
  return `Ostrzeżenie IMGW: ${event} · ${when}${countyBit(county)}`;
}

export function localImgwLane(
  warnings: OfficialWarning[],
  county: string | undefined,
  now = Date.now(),
): string | null {
  const local = warnings.find(
    (w) => w.matchesPlace && w.stormRelated && isLiveStormWindow(w.from, w.to, now),
  );
  if (!local) return null;
  return formatImgwLane(local, county, now);
}

export function normalizeTeryt4(code: string): string | null {
  const digits = code.replace(/\D/g, "");
  if (digits.length >= 4) return digits.slice(0, 4);
  return null;
}

/** Active storm warnings → powiat TERYT → max stopień. No upały/mgła, no history. */
export function stormWarningDegrees(
  warnings: OfficialWarning[],
  now = Date.now(),
): Record<string, number> {
  const degrees: Record<string, number> = {};
  for (const w of warnings) {
    if (!w.stormRelated) continue;
    if (!isLiveStormWindow(w.from, w.to, now)) continue;
    for (const raw of w.teryt) {
      const t = normalizeTeryt4(raw);
      if (!t) continue;
      degrees[t] = Math.max(degrees[t] ?? 0, w.degree);
    }
  }
  return degrees;
}

export function tintedPowiatCollection(
  powiaty: PowiatBoundary[],
  degrees: Record<string, number>,
): ImgwGeoJSON {
  const features: ImgwGeoJSON["features"] = [];
  for (const p of powiaty) {
    const degree = degrees[p.t];
    if (!degree) continue;
    features.push({
      type: "Feature",
      properties: { t: p.t, n: p.n, degree },
      geometry:
        p.g.length === 1
          ? { type: "Polygon", coordinates: p.g[0] }
          : { type: "MultiPolygon", coordinates: p.g },
    });
  }
  return { type: "FeatureCollection", features };
}

/** Subtle stopień tints — sit under the radar, readable on a phone. */
export const IMGW_DEGREE_PAINT = {
  color: ["match", ["get", "degree"], 1, "#c9a36a", 2, "#e4572e", 3, "#c23b2e", "#c9a36a"],
  opacity: ["match", ["get", "degree"], 1, 0.18, 2, 0.22, 3, 0.26, 0.18],
  line: ["match", ["get", "degree"], 1, "#c9a36a", 2, "#e4572e", 3, "#c23b2e", "#c9a36a"],
} as const;
