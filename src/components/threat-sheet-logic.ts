import type { CellTrend, Threat, ThreatLevel } from "@/lib/weather/types";
import { lightningCaption } from "../lib/weather/perun.ts";
import { IMGW_WARNINGS_UNAVAILABLE, RADAR_UNAVAILABLE } from "../lib/weather/snapshot.ts";
import { cellTrendCopy } from "../lib/weather/trend.ts";
import { wallClockMin } from "../lib/weather/wall-clock.ts";

export { lightningCaption };

/** Count line for the IMGW aside — never a fake zero while fetching or when IMGW is down. */
export function imgwAsideCountLine(
  snapshot: { stormWarningCount: number; warningsUnavailable: boolean } | null | undefined,
): string | null {
  if (!snapshot || snapshot.warningsUnavailable) return null;
  return `${snapshot.stormWarningCount} burzowych w kraju`;
}

/** Source-specific sheet honesty. Radar and IMGW are never blamed in one „albo” string. */
export function sheetSourceHonesty(opts: {
  queryError?: boolean;
  radarUnavailable?: boolean;
  warningsUnavailable?: boolean;
}): { radar: string | null; imgw: string | null } {
  return {
    radar: opts.queryError || opts.radarUnavailable ? RADAR_UNAVAILABLE : null,
    imgw: opts.warningsUnavailable ? IMGW_WARNINGS_UNAVAILABLE : null,
  };
}

export function cellTrendLine(trend: CellTrend | undefined): string | null {
  return cellTrendCopy(trend ?? null);
}

export function etaLabel(threat: Threat | null, ageMin = 0): string {
  if (threat?.etaMin === 0) return "teraz";
  if (threat?.etaMin != null) {
    const wall = wallClockMin(threat.etaMin, ageMin);
    return wall === 0 ? "teraz" : `${wall} min`;
  }
  if (
    threat &&
    !threat.willHit &&
    threat.missKm != null &&
    threat.missKm > 8 &&
    threat.nearestKm != null &&
    threat.nearestKm > 20 &&
    threat.nearestKm <= 80
  ) {
    return "minie";
  }
  return "—";
}

export function shouldAutoExpandSheet(level: ThreatLevel | undefined, desktop: boolean): boolean {
  if (desktop) return false;
  return level === "imminent" || level === "now";
}

/** Nowcast lane only — IMGW never occupies the "nadciąga za 18 min" headline. */
export function nowcastHeadline(threat: Threat | null, pending: boolean): string {
  if (pending && !threat) return "Skanuję radar…";
  if (!threat) return "Brak danych";
  if (threat.level === "watch") return "Czysto";
  return threat.title;
}
