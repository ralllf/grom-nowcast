import type { OfficialWarning, Place, RadarScan, Snapshot } from "./types.ts";

export const IMGW_WARNINGS_UNAVAILABLE = "Ostrzeżenia IMGW chwilowo niedostępne";

export function warningMatches(w: OfficialWarning, place: Place): boolean {
  if (place.terc && w.teryt.includes(place.terc)) return true;
  return false;
}

export function emptyRadarScan(): RadarScan {
  return {
    host: "",
    generated: 0,
    latestTime: null,
    past: [],
    nowcast: [],
    samples: [],
    prevSamples: [],
    prevTime: null,
    history: [],
    maxLevel: 0,
    nearestKm: null,
    echoCount: 0,
    cellKm: 3,
  };
}

function selectWarnings(warnings: OfficialWarning[], place: Place): OfficialWarning[] {
  const tagged = warnings.map((w) => ({
    ...w,
    matchesPlace: warningMatches(w, place),
  }));
  const matched = tagged.filter((w) => w.matchesPlace);
  const storms = tagged.filter((w) => w.stormRelated);
  return matched.length > 0
    ? [...matched, ...storms.filter((w) => !matched.includes(w))].slice(0, 40)
    : storms.slice(0, 40);
}

export type SnapshotSources = {
  sampleRadar: () => Promise<RadarScan>;
  getImgwWarnings: () => Promise<OfficialWarning[]>;
};

/**
 * Radar + IMGW in parallel. A 404/timeout on one source leaves the other intact.
 * Place may already be resolved or still in flight (runs alongside the sources).
 */
export async function loadSnapshot(
  placeOr: Place | Promise<Place>,
  sources: SnapshotSources,
  now = Date.now(),
): Promise<Snapshot> {
  const [radarResult, warningsResult, place] = await Promise.all([
    sources.sampleRadar().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    sources.getImgwWarnings().then(
      (value) => ({ ok: true as const, value }),
      () => ({ ok: false as const }),
    ),
    Promise.resolve(placeOr),
  ]);

  const radar = radarResult.ok ? radarResult.value : emptyRadarScan();
  const rawWarnings = warningsResult.ok ? warningsResult.value : [];
  const warningsUnavailable = !warningsResult.ok;

  return {
    fetchedAt: now,
    place,
    radar,
    warnings: selectWarnings(rawWarnings, place),
    stormWarningCount: rawWarnings.filter((w) => w.stormRelated).length,
    warningsUnavailable,
  };
}
