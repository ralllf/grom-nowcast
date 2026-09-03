import { X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import {
  autoExpandDetent,
  cellTrendLine,
  echoLabel,
  etaLabel,
  idzieOdEchoSuffix,
  idzieOdTowardSuffix,
  nextSheetDetent,
  nowcastHeadline,
  sheetCaveat,
  sheetExtrasClass,
  SHEET_CARD_CLASS,
  SHEET_CARD_GRID_CLASS,
  SHEET_CELL_ANSWER_CLASS,
  SHEET_CELL_BOX_CLASS,
  SHEET_CELL_FULL_CLASS,
  SHEET_CELL_STRIP_CLASS,
  SHEET_CREDIT_LINE,
  SHEET_DATA_DETAILS,
  SHEET_DETENT_CLASS,
  SHEET_NUMBER_CLASS,
  sheetPeekStatus,
  sheetSourceHonesty,
  sheetStatusRow,
  toggleSheetDetent,
  threatLevelChip,
  timelineAriaLabel,
  timelineBarReadout,
  type SheetDetent,
  type SheetStatusRow,
} from "@/components/threat-sheet-logic";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEVEL_SWATCH, levelLabelPl } from "@/lib/weather/palette";
import {
  nowCursorFrac,
  radarAgeMin,
  rewriteArrivalMinutes,
  wallClockAxisLabel,
} from "@/lib/weather/wall-clock";
import type {
  CellTrack,
  Place,
  RadarLevel,
  Threat,
  ThreatLevel,
  TimelinePoint,
} from "@/lib/weather/types";

const TONE: Record<ThreatLevel, "ok" | "warn" | "danger" | "accent" | "mute"> = {
  clear: "ok",
  watch: "warn",
  nearby: "accent",
  imminent: "danger",
  now: "danger",
};

const PANEL: Record<ThreatLevel, string> = {
  clear: "border-ok/30",
  watch: "border-warn/40",
  nearby: "border-accent/40",
  imminent: "border-danger/50",
  now: "border-danger",
};

const SM_UP = "(min-width: 640px)";

type Props = {
  place: Place;
  threat: Threat | null;
  pending: boolean;
  error: boolean;
  tracks: CellTrack[];
  /** Time-boxed IMGW lane — never the nowcast headline. */
  imgwLine?: string | null;
  warningsUnavailable?: boolean;
  radarUnavailable?: boolean;
  geoError: string | null;
  onClearGeoError: () => void;
  onShowRainMotion: () => void;
  /** Latest radar scan, unix seconds. `null` = no radar. */
  radarTime: number | null;
  /** True when the PERUN download bounced — folded into the status row. */
  lightningUnavailable?: boolean;
  /** Browser offline, or a snapshot fetch that failed as offline. */
  offline?: boolean;
  onDetentChange?: (detent: SheetDetent) => void;
};

