import { MapPin, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { etaLabel, nowcastHeadline, shouldAutoExpandSheet } from "@/components/threat-sheet-logic";
import { IMGW_WARNINGS_UNAVAILABLE } from "@/lib/weather/snapshot";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LEVEL_SWATCH, levelLabelPl } from "@/lib/weather/palette";
import {
  radarAgeCaption,
  radarAgeMin,
  rewriteArrivalMinutes,
  wallClockAxisLabel,
  wallClockMin,
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
  geoError: string | null;
  onClearGeoError: () => void;
  onShowRainMotion: () => void;
  /** Latest radar scan, unix seconds. `null` = no radar. */
  radarTime: number | null;
  analysisSource?: "sri" | "rainviewer";
};

export function ThreatSheet({
  place,
  threat,
  pending,
  error,
  tracks,
  imgwLine = null,
  warningsUnavailable = false,
  geoError,
  onClearGeoError,
  onShowRainMotion,
  radarTime,
  analysisSource = "rainviewer",
}: Props) {
  const [open, setOpen] = useState(false);
  const autoKey = useRef<string | null>(null);
  const startY = useRef<number | null>(null);
  const dragged = useRef(false);

  const nowMs = Date.now();
  const ageMin = radarAgeMin(radarTime, nowMs);
  const eta = etaLabel(threat, ageMin);
  const radarCaption = radarAgeCaption(radarTime, nowMs, analysisSource);
  const detail = threat ? rewriteArrivalMinutes(threat.detail, threat.etaMin, ageMin) : null;
  const echo = threat?.nearestKm != null ? `${threat.nearestKm.toFixed(0)} km` : "brak";
  const echoFull =
    threat?.nearestKm != null
      ? `${echo}${threat.pinLevel > 0 ? ` · ${levelLabelPl(threat.pinLevel)}` : ""}`
      : echo;
  const chance = threat ? `${threat.chancePct}%` : "—";
  const headline = nowcastHeadline(threat, pending);

  useEffect(() => {
    const desktop = window.matchMedia(SM_UP).matches;
    if (!shouldAutoExpandSheet(threat?.level, desktop)) return;
    const key = `${place.lat.toFixed(3)},${place.lon.toFixed(3)}:${threat?.level}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    setOpen(true);
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
    if (dy > 32) setOpen(false);
    else if (dy < -32) setOpen(true);
  }

  function onHandleClick() {
    if (dragged.current) return;
    setOpen((v) => !v);
  }

  return (
    <article
      id="grom-threat-sheet"
      className={cn(
        "pointer-events-auto border bg-surface/90 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md",
        "flex flex-col rounded-t-3xl pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:block sm:rounded-3xl sm:p-5 sm:pb-5",
        open ? "max-h-[70dvh] overflow-hidden" : "min-h-24",
        "sm:min-h-0 sm:max-h-none sm:overflow-visible",
        threat ? PANEL[threat.level] : "border-transparent",
      )}
    >
      <button
        type="button"
        className="flex w-full shrink-0 touch-none flex-col items-stretch sm:hidden"
        aria-expanded={open}
        aria-controls="grom-threat-sheet"
        aria-label={headline}
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        onClick={onHandleClick}
      >
        <span className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-faint" aria-hidden />
        {!open ? (
          <div className="flex items-end justify-between gap-3 px-4 pt-1 pb-3">
            <div className="min-w-0 text-left">
              <h2 className="truncate font-display text-xl font-semibold leading-none tracking-tight">
                {headline}
              </h2>
              <p className="mt-1.5 truncate text-sm text-muted">{place.label}</p>
              {imgwLine ? (
                <p className="mt-0.5 truncate text-[11px] text-warn">{imgwLine}</p>
              ) : null}
            </div>
            <dl className="flex shrink-0 gap-3 text-center">
              <PeekStat label="Szansa" value={chance} />
              <PeekStat label="ETA" value={eta} />
              <PeekStat label="Echo" value={echo} />
            </dl>
          </div>
        ) : null}
      </button>

      <div
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overscroll-contain p-4",
          !open && "hidden",
          "sm:block sm:overflow-visible sm:p-0",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="size-4 text-accent" />
              <p className="text-sm font-medium">{place.label}</p>
              {place.terc ? (
                <span className="font-mono text-xs text-faint">TERYT {place.terc}</span>
              ) : null}
            </div>
            <h2 className="mt-2 font-display text-3xl font-semibold leading-none tracking-tight text-balance">
              {headline}
            </h2>
          </div>
          {threat ? <Badge tone={TONE[threat.level]}>{threat.level}</Badge> : null}
        </div>

        {threat?.comingFrom || threat?.expect ? (
          <div className="mt-3 space-y-1.5 rounded-2xl bg-surface-2 px-3 py-3 text-sm leading-relaxed">
            {threat.comingFrom ? (
              <p>
                <span className="text-faint">Idzie od </span>
                <span className="font-medium">{threat.comingFrom}</span>
                {threat.toward ? <span className="text-muted"> → na {threat.toward}</span> : null}
                {threat.speedKmh ? (
                  <span className="font-mono text-xs text-muted">
                    {" "}
                    · {Math.round(threat.speedKmh)} km/h
                  </span>
                ) : null}
              </p>
            ) : null}
            {threat.expect ? (
              <p>
                <span className="text-faint">Spodziewaj się: </span>
                <span className="font-medium">{threat.expect}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted text-pretty">
          {error
            ? "Nie udało się pobrać radaru albo ostrzeżeń. Spróbuj za chwilę."
            : (detail ?? threat?.detail)}
        </p>

        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Szansa" value={chance} />
          <Stat label="ETA" value={eta} />
          <Stat label="Echo" value={echoFull} />
        </dl>

        {radarCaption ? (
          <p className="mt-2 text-center font-mono text-[11px] text-faint">{radarCaption}</p>
        ) : null}

        {threat && threat.timeline.length > 0 ? (
          <Timeline points={threat.timeline} advected={threat.timelineAdvected} ageMin={ageMin} />
        ) : null}

        {tracks.length > 0 && (threat?.nearestKm == null || threat.nearestKm > 25) ? (
          <button
            type="button"
            onClick={onShowRainMotion}
            className="mt-3 w-full rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-accent hover:text-fg"
          >
            Pokaż ruch opadu na mapie
            {threat?.nearestKm != null ? ` · ${threat.nearestKm.toFixed(0)} km` : ""}
          </button>
        ) : null}

        <p className="mt-3 text-xs leading-relaxed text-faint">
          Szansa i ETA są dla pinezki ({place.label}) — miasta albo punktu GPS — nie dla całego
          promienia. Na mapie jedna albo dwie strzałki — te, które dotyczą pinezki, nie cały front.
          Promień w ustawieniach mówi tylko, jak daleko wołamy alert.
        </p>

        {warningsUnavailable ? (
          <p className="mt-3 text-xs text-warn">{IMGW_WARNINGS_UNAVAILABLE}</p>
        ) : imgwLine ? (
          <p className="mt-3 text-xs leading-relaxed text-warn">{imgwLine}</p>
        ) : null}

        {geoError ? (
          <p className="mt-3 flex items-start justify-between gap-2 text-xs text-warn">
            <span>{geoError}</span>
            <button
              type="button"
              className="shrink-0 text-faint hover:text-fg"
              onClick={onClearGeoError}
              aria-label="Zamknij komunikat"
            >
              <X className="size-3.5" />
            </button>
          </p>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-faint">
          Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i Gospodarki Wodnej –
          Państwowy Instytut Badawczy. Dane radarowe zostały przetworzone (SRI mm/h IMGW, siatka
          ~3 km; RainViewer dBZ → Marshall–Palmer gdy SRI niedostępne). Analiza: IMGW COMPO_SRI.
          Mapa: RainViewer / OpenFreeMap / OSM. To nie jest oficjalny alert RCB. Komórka burzowa
          może powstać lokalnie nawet przy czystym radarze.
        </p>
      </div>
    </article>
  );
}

const LEGEND: Array<{ level: RadarLevel; range: string }> = [
  { level: 1, range: "<1" },
  { level: 2, range: "1–4" },
  { level: 3, range: "4–10" },
  { level: 4, range: ">10" },
];

/** MeteoSwiss-style strip: rain at the pin for the next 90 min, one bar per 5 min. */
function Timeline({
  points,
  advected,
  ageMin,
}: {
  points: TimelinePoint[];
  advected: boolean;
  ageMin: number;
}) {
  const any = points.some((p) => p.level > 0);
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-faint">Opad nad pinezką · 90 min · mm/h</span>
        <span className="text-faint">{advected ? "z ruchu echa" : "bez ruchu — jak teraz"}</span>
      </div>
      <div className="mt-2 flex h-9 items-end gap-px" role="img" aria-label="Oś czasu opadu">
        {points.map((p) => {
          const wall = wallClockMin(p.t, ageMin);
          const when = wall === 0 ? "teraz" : `+${wall} min`;
          return (
            <div
              key={p.t}
              title={`${when}: ${p.level > 0 ? `${levelLabelPl(p.level)}, ~${p.rate} mm/h` : "sucho"}`}
              className="flex-1 rounded-sm"
              style={{
                height: p.level > 0 ? `${25 + p.level * 18}%` : "4px",
                backgroundColor: p.level > 0 ? LEVEL_SWATCH[p.level] : "var(--color-border)",
              }}
            />
          );
        })}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
        <span>{wallClockAxisLabel(0, ageMin)}</span>
        <span>{wallClockAxisLabel(30, ageMin)}</span>
        <span>{wallClockAxisLabel(60, ageMin)}</span>
        <span>{wallClockAxisLabel(90, ageMin, true)}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-faint">
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
    </div>
  );
}

function PeekStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[2.75rem]">
      <dt className="text-[10px] uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-0.5 font-mono text-xs tabular-nums">{value}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-3">
      <dt className="text-xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
