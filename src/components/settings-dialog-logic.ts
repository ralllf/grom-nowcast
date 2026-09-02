/** Settings dialog copy + close / focus helpers. §5 / §7 Dialog / 10b#9. */

export const SETTINGS_INTRO = "Wybierz miasto albo stuknij mapę.";

export const GPS_BLOCKED_INTRO =
  "Wybierz miasto albo stuknij mapę. GPS działa na telefonie poza tym podglądem — tu przeglądarka go blokuje.";

export const GPS_BLOCKED_LOCATE =
  "W tym podglądzie przeglądarka blokuje GPS. Wybierz miasto albo stuknij mapę — na telefonie, poza podglądem, celownik pobierze lokalizację.";

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function settingsIntroCopy(geoHint: string | null, embedded: boolean): string {
  if (geoHint) return geoHint;
  return embedded ? GPS_BLOCKED_INTRO : SETTINGS_INTRO;
}

/** Preview-only GPS-blocked line. Real phones (even without geolocation) get null. */
export function locateGpsHint(embedded: boolean, _hasGeolocation: boolean): string | null {
  return embedded ? GPS_BLOCKED_LOCATE : null;
}

export function shouldCloseSettingsOnKey(key: string): boolean {
  return key === "Escape";
}

export function isSettingsScrimClick(target: unknown, currentTarget: unknown): boolean {
  return target === currentTarget;
}

/** Element to focus when Tab would leave the dialog; null lets the browser move inside. */
export function tabWrapTarget<T>(shiftKey: boolean, focusables: T[], active: T | null): T | null {
  if (focusables.length === 0) return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const inside = active != null && focusables.includes(active);
  if (!shiftKey && (active === last || !inside)) return first;
  if (shiftKey && (active === first || !inside)) return last;
  return null;
}
