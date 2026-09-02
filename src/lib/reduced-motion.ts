/** WCAG 2.3 / §7 Motion: honour `prefers-reduced-motion` for camera and flash. */

export function prefersReducedMotion(query?: { matches: boolean } | null): boolean {
  if (query) return query.matches;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function cameraDuration(ms: number, reduced = prefersReducedMotion()): number {
  return reduced ? 0 : ms;
}

/** `null` means do not flash the tab title. */
export function titleFlashIntervalMs(reduced = prefersReducedMotion()): number | null {
  return reduced ? null : 1500;
}
