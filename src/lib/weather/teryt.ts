import { CITIES } from "./cities.ts";
import { haversineKm } from "./geo.ts";
import type { Place } from "./types.ts";

export const TERYT_FALLBACK_KM = 30;

/** When Nominatim omits `teryt:terc`, copy TERYT from the nearest listed city. */
export function applyTerytFallback(place: Place, cities: Place[] = CITIES): Place {
  if (place.terc) return place;
  let best: Place | null = null;
  let bestKm = TERYT_FALLBACK_KM;
  for (const city of cities) {
    if (!city.terc) continue;
    const d = haversineKm(place.lat, place.lon, city.lat, city.lon);
    if (d <= bestKm) {
      best = city;
      bestKm = d;
    }
  }
  if (!best?.terc) return place;
  return {
    ...place,
    terc: best.terc,
    county: place.county ?? best.county,
    state: place.state ?? best.state,
  };
}
