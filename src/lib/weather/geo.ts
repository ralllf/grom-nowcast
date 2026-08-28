export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const r = 6371;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function destPoint(
  lat: number,
  lon: number,
  bearingDeg: number,
  km: number,
): { lat: number; lon: number } {
  const r = 6371;
  const br = (bearingDeg * Math.PI) / 180;
  const p1 = (lat * Math.PI) / 180;
  const l1 = (lon * Math.PI) / 180;
  const d = km / r;
  const p2 = Math.asin(
    Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(br),
  );
  const l2 =
    l1 +
    Math.atan2(
      Math.sin(br) * Math.sin(d) * Math.cos(p1),
      Math.cos(d) - Math.sin(p1) * Math.sin(p2),
    );
  return { lat: (p2 * 180) / Math.PI, lon: (l2 * 180) / Math.PI };
}

/** Direction of travel, 0 = north, clockwise. */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const y = Math.sin(dl) * Math.cos(p2);
  const x =
    Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** "od zachodu" — where the cell is coming from, given travel bearing. */
export function comingFromPl(travelBearing: number): string {
  const from = (travelBearing + 180) % 360;
  const labels = [
    "północy",
    "północnego wschodu",
    "wschodu",
    "południowego wschodu",
    "południa",
    "południowego zachodu",
    "zachodu",
    "północnego zachodu",
  ];
  return labels[Math.round(from / 45) % 8] ?? "nieznanego kierunku";
}

/** "na wschód" — where the cell is heading. */
export function towardPl(travelBearing: number): string {
  const labels = [
    "północ",
    "północny wschód",
    "wschód",
    "południowy wschód",
    "południe",
    "południowy zachód",
    "zachód",
    "północny zachód",
  ];
  return labels[Math.round((travelBearing % 360) / 45) % 8] ?? "nieznany kierunek";
}

export function lonLatToTile(
  lon: number,
  lat: number,
  z: number,
): { x: number; y: number; xf: number; yf: number } {
  const n = 2 ** z;
  const xf = ((lon + 180) / 360) * n;
  const latRad = (lat * Math.PI) / 180;
  const yf =
    ((1 -
      Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) /
      2) *
    n;
  return { x: Math.floor(xf), y: Math.floor(yf), xf, yf };
}

export function tilePixelToLonLat(
  z: number,
  x: number,
  y: number,
  px: number,
  py: number,
  tileSize = 256,
): { lat: number; lon: number } {
  const n = 2 ** z;
  const lon = ((x + px / tileSize) / n) * 360 - 180;
  const mer = Math.PI * (1 - (2 * (y + py / tileSize)) / n);
  const lat = (Math.atan(Math.sinh(mer)) * 180) / Math.PI;
  return { lat, lon };
}

export function bboxForRadius(
  lat: number,
  lon: number,
  radiusKm: number,
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const dLat = radiusKm / 111.32;
  const dLon = radiusKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return {
    minLat: lat - dLat,
    maxLat: lat + dLat,
    minLon: lon - dLon,
    maxLon: lon + dLon,
  };
}

export function destPointKm = destPoint;
export function circlePolygon(
  lat: number,
  lon: number,
  radiusKm: number,
  steps = 64,
): { type: "Polygon"; coordinates: number[][][] } {
  const ring: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const p = destPoint(lat, lon, (i / steps) * 360, radiusKm);
    ring.push([p.lon, p.lat]);
  }
  return { type: "Polygon", coordinates: [ring] };
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
