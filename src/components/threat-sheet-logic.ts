import type { CellTrend, Threat, ThreatLevel } from "@/lib/weather/types";
import { lightningCaption } from "../lib/weather/perun.ts";
import { cellTrendCopy } from "../lib/weather/trend.ts";
import { wallClockMin } from "../lib/weather/wall-clock.ts";

export { lightningCaption };

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
