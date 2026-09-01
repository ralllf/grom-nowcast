/** Amber `tor komórki` arrows on the map. Default off — they clutter a dry pin. */
export const TRACKS_MAP_DEFAULT = false;

export function readTracksMapToggle(raw: unknown): boolean {
  return typeof raw === "boolean" ? raw : TRACKS_MAP_DEFAULT;
}

/**
 * Map draw path only. `computeThreat` / sheet / `pokaż` still see the full list.
 * Overlay off → empty glyphs; overlay on → same tracks, unchanged.
 */
export function tracksForMap<T>(tracks: readonly T[], overlayOn: boolean): readonly T[] {
  return overlayOn ? tracks : [];
}
