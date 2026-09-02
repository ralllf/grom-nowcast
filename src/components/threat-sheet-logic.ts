import type { CellTrend, Threat, ThreatLevel, TimelinePoint } from "@/lib/weather/types";
import { STALE_RADAR_MIN } from "../lib/weather/alerts.ts";
import { levelLabelPl } from "../lib/weather/palette.ts";
import { lightningCaption } from "../lib/weather/perun.ts";
import { IMGW_WARNINGS_UNAVAILABLE, RADAR_UNAVAILABLE } from "../lib/weather/snapshot.ts";
import { cellTrendCopy } from "../lib/weather/trend.ts";
import { formatRadarClock, radarAgeMin, wallClockMin } from "../lib/weather/wall-clock.ts";

export { lightningCaption };

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

const LEVEL_CHIP: Record<ThreatLevel, string> = {
  now: "teraz",
  imminent: "zaraz",
  nearby: "blisko",
  watch: "uwaga",
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
  peek: "max-h-[128px]",
  half: "max-h-[45dvh] overflow-hidden",
  full: "max-h-[85dvh] overflow-hidden",
};

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
