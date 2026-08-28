/** OpenFreeMap / style fetch died before the map became usable. */
export function shouldFallbackBasemap(message: string, styleReady: boolean): boolean {
  if (styleReady) return false;
  return /api key|401|403|not authorized|forbidden|failed to (fetch|load)|gpu|webgl/i.test(message);
}
