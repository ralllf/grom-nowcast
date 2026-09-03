import type { CellTrend, Threat, ThreatLevel, TimelinePoint } from "@/lib/weather/types";
import { STALE_RADAR_MIN } from "../lib/weather/alerts.ts";
import { levelLabelPl } from "../lib/weather/palette.ts";
import { lightningCaption } from "../lib/weather/perun.ts";
import { IMGW_WARNINGS_UNAVAILABLE, RADAR_UNAVAILABLE } from "../lib/weather/snapshot.ts";
import { cellTrendCopy } from "../lib/weather/trend.ts";
import { formatRadarClock, radarAgeMin, wallClockMin } from "../lib/weather/wall-clock.ts";

export { lightningCaption };

/** Expanded-sheet credit (not peek — map chrome already names OSM). Jargon is in `SHEET_DATA_DETAILS`. */
export const SHEET_CREDIT_LINE = "Dane: IMGW-PIB · mapa OpenFreeMap/OSM";

/** Legal / method copy — POLRAD, dBZ, Marshall–Palmer, COMPO_SRI. Not body copy. */
export const SHEET_DATA_DETAILS =
  "Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i Gospodarki Wodnej – Państwowy Instytut Badawczy. Dane radarowe zostały przetworzone (SRI mm/h IMGW, siatka ~3 km; RainViewer dBZ → Marshall–Palmer gdy SRI niedostępne). Analiza: IMGW COMPO_SRI. Mapa: IMGW SRI (4 klasy) / RainViewer fallback / OpenFreeMap / OSM. To nie jest oficjalny alert RCB. Komórka burzowa może powstać lokalnie nawet przy czystym radarze.";


/** Count line for the IMGW aside — never a fake zero while fetching or when IMGW is down. */
export function imgwAsideCountLine(
  snapshot: { stormWarningCount: number; warningsUnavailable: boolean } | null | undefined,
): string | null {
  if (!snapshot || snapshot.warningsUnavailable) return null;
  return `${snapshot.stormWarningCount} burzowych w kraju`;
}

/** Source-specific sheet honesty. Radar and IMGW are never blamed in one „albo” string. */
export function sheetSourceHonesty(opts: {
  queryError?: boolean;
  radarUnavailable?: boolean;
  warningsUnavailable?: boolean;
}): { radar: string | null; imgw: string | null } {
  return {
    radar: opts.queryError || opts.radarUnavailable ? RADAR_UNAVAILABLE : null,
    imgw: opts.warningsUnavailable ? IMGW_WARNINGS_UNAVAILABLE : null,
  };
}

export type SheetStatusTone = "mute" | "warn";

export type SheetStatusRow = {
  text: string;
  tone: SheetStatusTone;
};

/** Browser offline, or a fetch that failed as a network/offline error — not a 500. */
export function isOfflineFailure(opts: {
  browserOnline?: boolean;
  queryError?: boolean;
  error?: unknown;
}): boolean {
  if (opts.browserOnline === false) return true;
  if (!opts.queryError) return false;
  const raw = opts.error;
  const msg =
    raw instanceof Error
      ? `${raw.name} ${raw.message}`
      : typeof raw === "string"
        ? raw
        : JSON.stringify(raw ?? "");
  return /failed to fetch|networkerror|offline|load failed|network request failed|err_internet_disconnected|err_network_changed/i.test(
    msg,
  );
}

/** One grey instrument row. Amber only when the radar itself is stale or down. */
export function sheetStatusRow(opts: {
  radarTime: number | null;
  nowMs: number;
  radarUnavailable?: boolean;
  queryError?: boolean;
  warningsUnavailable?: boolean;
  lightningUnavailable?: boolean;
  offline?: boolean;
}): SheetStatusRow | null {
  const radarDown = Boolean(opts.queryError || opts.radarUnavailable);
  const offline = Boolean(opts.offline);
  if (opts.radarTime == null && !radarDown && !offline) return null;

  const ageMin = Math.round(radarAgeMin(opts.radarTime, opts.nowMs));
  const stale = opts.radarTime != null && ageMin > STALE_RADAR_MIN;

  if (offline) {
    const last = opts.radarTime == null ? "Bez sieci" : `Bez sieci · ostatni radar ${formatRadarClock(opts.radarTime)}`;
    return {
      text: stale ? `${last} · alert wstrzymany` : last,
      tone: stale ? "warn" : "mute",
    };
  }

  const held = stale ? " · alert wstrzymany" : "";
  const radarPart =
    opts.radarTime == null ? "Radar ✕" : `Radar ${formatRadarClock(opts.radarTime)} · ${ageMin} min`;
  const imgwPart = opts.warningsUnavailable ? "IMGW ✕" : "IMGW ✓";
  const lightningPart = opts.lightningUnavailable ? "wyładowania ✕" : "wyładowania ✓";
  return {
    text: `${radarPart}${held} · ${imgwPart} · ${lightningPart}`,
    tone: radarDown || stale ? "warn" : "mute",
  };
}

