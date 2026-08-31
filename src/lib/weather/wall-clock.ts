/**
 * Display / decision-side conversion from radar frame-time minutes to wall-clock.
 * Motion math (`computeThreat` etaMin, timeline.t) stays in frame-time.
 */

export function radarAgeMin(radarTimeSec: number | null, nowMs: number): number {
  if (radarTimeSec == null) return 0;
  return Math.max(0, (nowMs / 1000 - radarTimeSec) / 60);
}

/** Frame-time minutes minus radar age, floored at 0. */
export function wallClockMin(frameMin: number, ageMin: number): number {
  return Math.max(0, Math.round(frameMin - ageMin));
}

export function formatRadarClock(unixSec: number): string {
  return new Date(unixSec * 1000).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "Radar 11:15 · sprzed 6 min" — null when there is no scan. */
export function radarAgeCaption(radarTimeSec: number | null, nowMs: number): string | null {
  if (radarTimeSec == null) return null;
  const age = Math.round(radarAgeMin(radarTimeSec, nowMs));
  return `Radar ${formatRadarClock(radarTimeSec)} · sprzed ${age} min`;
}

/**
 * Rewrite user-facing arrival minutes in computeThreat copy.
 * Leaves the "na ok. 45 min" forecast window alone (no ": ok. N min" / "za ~N min").
 */
export function rewriteArrivalMinutes(
  detail: string,
  frameEta: number | null,
  ageMin: number,
): string {
  if (frameEta == null || frameEta <= 0) return detail;
  const wall = wallClockMin(frameEta, ageMin);
  if (wall === frameEta) return detail;
  const arrival = wall === 0 ? "teraz" : `ok. ${wall} min`;
  const beside = wall === 0 ? "teraz" : `za ~${wall} min`;
  return detail
    .replace(`: ok. ${frameEta} min`, `: ${arrival}`)
    .replace(`za ~${frameEta} min`, beside);
}

export function wallClockAxisLabel(frameMin: number, ageMin: number, withUnit = false): string {
  const wall = wallClockMin(frameMin, ageMin);
  if (wall === 0) return "teraz";
  return withUnit ? `${wall} min` : String(wall);
}
