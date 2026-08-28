import type { Threat, ThreatLevel } from "@/lib/weather/types";

export function etaLabel(threat: Threat | null): string {
  if (threat?.etaMin === 0) return "teraz";
  if (threat?.etaMin != null) return `${threat.etaMin} min`;
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