/** Peek only shows the row when radar is stale/down or the browser is offline. */
export function sheetPeekStatus(row: SheetStatusRow | null, offline: boolean): SheetStatusRow | null {
  if (!row) return null;
  if (row.tone === "warn" || offline) return row;
  return null;
}

export function cellTrendLine(trend: CellTrend | undefined): string | null {
  return cellTrendCopy(trend ?? null);
}

/** " na wschód" — spoken words, never an arrow glyph (screen readers say "strzałka"). */
export function idzieOdTowardSuffix(toward: string | null | undefined): string {
  return toward ? ` na ${toward}` : "";
}

/** Echo distance rides the Idzie od line instead of a third KPI tile. */
export function idzieOdEchoSuffix(nearestKm: number | null | undefined): string {
  if (nearestKm == null) return "";
  return ` · echo ${nearestKm.toFixed(0)} km`;
}

/** Full Idzie od line for a west→east cell: "Idzie od zachodu na wschód". */
export function idzieOdLine(
  comingFrom: string | null | undefined,
  toward: string | null | undefined,
): string | null {
  if (!comingFrom) return null;
  return `Idzie od ${comingFrom}${idzieOdTowardSuffix(toward)}`;
}

export function etaLabel(threat: Threat | null, ageMin = 0): string {
  if (threat?.etaMin === 0) return "teraz";
  if (threat?.etaMin != null) {
    const wall = wallClockMin(threat.etaMin, ageMin);
    return wall === 0 ? "teraz" : `${wall} min`;
  }
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

/** Echo distance on the sheet. Em dash while scanning — "brak" while loading reads as all-clear. */
export function echoLabel(threat: Threat | null): string {
  if (!threat) return "—";
  if (threat.nearestKm != null) return `${threat.nearestKm.toFixed(0)} km`;
  return "brak";
}

/**
 * Four nowcast words, uppercased by the Badge: TERAZ / ZARAZ / BLISKO / CZYSTO.
 * `watch` is IMGW-only, and `nowcastHeadline` already forces its headline to
 * Czysto — the chip must not contradict it. The warning itself is the IMGW lane.
 */
const LEVEL_CHIP: Record<ThreatLevel, string> = {
  now: "teraz",
  imminent: "zaraz",
  nearby: "blisko",
  watch: "czysto",
  clear: "czysto",
};

export function threatLevelChip(level: ThreatLevel): string {
  return LEVEL_CHIP[level];
}

export type SheetDetent = "peek" | "half" | "full";

export const SHEET_PEEK_PX = 128;
export const SHEET_HALF_VH = 0.45;
export const SHEET_FULL_VH = 0.85;
export const SHEET_FIT_GAP_PX = 24;
export const SHEET_EDGE_PAD_PX = 90;

export const SHEET_DETENT_CLASS: Record<SheetDetent, string> = {
  peek: "max-h-[128px] overflow-hidden",
  half: "max-h-[45dvh] overflow-hidden",
  full: "max-h-[85dvh] overflow-hidden",
};

/**
 * Za ile is the hero; Szansa supports it. One scale for peek and for the
 * expanded sheet, so opening the card adds rows instead of resizing the answer.
 * sm+ is a standalone card with room for the wider hero.
 */
export const SHEET_NUMBER_CLASS = {
  hero: "font-mono text-3xl leading-none tracking-tight tabular-nums sm:text-4xl",
  sub: "font-mono text-lg leading-none tabular-nums text-muted",
} as const;

/** Same scale in px, so a test can assert the hierarchy instead of reading Tailwind. */
export const SHEET_NUMBER_PX = { hero: 30, heroWide: 36, sub: 18 } as const;

/**
 * The long tail (pin honesty, credit, O danych, rain legend) waits for `full`.
 * `half` is the answer plus the two-sentence box and one caveat; sm+ is one card
 * and always shows everything, so the gate is a class, not a JS media query.
 */
export function sheetExtrasClass(detent: SheetDetent): string {
  return detent === "full" ? "" : "hidden sm:block";
}

/** Facts the two-sentence box, the headline or the hero numbers already print. */
const CAVEAT_DUPLICATE = [
  /^Idzie od /,
  /^Echo /,
  /^Dojście /,
  /^Opad jest .*teraz/,
  /szansa[^.]*~\s*\d+\s*%/i,
];

const SHEET_CAVEAT_MAX_SENTENCES = 2;

/**
 * Sentence boundary that survives Polish nowcast copy: "echo ok. 13 km" and
 * "za ~20 min." are one sentence, so a break needs a capital after the dot.
 */
const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-ZŁŚŻĆÓĘĄŃ])/;

