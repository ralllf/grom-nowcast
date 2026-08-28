import { bearingDeg, comingFromPl, destPoint, haversineKm, towardPl } from "./geo.ts";
import type {
  CellTrack,
  OfficialWarning,
  Place,
  RadarMemoryFrame,
  RadarSample,
  Threat,
  ThreatLevel,
} from "./types.ts";

/** Distance at which the cell is treated as covering the city / GPS pin. */
const PIN_KM = 5;
const CELL_RADIUS_KM = 32;
const MATCH_KM = 45;
const MAX_SPEED = 95;
const MIN_MOVE_SPEED = 4;
const HORIZON_MIN = 90;

function centroid(samples: RadarSample[]): { lat: number; lon: number } | null {
  if (samples.length === 0) return null;
  const w = samples.reduce((s, p) => s + p.level, 0);
  if (w <= 0) return null;
  return {
    lat: samples.reduce((s, p) => s + p.lat * p.level, 0) / w,
    lon: samples.reduce((s, p) => s + p.lon * p.level, 0) / w,
  };
}

type Cell = {
  lat: number;
  lon: number;
  maxLevel: number;
  samples: RadarSample[];
};

function clusterCells(samples: RadarSample[]): Cell[] {
  const pool = samples
    .filter((s) => s.level >= 1)
    .sort((a, b) => b.level - a.level || b.lat - a.lat);
  const used = new Uint8Array(pool.length);
  const cells: Cell[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (used[i]) continue;
    const seed = pool[i];
    if (!seed) continue;
    const members: RadarSample[] = [];
    for (let j = 0; j < pool.length; j++) {
      if (used[j]) continue;
      const s = pool[j];
      if (!s) continue;
      if (haversineKm(seed.lat, seed.lon, s.lat, s.lon) <= CELL_RADIUS_KM) {
        used[j] = 1;
        members.push(s);
      }
    }
    if (members.length < 3) continue;
    const c = centroid(members);
    if (!c) continue;
    cells.push({
      lat: c.lat,
      lon: c.lon,
      maxLevel: members.reduce((m, s) => Math.max(m, s.level), 0),
      samples: members,
    });
  }
  return cells.slice(0, 10);
}

function motionOf(
  cell: Cell,
  prevCells: Cell[],
  hours: number,
): { speed: number; bearing: number; from: { lat: number; lon: number } } | null {
  let best: Cell | null = null;
  let bestD = MATCH_KM;
  for (const prev of prevCells) {
    const d = haversineKm(prev.lat, prev.lon, cell.lat, cell.lon);
    if (d < bestD) {
      bestD = d;
      best = prev;
    }
  }
  if (!best) return null;
  const moved = haversineKm(best.lat, best.lon, cell.lat, cell.lon);
  const speed = hours > 0 ? moved / hours : 0;
  if (speed > MAX_SPEED) return null;
  const bearing = bearingDeg(best.lat, best.lon, cell.lat, cell.lon);
  return { speed, bearing, from: { lat: best.lat, lon: best.lon } };
}

function closestApproach(
  lat: number,
  lon: number,
  bearing: number,
  speedKmh: number,
  pinLat: number,
  pinLon: number,
) {
  let best = { d: haversineKm(pinLat, pinLon, lat, lon), t: 0 };
  const useSpeed = Math.max(speedKmh, 8);
  for (let t = 0; t <= HORIZON_MIN; t += 2) {
    const p = destPoint(lat, lon, bearing, useSpeed * (t / 60));
    const d = haversineKm(pinLat, pinLon, p.lat, p.lon);
    if (d < best.d) best = { d, t };
  }
  return best;
}

function isActive(warning: OfficialWarning, now = Date.now()) {
  const from = Date.parse(warning.from.replace(" ", "T"));
  const to = Date.parse(warning.to.replace(" ", "T"));
  if (Number.isNaN(from) || Number.isNaN(to)) return true;
  return now >= from - 30 * 60_000 && now <= to;
}

function roundPct(n: number) {
  return Math.max(5, Math.min(95, Math.round(n / 5) * 5));
}

function expectPl(maxLevel: number): string | null {
  if (maxLevel >= 4) return "silną ulewę, porywy wiatru, możliwy grad";
  if (maxLevel >= 3) return "ulewę i porywisty wiatr";
  if (maxLevel >= 2) return "deszcz i mokrą jezdnię";
  if (maxLevel >= 1) return "słaby deszcz";
  return null;
}

