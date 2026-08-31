/**
 * Azimuthal Equidistant on a sphere — IMGW POLCOMP `+proj=aeqd +ellps=sphere`.
 * Inverse is the only transform the analysis path needs (pixel metres → lon/lat).
 */

/** POLCOMP composite origin, from live COMPO_SRI `where/projdef` (2026-08-31). */
export const SRI_LAT0 = 52.3469;
export const SRI_LON0 = 19.0926;
/** PROJ `+ellps=sphere` semi-major axis, metres. */
export const SRI_R = 6_370_997;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function aeqdForward(
  lat: number,
  lon: number,
  lat0 = SRI_LAT0,
  lon0 = SRI_LON0,
  radiusM = SRI_R,
): { x: number; y: number } {
  const φ0 = lat0 * DEG;
  const λ0 = lon0 * DEG;
  const φ = lat * DEG;
  const λ = lon * DEG;
  const dλ = λ - λ0;
  const cosc = Math.sin(φ0) * Math.sin(φ) + Math.cos(φ0) * Math.cos(φ) * Math.cos(dλ);
  const c = Math.acos(Math.min(1, Math.max(-1, cosc)));
  const k = c < 1e-12 ? 1 : c / Math.sin(c);
  return {
    x: radiusM * k * Math.cos(φ) * Math.sin(dλ),
    y: radiusM * k * (Math.cos(φ0) * Math.sin(φ) - Math.sin(φ0) * Math.cos(φ) * Math.cos(dλ)),
  };
}

export function aeqdInverse(
  x: number,
  y: number,
  lat0 = SRI_LAT0,
  lon0 = SRI_LON0,
  radiusM = SRI_R,
): { lat: number; lon: number } {
  const φ0 = lat0 * DEG;
  const λ0 = lon0 * DEG;
  const ρ = Math.hypot(x, y);
  if (ρ < 1e-9) return { lat: lat0, lon: lon0 };
  const c = ρ / radiusM;
  const sinc = Math.sin(c);
  const cosc = Math.cos(c);
  const φ = Math.asin(cosc * Math.sin(φ0) + (y * sinc * Math.cos(φ0)) / ρ);
  const λ = λ0 + Math.atan2(x * sinc, ρ * Math.cos(φ0) * cosc - y * Math.sin(φ0) * sinc);
  return { lat: φ * RAD, lon: λ * RAD };
}