/**
 * The box *is* the copy; the caveat carries only what the box does not — in-situ
 * growth, miss distance, "to ruch echa". Drops the sentences that would print a
 * second time and keeps at most two, so `half` stays one screen.
 */
export function sheetCaveat(detail: string | null | undefined): string | null {
  if (!detail) return null;
  const kept = detail
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !CAVEAT_DUPLICATE.some((re) => re.test(s)));
  if (kept.length === 0) return null;
  if (kept.length > SHEET_CAVEAT_MAX_SENTENCES) {
    return [kept[0], kept[kept.length - 1]].join(" ");
  }
  return kept.join(" ");
}

const DETENT_ORDER: SheetDetent[] = ["peek", "half", "full"];

/** Mobile now/imminent opens the half detent, not full/70dvh. Desktop stays peek. */
export function autoExpandDetent(
  level: ThreatLevel | undefined,
  desktop: boolean,
): SheetDetent | null {
  if (desktop) return null;
  if (level === "imminent" || level === "now") return "half";
  return null;
}

export function shouldAutoExpandSheet(level: ThreatLevel | undefined, desktop: boolean): boolean {
  return autoExpandDetent(level, desktop) !== null;
}

export function sheetHeightPx(detent: SheetDetent, viewportH: number): number {
  if (detent === "peek") return SHEET_PEEK_PX;
  if (detent === "half") return Math.round(viewportH * SHEET_HALF_VH);
  return Math.round(viewportH * SHEET_FULL_VH);
}

/** `padding.bottom = sheetPx + 24`. Zero sheet (desktop) keeps the old 90 all around. */
export function sheetFitPadding(sheetPx: number): {
  top: number;
  right: number;
  bottom: number;
  left: number;
} {
  const bottom = sheetPx > 0 ? sheetPx + SHEET_FIT_GAP_PX : SHEET_EDGE_PAD_PX;
  return {
    top: SHEET_EDGE_PAD_PX,
    right: SHEET_EDGE_PAD_PX,
    bottom,
    left: SHEET_EDGE_PAD_PX,
  };
}

/** Place-change `easeTo` offset: lift the centre by half the sheet. */
export function placeChangeOffset(sheetPx: number): [number, number] {
  return [0, sheetPx > 0 ? -sheetPx / 2 : 0];
}

export function nextSheetDetent(current: SheetDetent, dy: number): SheetDetent {
  const i = DETENT_ORDER.indexOf(current);
  if (dy > 32) return DETENT_ORDER[Math.max(0, i - 1)]!;
  if (dy < -32) return DETENT_ORDER[Math.min(DETENT_ORDER.length - 1, i + 1)]!;
  return current;
}

export function toggleSheetDetent(current: SheetDetent): SheetDetent {
  return current === "peek" ? "half" : "peek";
}

/** "Opad od 20:40 do 21:10, najsilniej ok. 20:55" — clocks, not a mute axis name. */
export function timelineAriaLabel(
  points: Array<Pick<TimelinePoint, "t" | "level" | "rate" | "unknown">>,
  radarTimeSec: number,
): string {
  const wet = points.filter((p) => p.level > 0 && !p.unknown);
  if (wet.length === 0) {
    const start = formatRadarClock(radarTimeSec + (points[0]?.t ?? 0) * 60);
    const end = formatRadarClock(radarTimeSec + (points.at(-1)?.t ?? 90) * 60);
    return `Brak opadu od ${start} do ${end}`;
  }
  const first = wet[0]!;
  const last = wet[wet.length - 1]!;
  const peak = wet.reduce((best, p) =>
    p.level > best.level || (p.level === best.level && p.rate > best.rate) ? p : best,
  );
  return `Opad od ${formatRadarClock(radarTimeSec + first.t * 60)} do ${formatRadarClock(radarTimeSec + last.t * 60)}, najsilniej ok. ${formatRadarClock(radarTimeSec + peak.t * 60)}`;
}

/** Clock plus intensity for a tapped bar — title tooltips never fire on touch. */
export function timelineBarReadout(
  point: Pick<TimelinePoint, "t" | "level" | "rate" | "unknown">,
  radarTimeSec: number,
): string {
  const clock = formatRadarClock(radarTimeSec + point.t * 60);
  if (point.unknown) return `${clock}: poza radarem`;
  if (point.level > 0) return `${clock}: ${levelLabelPl(point.level)}, ~${point.rate} mm/h`;
  return `${clock}: sucho`;
}

/** Nowcast lane only — IMGW never occupies the "nadciąga za 18 min" headline. */
export function nowcastHeadline(threat: Threat | null, pending: boolean): string {
  if (pending && !threat) return "Skanuję radar…";
  if (!threat) return "Brak danych";
  if (threat.level === "watch") return "Czysto";
  return threat.title;
}