export function ThreatSheet({
  place,
  threat,
  pending,
  error,
  tracks,
  imgwLine = null,
  warningsUnavailable = false,
  radarUnavailable = false,
  geoError,
  onClearGeoError,
  onShowRainMotion,
  radarTime,
  lightningUnavailable = false,
  offline = false,
  onDetentChange,
}: Props) {
  const [detent, setDetent] = useState<SheetDetent>("peek");
  const autoKey = useRef<string | null>(null);
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);
  const open = detent !== "peek";
  const extrasClass = sheetExtrasClass(detent);
  const onDetentChangeRef = useRef(onDetentChange);
  onDetentChangeRef.current = onDetentChange;
  const onShowRainMotionRef = useRef(onShowRainMotion);
  onShowRainMotionRef.current = onShowRainMotion;

  function applyDetent(next: SheetDetent) {
    if (next === detent) return;
    setDetent(next);
    onDetentChangeRef.current?.(next);
  }

  const nowMs = Date.now();
  const ageMin = radarAgeMin(radarTime, nowMs);
  const eta = etaLabel(threat, ageMin);
  const detail = threat ? rewriteArrivalMinutes(threat.detail, threat.etaMin, ageMin) : null;
  const caveat = sheetCaveat(detail);
  const echo = echoLabel(threat);
  const chance = threat ? `${threat.chancePct}%` : "—";
  const headline = nowcastHeadline(threat, pending);
  const trendLine = cellTrendLine(threat?.cellTrend);
  const honesty = sheetSourceHonesty({
    queryError: error,
    radarUnavailable,
    warningsUnavailable,
  });
  const statusRow = sheetStatusRow({
    radarTime,
    nowMs,
    radarUnavailable,
    queryError: error,
    warningsUnavailable,
    lightningUnavailable,
    offline,
  });
  const peekStatus = sheetPeekStatus(statusRow, offline);
  const strip = threat && threat.timeline.length > 0 && radarTime != null ? threat.timeline : null;

  useEffect(() => {
    const desktop = window.matchMedia(SM_UP).matches;
    const target = autoExpandDetent(threat?.level, desktop);
    if (!target) return;
    const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)}:${threat?.level}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    applyDetent(target);
    onShowRainMotionRef.current();
  }, [place.lat, place.lon, threat?.level]);

  function onHandlePointerDown(e: PointerEvent<HTMLButtonElement>) {
    startY.current = e.clientY;
    dragged.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onHandlePointerMove(e: PointerEvent<HTMLButtonElement>) {
    if (startY.current == null) return;
    if (Math.abs(e.clientY - startY.current) > 16) dragged.current = true;
  }

  function onHandlePointerUp(e: PointerEvent<HTMLButtonElement>) {
    if (startY.current == null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    applyDetent(nextSheetDetent(detent, dy));
  }

  function onHandleClick() {
    if (dragged.current) return;
    applyDetent(toggleSheetDetent(detent));
  }

  return (
    <article
      id="grom-threat-sheet"
      className={cn(
        "pointer-events-auto border bg-surface/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md",
        "flex flex-col rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:block sm:rounded-3xl sm:p-5 sm:pb-5",
        SHEET_DETENT_CLASS[detent],
        detent === "peek" && "min-h-24",
        SHEET_CARD_CLASS,
        threat ? PANEL[threat.level] : "border-transparent",
      )}
    >
      <button
        type="button"
        className="flex w-full shrink-0 touch-none flex-col items-stretch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 sm:hidden"
        aria-expanded={open}
        aria-controls="grom-threat-sheet"
        aria-label={headline}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onClick={onHandleClick}
      >
        <span className="mx-auto mt-1.5 mb-0.5 h-1 w-10 rounded-full bg-faint" aria-hidden />
        {!open ? (
          // Every row here is measured: headline, place, hero and strip fit 128px.
          <div className="px-4 pb-1.5 text-left">
            <Answer
              headline={headline}
              place={place}
              threat={threat}
              eta={eta}
              chance={chance}
              status={peekStatus}
              points={strip}
              radarTime={radarTime}
              ageMin={ageMin}
            />
          </div>
        ) : null}
      </button>

      <div
        className={cn(
          // The phone sheet is the only scroller. On sm+ this block is the card
          // itself: two columns that grow with the content, no nested scroll.
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4",
          !open && "hidden",
          "sm:overflow-visible sm:p-0",
          SHEET_CARD_GRID_CLASS,
        )}
      >
        <Answer
          interactive
          headline={headline}
          place={place}
          threat={threat}
          eta={eta}
          chance={chance}
          points={strip}
          radarTime={radarTime}
          ageMin={ageMin}
          extrasClass={extrasClass}
          cellClass={SHEET_CELL_ANSWER_CLASS}
          stripClass={SHEET_CELL_STRIP_CLASS}
        />

        {threat && (threat.comingFrom || threat.expect || trendLine || threat.nearestKm != null) ? (
          <div
            className={cn(
              "mt-2.5 space-y-1 rounded-2xl bg-surface-2 px-3 py-2.5 text-sm leading-relaxed",
              SHEET_CELL_BOX_CLASS,
            )}
          >
            {threat.comingFrom ? (
              <p>
                <span className="text-faint">Idzie od </span>
                <span className="font-medium">{threat.comingFrom}</span>
                {threat.toward ? (
                  <span className="text-muted">{idzieOdTowardSuffix(threat.toward)}</span>
                ) : null}
                {threat.speedKmh ? (
                  <span className="text-muted"> · {Math.round(threat.speedKmh)} km/h</span>
                ) : null}
                <span className="text-muted">{idzieOdEchoSuffix(threat.nearestKm)}</span>
              </p>
            ) : threat.nearestKm != null ? (
              <p>
                <span className="text-faint">Echo </span>
                <span className="font-medium">{echo}</span>
              </p>
            ) : null}
            {threat.expect ? (
              <p>
                <span className="text-faint">Spodziewaj się: </span>
                <span className="font-medium">{threat.expect}</span>
              </p>
            ) : null}
            {trendLine ? (
              <p>
                <span className="font-medium">{trendLine}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-2.5 max-w-prose text-sm leading-relaxed text-muted text-pretty sm:col-span-2 sm:mt-0">
          {honesty.radar ?? caveat}
        </p>

        {imgwLine ? (
          <p className="mt-3 text-xs leading-relaxed text-warn sm:col-span-2 sm:mt-0">{imgwLine}</p>
        ) : null}

        {statusRow ? (
          <p
            className={cn(
              statusRow.tone === "warn" ? "mt-3 text-xs text-warn" : "mt-3 text-xs text-faint",
              SHEET_CELL_FULL_CLASS,
            )}
          >
            {statusRow.text}
          </p>
        ) : null}

        {geoError ? (
          <p className="mt-3 flex items-start justify-between gap-2 text-xs text-warn sm:col-span-2 sm:mt-0">
            <span>{geoError}</span>
            <button
              type="button"
              className="shrink-0 text-faint hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
              onClick={onClearGeoError}
              aria-label="Zamknij komunikat"
            >
              <X className="size-3.5" />
            </button>
          </p>
        ) : null}

        {tracks.length > 0 && (threat?.nearestKm == null || threat.nearestKm > 25) ? (
          <button
            type="button"
            onClick={onShowRainMotion}
            className={cn(
              "mt-3 flex min-h-9 w-full items-center justify-center rounded-xl bg-surface-2 px-3 text-xs font-medium text-accent hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50",
              extrasClass,
              SHEET_CELL_FULL_CLASS,
              "sm:flex",
            )}
          >
            Pokaż ruch opadu na mapie
            {threat?.nearestKm != null ? ` · ${threat.nearestKm.toFixed(0)} km` : ""}
          </button>
        ) : null}

        {/* One summary line carries the whole tail, so the card fits the page. */}
        <details
          className={cn("mt-3 text-xs leading-relaxed text-faint", extrasClass, SHEET_CELL_FULL_CLASS)}
        >
          <summary className="cursor-pointer list-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 [&::-webkit-details-marker]:hidden">
            O danych ›
          </summary>
          <p className="mt-1.5">
            Szansa, Za ile i alert są dla pinezki ({place.label}) — miasta albo punktu na mapie — nie
            dla koła w okolicy. Próg alertu to czas, nie dystans. Na mapie strzałki to pole ruchu;
            te, które dotyczą pinezki, mówią czy opad dojdzie.
          </p>
          <p className="mt-2">{SHEET_CREDIT_LINE}</p>
          <p className="mt-2">{SHEET_DATA_DETAILS}</p>
        </details>
      </div>
    </article>
  );
}

/**
 * The 3-second answer: headline, level chip, place, Za ile as the hero, Szansa,
 * 90-min strip. Peek and the expanded sheet render the same block, so opening
 * the card adds rows below instead of resizing the answer. Two grid items —
 * the headline group and the strip — so the sm+ card can put them side by side.
 */
function Answer({
  headline,
  place,
  threat,
  eta,
  chance,
  status = null,
  points,
  radarTime,
  ageMin,
  interactive = false,
  extrasClass = "",
  cellClass = "",
  stripClass = "",
}: {
  headline: string;
  place: Place;
  threat: Threat | null;
  eta: string;
  chance: string;
  status?: SheetStatusRow | null;
  points: TimelinePoint[] | null;
  radarTime: number | null;
  ageMin: number;
  interactive?: boolean;
  extrasClass?: string;
  /** Grid placement of the headline / hero group on the sm+ card. */
  cellClass?: string;
  /** Grid placement of the strip — the right column on the sm+ card. */
  stripClass?: string;
}) {
  return (
    <>
      <div className={cn("min-w-0", cellClass)}>
        <div className="flex items-start justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-lg font-semibold leading-none tracking-tight sm:text-2xl">
            {headline}
          </h2>
          {threat ? (
            <Badge tone={TONE[threat.level]} className="shrink-0 px-2 py-0.5 leading-none">
              {threatLevelChip(threat.level)}
            </Badge>
          ) : null}
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-xs leading-none">
          <p className="min-w-0 truncate text-muted">{place.label}</p>
          {status ? (
            <p
              className={cn("min-w-0 truncate", status.tone === "warn" ? "text-warn" : "text-faint")}
            >
              {status.text}
            </p>
          ) : null}
        </div>
        <dl className="mt-1 flex items-baseline justify-between gap-3 sm:mt-2 sm:justify-start sm:gap-8">
          <div className="flex min-w-0 items-baseline gap-2">
            <dt className="order-2 text-xs leading-none text-faint">Za ile</dt>
            <dd className={cn("order-1", SHEET_NUMBER_CLASS.hero)}>{eta}</dd>
          </div>
          <div className="flex shrink-0 items-baseline gap-1.5">
            <dt className="text-xs leading-none text-faint">Szansa</dt>
            <dd className={SHEET_NUMBER_CLASS.sub}>{chance}</dd>
          </div>
        </dl>
      </div>
      {points && radarTime != null ? (
        <Strip
          points={points}
          advected={threat?.timelineAdvected ?? false}
          radarTime={radarTime}
          ageMin={ageMin}
          interactive={interactive}
          extrasClass={extrasClass}
          className={cn(interactive ? "mt-2 sm:mt-0" : "mt-1", stripClass)}
        />
      ) : null}
    </>
  );
}

const LEGEND: Array<{ level: RadarLevel; range: string }> = [
  { level: 1, range: "<1" },
  { level: 2, range: "1–4" },
  { level: 3, range: "4–10" },
  { level: 4, range: ">10" },
];

/**
 * MeteoSwiss-style strip: rain at the pin for the next 90 min, one bar per 5 min.
 * Peek gets the static version — a second scroller or a nested button inside the
 * drag handle is exactly what made the old card feel like a dashboard.
 */
function Strip({
  points,
  advected = false,
  radarTime,
  ageMin,
  interactive = false,
  extrasClass = "",
  className,
}: {
  points: TimelinePoint[];
  advected?: boolean;
  radarTime: number;
  ageMin: number;
  interactive?: boolean;
  extrasClass?: string;
  className?: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const any = points.some((p) => p.level > 0);
  const aria = timelineAriaLabel(points, radarTime);
  const pickedPoint = picked != null ? points.find((p) => p.t === picked) : undefined;
  return (
    <div className={cn(interactive && "rounded-2xl bg-surface-2 px-3 py-2", className)}>
      {interactive ? (
        <div
          className={cn(
            "flex flex-wrap items-baseline justify-between gap-x-2 text-xs text-faint",
            // extrasClass carries `hidden`, which cn() resolves against `flex`.
            // Re-assert the row's display or the card lays this out as a block.
            extrasClass,
            "sm:flex",
          )}
        >
          <span className="whitespace-nowrap">Opad nad pinezką · 90 min</span>
          <span className="whitespace-nowrap">
            {advected ? "z ruchu echa" : "bez ruchu — jak teraz"}
          </span>
        </div>
      ) : null}
      <div className={cn("relative", interactive && "sm:mt-2")}>
        <div
          className={cn("flex items-end gap-px", interactive ? "h-6 sm:h-8" : "h-3")}
          role="img"
          aria-label={aria}
        >
          {points.map((p) => {
            const readout = timelineBarReadout(p, radarTime);
            const height = p.level > 0 ? `${25 + p.level * 18}%` : "4px";
            const background = p.level > 0 ? LEVEL_SWATCH[p.level] : "var(--color-border)";
            return interactive ? (
              <button
                key={p.t}
                type="button"
                aria-label={readout}
                aria-pressed={picked === p.t}
                onClick={() => setPicked((cur) => (cur === p.t ? null : p.t))}
                className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
                style={{ height, backgroundColor: background }}
              />
            ) : (
              <span
                key={p.t}
                aria-hidden
                className="min-w-0 flex-1 rounded-sm"
                style={{ height, backgroundColor: background }}
              />
            );
          })}
        </div>
        <span
          data-now-cursor
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-px bg-fg"
          style={{ left: `${nowCursorFrac(ageMin) * 100}%` }}
        />
      </div>
      {interactive && pickedPoint ? (
        <p className="mt-1 font-mono text-xs tabular-nums text-muted">
          {timelineBarReadout(pickedPoint, radarTime)}
        </p>
      ) : null}
      <div
        data-timeline-axis
        className={cn(
          "flex justify-between font-mono text-xs leading-none tabular-nums text-faint",
          interactive ? "mt-1" : "mt-0.5",
        )}
      >
        <span>{wallClockAxisLabel(0, radarTime)}</span>
        <span>{wallClockAxisLabel(30, radarTime)}</span>
        <span>{wallClockAxisLabel(60, radarTime)}</span>
        <span>{wallClockAxisLabel(90, radarTime)}</span>
      </div>
      {interactive ? (
        <div
          className={cn(
            "mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint",
            extrasClass,
            "sm:flex",
          )}
        >
          {LEGEND.map((l) => (
            <span key={l.level} className="inline-flex items-center gap-1">
              <span
                className="inline-block size-2 rounded-sm"
                style={{ backgroundColor: LEVEL_SWATCH[l.level] }}
              />
              {levelLabelPl(l.level)} {l.range}
            </span>
          ))}
          {!any ? <span className="ml-auto">nic w oknie 90 min</span> : null}
        </div>
      ) : null}
    </div>
  );
}
