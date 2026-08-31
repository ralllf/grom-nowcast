import type { Threat, ThreatLevel } from "@/lib/weather/types";
import { lightningCaption } from "../lib/weather/perun.ts";
import { wallClockMin } from "../lib/weather/wall-clock.ts";

export { lightningCaption };

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