export function computeThreat(
  place: Place,
  frames: RadarMemoryFrame[],
  warnings: OfficialWarning[],
  radiusKm: number,
): Threat {
  const matched = warnings.filter((w) => w.matchesPlace && w.stormRelated);
  const usable = frames
    .filter((f) => f.samples.some((s) => s.level >= 1))
    .sort((a, b) => a.time - b.time);
  const last = usable.at(-1);
  const first = usable.length >= 2 ? usable.at(-2) : undefined;

  const maxLevel = last?.maxLevel ?? 0;
  const nearestKm = last?.nearestKm ?? null;
  const who = place.label;

  let approaching = false;
  let receding = false;
  let speedKmh: number | null = null;
  let etaMin: number | null = null;
  let comingFrom: string | null = null;
  let toward: string | null = null;
  let willHit = false;
  let missKm: number | null = null;
  const tracks: CellTrack[] = [];
  let threatTrack: CellTrack | null = null;
  let threatCellLevel = 0;

  if (first && last && last.time > first.time) {
    const hours = (last.time - first.time) / 3600;
    const cells = clusterCells(last.samples);
    const prevCells = clusterCells(first.samples);
    let bestHit: {
      miss: number;
      eta: number;
      approaching: boolean;
      receding: boolean;
      speed: number;
      bearing: number;
      track: CellTrack;
      level: number;
    } | null = null;

    for (const cell of cells) {
      const motion = motionOf(cell, prevCells, hours);
      if (!motion) continue;
      const moving = motion.speed >= MIN_MOVE_SPEED;
      const lookKm = moving ? Math.max(motion.speed * 0.6, 36) : 0;
      const back = destPoint(cell.lat, cell.lon, (motion.bearing + 180) % 360, 12);
      const soon = moving
        ? destPoint(cell.lat, cell.lon, motion.bearing, lookKm)
        : { lat: cell.lat, lon: cell.lon };
      const approach = closestApproach(
        cell.lat,
        cell.lon,
        motion.bearing,
        motion.speed,
        place.lat,
        place.lon,
      );
      const dNow = haversineKm(place.lat, place.lon, cell.lat, cell.lon);
      const dThen = haversineKm(place.lat, place.lon, motion.from.lat, motion.from.lon);
      const cellApproaching = dNow < dThen - 0.6;
      const cellReceding = dNow > dThen + 0.6;
      const hitsPin = approach.d <= PIN_KM && moving;
      const track: CellTrack = {
        from: back,
        now: { lat: cell.lat, lon: cell.lon },
        soon,
        speedKmh: motion.speed,
        bearing: motion.bearing,
        threatening: false,
      };
      if (moving) tracks.push(track);

      const score = approach.d + dNow * 0.2 - (hitsPin ? 80 : 0);
      const bestScore = bestHit
        ? bestHit.miss +
          haversineKm(place.lat, place.lon, bestHit.track.now.lat, bestHit.track.now.lon) * 0.2 -
          (bestHit.miss <= PIN_KM ? 80 : 0)
        : Infinity;
      if (score < bestScore) {
        bestHit = {
          miss: approach.d,
          eta: approach.t,
          approaching: cellApproaching,
          receding: cellReceding,
          speed: motion.speed,
          bearing: motion.bearing,
          track,
          level: cell.maxLevel,
        };
      }
    }

    if (bestHit) {
      missKm = bestHit.miss;
      approaching = bestHit.approaching;
      receding = bestHit.receding;
      comingFrom = comingFromPl(bestHit.bearing);
      toward = towardPl(bestHit.bearing);
      threatCellLevel = bestHit.level;
      if (bestHit.speed >= MIN_MOVE_SPEED) speedKmh = bestHit.speed;
      willHit = bestHit.miss <= PIN_KM;
      bestHit.track.threatening = willHit || (bestHit.approaching && bestHit.miss <= 12);
      threatTrack = bestHit.track;
      if (!tracks.includes(bestHit.track) && bestHit.speed >= MIN_MOVE_SPEED) {
        tracks.unshift(bestHit.track);
      }
    }
    tracks.sort(
      (a, b) =>
        Number(b.threatening) - Number(a.threatening) ||
        haversineKm(place.lat, place.lon, a.now.lat, a.now.lon) -
          haversineKm(place.lat, place.lon, b.now.lat, b.now.lon),
    );
    if (tracks.length > 6) tracks.length = 6;
  }

  if (nearestKm !== null && nearestKm <= PIN_KM && maxLevel >= 1) {
    etaMin = 0;
    willHit = true;
  } else if (
    threatTrack &&
    speedKmh !== null &&
    speedKmh >= MIN_MOVE_SPEED &&
    missKm !== null &&
    (willHit || (approaching && missKm <= 12))
  ) {
    etaMin = Math.max(1, Math.round(
      closestApproach(
        threatTrack.now.lat,
        threatTrack.now.lon,
        threatTrack.bearing,
        speedKmh,
        place.lat,
        place.lon,
      ).t,
    ));
  }

  const activeMatch = matched.filter((w) => isActive(w));
  const upcoming = matched.filter((w) => !isActive(w));
  const expectLevel = Math.max(maxLevel, willHit ? threatCellLevel : 0);
  let expect = expectPl(expectLevel);

  const aboutPin =
    (nearestKm !== null && nearestKm <= 80) ||
    willHit ||
    (approaching && missKm !== null && missKm <= 20);
  if (!aboutPin) {
    comingFrom = null;
    toward = null;
    if (maxLevel < 1) expect = null;
  }

  let chance = 10;
  if (activeMatch.length > 0) {
    const degree = Math.max(...activeMatch.map((w) => w.degree), 1);
    chance = Math.max(chance, 15 + degree * 10);
  }
  if (maxLevel >= 1 && nearestKm !== null && nearestKm <= radiusKm) chance = Math.max(chance, 25);
  if (maxLevel >= 2 && nearestKm !== null && nearestKm <= radiusKm) chance = Math.max(chance, 40);
  if (willHit && approaching && expectLevel >= 2) chance = Math.max(chance, 60);
  if (etaMin !== null && etaMin === 0 && maxLevel >= 1) chance = Math.max(chance, 80);
  if (etaMin !== null && etaMin > 0 && etaMin <= 20 && willHit) chance = Math.max(chance, 70);
  if (etaMin !== null && etaMin > 20 && etaMin <= 45 && willHit) chance = Math.max(chance, 50);
  if (nearestKm !== null && nearestKm <= PIN_KM && maxLevel >= 3) chance = Math.max(chance, 90);
  if (receding && (nearestKm === null || nearestKm > 12)) chance = Math.min(chance, 20);
  if (missKm !== null && missKm > PIN_KM + 8 && !willHit) {
    chance = Math.min(chance, Math.max(15, chance - 20));
  }
  chance = roundPct(chance);

  let level: ThreatLevel = "clear";
  if (activeMatch.length > 0) level = "watch";
  if (maxLevel >= 2 && nearestKm !== null && nearestKm <= radiusKm) level = "nearby";
  if (
    (etaMin !== null && etaMin > 0 && etaMin <= 25 && willHit && expectLevel >= 2) ||
    (nearestKm !== null && nearestKm <= 15 && maxLevel >= 3)
  ) {
    level = "imminent";
  }
  if (nearestKm !== null && nearestKm <= PIN_KM && maxLevel >= 2) level = "now";
  if (upcoming.length > 0 && level === "clear") level = "watch";

  const formNote = "Komórka może też urosnąć na miejscu — tego radar nie zapowie.";
  const dist =
    nearestKm !== null ? `ok. ${nearestKm.toFixed(0)} km od ${who}` : `w okolicy ${who}`;

  let detail: string;
  if (etaMin === 0 && maxLevel >= 1) {
    detail = `Opad jest nad ${who} teraz.${expect ? ` Spodziewaj się: ${expect}.` : ""} ${formNote}`;
  } else if (level === "clear") {
    detail = `Nad ${who} radar nie widzi groźnej komórki. Szansa ~${chance}% na ok. 45 min. ${formNote}`;
  } else if (level === "watch" && nearestKm === null) {
    const body =
      activeMatch[0]?.body ??
      upcoming[0]?.body ??
      "Instytut wydał ostrzeżenie dla powiatu.";
    detail = `${body} Dla ${who} szansa z radaru ~${chance}% na ~45 min.`;
  } else if (receding && aboutPin) {
    detail = `${comingFrom ? `Idzie od ${comingFrom}` : "Komórka"} (${dist}) i odchodzi na ${toward ?? "bok"}.${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. ${formNote}`;
  } else if (willHit && comingFrom) {
    const etaBit =
      etaMin && etaMin > 0 ? ` Dojście nad ${who}: ok. ${etaMin} min.` : "";
    detail = `Idzie od ${comingFrom}${speedKmh ? ` (~${Math.round(speedKmh)} km/h)` : ""}, echo ${dist}.${etaBit}${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. To ruch echa, nie pewność. ${formNote}`;
  } else if (comingFrom && missKm !== null && missKm > PIN_KM) {
    detail = `Idzie od ${comingFrom}, echo ${dist}. Tor minie ${who} ok. ${missKm.toFixed(0)} km obok${etaMin ? ` za ~${etaMin} min` : ""}.${expect ? ` Spodziewaj się w okolicy: ${expect}.` : ""} Nad samym punktem szansa ~${chance}%. ${formNote}`;
  } else if (nearestKm !== null) {
    detail = `Echo ${dist}${comingFrom ? `, od ${comingFrom}` : ""}.${expect ? ` Spodziewaj się: ${expect}.` : ""} Szansa ~${chance}%. ${formNote}`;
  } else {
    detail = `Szansa ~${chance}% dla ${who}. ${formNote}`;
  }

  const copy: Record<ThreatLevel, string> = {
    clear: "Czysto",
    watch: "Ostrzeżenie IMGW",
    nearby: receding ? "Opad oddala się" : approaching ? "Opad nadciąga" : "Opad w okolicy",
    imminent: "Burza nadciąga",
    now: "Burza nad Tobą",
  };

  return {
    level,
    title: copy[level],
    detail,
    etaMin,
    approaching,
    receding,
    speedKmh,
    nearestKm,
    maxLevel,
    chancePct: chance,
    comingFrom,
    toward,
    willHit,
    missKm,
    expect,
    track: threatTrack,
    tracks,
    matchedWarnings: matched,
  };
}
