import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Crosshair,
  Radar,
  Search,
  Settings2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadarMap } from "@/components/radar-map";
import { ThreatSheet } from "@/components/threat-sheet";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/weather/cities";
import { haversineKm } from "@/lib/weather/geo";
import { formatImgwRange } from "@/lib/weather/imgw-time";
import { localImgwLane, stormWarningDegrees } from "@/lib/weather/imgw-lane";
import { framesFromScan } from "@/lib/weather/pack";
import { historyIsDegraded } from "@/lib/weather/radar-history";
import { lightningCaption } from "@/lib/weather/perun";
import { PL_RADAR_ORIGIN } from "@/lib/weather/radar-grid";
import { overlayFallback } from "@/lib/weather/sri-overlay";
import { getSnapshot, getSriOverlay, searchPlaces } from "@/lib/weather/server";
import { canTrustRadar, IMGW_WARNINGS_UNAVAILABLE } from "@/lib/weather/snapshot";
import { computeThreat } from "@/lib/weather/threat";
import {
  ALERT_PRESET_ORDER,
  ALERT_PRESETS,
  alertPresetPatch,
  evaluateAlert,
  isQuietHour,
  levelSettingLabelPl,
  matchAlertPreset,
  testAlertEvent,
  type AlertEvent,
  type AlertKind,
} from "@/lib/weather/alerts";
import {
  deliverAlert,
  notifyPermission,
  primeSound,
  requestNotifyPermission,
  stopTitleFlash,
  type NotifyPermission,
} from "@/lib/alert-delivery";
import type { Place } from "@/lib/weather/types";
import { useGrom } from "@/lib/store";

function formatClock(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ALERT_TONE: Record<AlertKind, string> = {
  incoming: "border-warn/60 bg-surface/95",
  now: "border-danger bg-surface/95",
  allclear: "border-ok/60 bg-surface/95",
};

function AlertIcon({ kind }: { kind: AlertKind }) {
  if (kind === "now") return <CloudLightning className="size-5 text-danger" />;
  if (kind === "allclear") return <CheckCircle2 className="size-5 text-ok" />;
  return <CloudRain className="size-5 text-warn" />;
}

function formatAlertTime(ms: number) {
  return new Date(ms).toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

function shallowEqual<T extends object>(a: T, b: T) {
  const ka = Object.keys(a) as (keyof T)[];
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

function isEmbeddedPreview() {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function GromApp() {
  const place = useGrom((s) => s.place);
  const alerts = useGrom((s) => s.alerts);
  const activeAlert = useGrom((s) => s.activeAlert);
  const alertLog = useGrom((s) => s.alertLog);
  const setPlace = useGrom((s) => s.setPlace);
  const updatePlaceMeta = useGrom((s) => s.updatePlaceMeta);
  const imgwMap = useGrom((s) => s.imgwMap);
  const setImgwMap = useGrom((s) => s.setImgwMap);
  const drizzleMap = useGrom((s) => s.drizzleMap);
  const setDrizzleMap = useGrom((s) => s.setDrizzleMap);
  const setAlerts = useGrom((s) => s.setAlerts);
  const setAlertMemory = useGrom((s) => s.setAlertMemory);
  const recordAlert = useGrom((s) => s.recordAlert);
  const dismissAlert = useGrom((s) => s.dismissAlert);
  const clearAlertLog = useGrom((s) => s.clearAlertLog);
  const alertPreset = matchAlertPreset(alerts);
  const [permission, setPermission] = useState<NotifyPermission>("default");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoHint, setGeoHint] = useState<string | null>(null);
  const [frameIndex, setFrameIndex] = useState<number | null>(null);
  const [geoPending, setGeoPending] = useState(false);
  const [focus, setFocus] = useState<{
    token: number;
    lat: number;
    lon: number;
    pinLat: number;
    pinLon: number;
  } | null>(null);
  const ignoreMapClickUntil = useRef(0);

  useEffect(() => {
    useGrom.getState().hydrate();
    setPermission(notifyPermission());
  }, []);

  const snapshotQuery = useQuery({
    // National radar field — pin must not change the query key / motion arrows.
    queryKey: ["snapshot"],
    queryFn: () => {
      const p = useGrom.getState().place;
      return getSnapshot({
        data: {
          lat: p.lat,
          lon: p.lon,
          place: p,
        },
      });
    },
    refetchInterval: 90_000,
    // Alerts only work while the tab is open — keep polling when it is in the background.
    refetchIntervalInBackground: true,
  });

  const snapshot = snapshotQuery.data;

  const { refetch: refetchSnapshot } = snapshotQuery;

  // Resolve TERYT / label for a bare map pin without changing the radar query key.
  useEffect(() => {
    if (place.terc) return;
    void refetchSnapshot();
  }, [place.lat, place.lon, place.terc, refetchSnapshot]);

  useEffect(() => {
    if (!snapshot?.place.terc || place.terc) return;
    if (haversineKm(snapshot.place.lat, snapshot.place.lon, place.lat, place.lon) < 3) {
      updatePlaceMeta(snapshot.place);
    }
  }, [snapshot, place, updatePlaceMeta]);

  const radarHistory = useMemo(() => (snapshot ? framesFromScan(snapshot.radar) : []), [snapshot]);

  const threat = useMemo(() => {
    if (!snapshot || !canTrustRadar(snapshot)) return null;
    const warnings = snapshot.warnings.map((w) => ({
      ...w,
      matchesPlace: place.terc ? w.teryt.includes(place.terc) : w.matchesPlace,
    }));
    return computeThreat(
      place,
      radarHistory,
      warnings,
      PL_RADAR_ORIGIN,
      snapshot.lightning,
    );
  }, [snapshot, radarHistory, place]);

  const radarDegraded = historyIsDegraded(radarHistory);

  // Coming back to the tab: fresh radar right away, stop nagging in the title.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      stopTitleFlash();
      void refetchSnapshot();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [refetchSnapshot]);

  // Alert engine: one step per threat snapshot. Memory is read from the store
  // (not a dependency) so a memory update never re-triggers this effect.
  const radarTime = snapshot?.radar.latestTime ?? null;
  useEffect(() => {
    if (!threat) return;
    const memory = useGrom.getState().alertMemory;
    const now = Date.now();
    const result = evaluateAlert(threat, alerts, memory, now, {
      placeLabel: place.label,
      radarTime,
      analysisSource: snapshot?.radar.analysisSource,
    });
    if (!shallowEqual(result.memory, memory)) setAlertMemory(result.memory);
    if (!result.event) return;
    recordAlert(result.event);
    deliverAlert(result.event, {
      sound: alerts.sound,
      quiet: isQuietHour(alerts, new Date(now)),
    });
  }, [threat, alerts, place.label, radarTime, snapshot?.radar.analysisSource, setAlertMemory, recordAlert]);

  const searchMut = useMutation({
    mutationFn: (q: string) => searchPlaces({ data: { query: q } }),
  });

  const past = snapshot?.radar.past ?? [];
  const overlays = snapshot?.radar.overlays ?? [];
  const slider = overlays.length > 0 ? overlays : past;
  const activeIdx = Math.min(frameIndex ?? Math.max(0, slider.length - 1), Math.max(0, slider.length - 1));
  const activeSlider = slider[activeIdx];
  const fallbackPath = (() => {
    if (overlays.length === 0) {
      return frameIndex !== null && past[frameIndex] ? past[frameIndex]!.path : (past.at(-1)?.path ?? null);
    }
    const t = activeSlider?.time;
    const match = t != null ? past.find((p) => Math.abs(p.time - t) < 6 * 60) : null;
    return match?.path ?? past.at(-1)?.path ?? null;
  })();

  const overlayQuery = useQuery({
    queryKey: ["sri-overlay", activeSlider?.time, drizzleMap],
    enabled: overlays.length > 0 && activeSlider?.time != null,
    queryFn: () => getSriOverlay({ data: { time: activeSlider!.time, drizzle: drizzleMap } }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });
  const overlayUrl = overlayQuery.data?.png
    ? `data:image/png;base64,${overlayQuery.data.png}`
    : null;
  const sliderCorners = overlays[activeIdx]?.corners ?? null;
  const layerPick = overlayFallback({
    overlaysAvailable: overlays.length > 0,
    png: overlayUrl,
    queryError: overlayQuery.isError,
    queryFetched: overlayQuery.isFetched,
    isPlaceholder: overlayQuery.isPlaceholderData,
  });
  const radarHost = layerPick.useRainviewer ? (snapshot?.radar.host ?? null) : null;
  const radarPath = layerPick.useRainviewer ? fallbackPath : null;
  const sriOverlayUrl = layerPick.useSri ? overlayUrl : null;
  const sriOverlayCorners = layerPick.useSri
    ? (overlayQuery.data?.corners ?? sliderCorners)
    : null;

  function locate() {
    if (isEmbeddedPreview() || !navigator.geolocation) {
      setGeoError(null);
      setGeoHint(
        "W tym podglądzie przeglądarka blokuje GPS. Wybierz miasto albo stuknij mapę — na telefonie, poza podglądem, celownik pobierze lokalizację.",
      );
      setSettingsOpen(true);
      return;
    }
    setGeoPending(true);
    setGeoError(null);
    setGeoHint(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoPending(false);
        setGeoError(null);
        setPlace({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          label: "Twoja lokalizacja",
        });
      },
      () => {
        setGeoPending(false);
        setGeoError("GPS niedostępny. Wybierz miasto albo kliknij mapę.");
        setSettingsOpen(true);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    );
  }

  async function enableAlerts() {
    primeSound();
    const perm = await requestNotifyPermission();
    setPermission(perm);
    // The in-app banner works without OS permission; the toggle is about alerts, not permission.
    setAlerts({ enabled: true });
  }

  function fireTestAlert() {
    primeSound();
    const ev = testAlertEvent(place.label, Date.now());
    recordAlert(ev);
    deliverAlert(ev, { sound: alerts.sound, quiet: false });
  }

  function pickPlace(next: Place) {
    ignoreMapClickUntil.current = Date.now() + 400;
    setGeoError(null);
    setGeoHint(null);
    setPlace(next);
    setQuery("");
    searchMut.reset();
    requestAnimationFrame(() => setSettingsOpen(false));
  }

  function showRainMotion() {
    const list = [...(threat?.tracks ?? [])];
    list.sort(
      (a, b) =>
        haversineKm(place.lat, place.lon, a.now.lat, a.now.lon) -
        haversineKm(place.lat, place.lon, b.now.lat, b.now.lon),
    );
    const cell = list.find((t) => t.threatening) ?? list[0] ?? threat?.track;
    if (!cell) return;
    setFocus({
      token: Date.now(),
      lat: cell.now.lat,
      lon: cell.now.lon,
      pinLat: place.lat,
      pinLon: place.lon,
    });
  }

  const warnings = useMemo(
    () =>
      (snapshot?.warnings ?? []).map((w) => ({
        ...w,
        matchesPlace: place.terc ? w.teryt.includes(place.terc) : false,
      })),
    [snapshot?.warnings, place.terc],
  );
  const localWarnings = warnings.filter((w) => w.matchesPlace);
  const shownWarnings = localWarnings.length > 0 ? localWarnings : warnings;
  const imgwDegrees = useMemo(() => stormWarningDegrees(snapshot?.warnings ?? []), [snapshot?.warnings]);
  const imgwLine = useMemo(
    () => localImgwLane(warnings, place.county),
    [warnings, place.county],
  );
  const tracks = threat?.tracks ?? [];
  const hasImgwTint = Object.keys(imgwDegrees).length > 0;

  return (
    <div className="relative h-dvh overflow-hidden bg-bg text-fg">
      <RadarMap
        className="absolute inset-0"
        lat={place.lat}
        lon={place.lon}
        radarHost={radarHost}
        radarPath={radarPath}
        overlayUrl={sriOverlayUrl}
        overlayCorners={sriOverlayCorners}
        tracks={tracks}
        imgwOn={imgwMap}
        imgwDegrees={imgwDegrees}
        strikes={snapshot?.lightning ?? []}
        focus={focus}
        onPick={(lat, lon) => {
          if (Date.now() < ignoreMapClickUntil.current) return;
          setGeoError(null);
          setGeoHint(null);
          setPlace({ lat, lon, label: "Punkt na mapie" });
        }}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-linear-to-t from-bg/50 to-transparent" />

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-5">
        <div className="mx-auto flex max-w-6xl items-start justify-between gap-3">
          <div className="pointer-events-auto rounded-2xl bg-surface/85 px-4 py-3 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
            <p className="font-display text-xs font-medium uppercase tracking-widest text-muted">
              Nowcast PL
            </p>
            <h1 className="font-display text-2xl font-semibold leading-none tracking-tight">
              GROM
            </h1>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <Button
              variant="subtle"
              size="icon"
              aria-label="Wybierz lokalizację"
              onClick={locate}
              disabled={geoPending}
            >
              <Crosshair className="size-5" />
            </Button>
            <Button
              variant="subtle"
              size="icon"
              aria-label="Ustawienia"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 className="size-5" />
            </Button>
          </div>
        </div>
      </header>

      {slider.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-3 sm:top-28">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-surface/85 px-4 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
            <Radar className="size-4 text-accent" />
            <input
              type="range"
              min={0}
              max={slider.length - 1}
              value={Math.min(frameIndex ?? slider.length - 1, slider.length - 1)}
              onChange={(e) => setFrameIndex(Number(e.target.value))}
              className="h-1 w-40 accent-accent sm:w-56"
              aria-label="Czas radaru"
            />
            <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">
              {formatClock(slider[activeIdx]?.time ?? null)}
            </span>
            {radarDegraded ? (
              <span className="text-[10px] text-faint" title="Brakowało kafelka radaru">
                niepełne
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeAlert ? (
        <div className="pointer-events-none absolute inset-x-0 top-36 z-20 flex justify-center px-3 sm:top-40">
          <div
            role="status"
            aria-live="assertive"
            className={cn(
              "pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-2xl border p-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md",
              ALERT_TONE[activeAlert.kind],
            )}
          >
            <div className="mt-0.5 shrink-0">
              <AlertIcon kind={activeAlert.kind} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-display text-base font-semibold leading-tight">
                {activeAlert.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted">{activeAlert.body}</p>
              <p className="mt-1 font-mono text-[11px] text-faint">
                {formatAlertTime(activeAlert.at)} · {activeAlert.placeLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissAlert}
              aria-label="Zamknij alert"
              className="shrink-0 rounded-full p-1 text-faint hover:bg-surface-2 hover:text-fg"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}

      {tracks.length > 0 || hasImgwTint || overlays.length > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute left-3 z-10 flex flex-col items-start gap-2 sm:left-5",
            // On phones the centered banner sits over the pill; on wider screens they do not touch.
            activeAlert ? "top-64 sm:top-40" : "top-36 sm:top-40",
          )}
        >
          {tracks.length > 0 ? (
            <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
              <span className="inline-block size-2.5 rounded-full bg-vector ring-2 ring-fg" />
              <span className="text-muted">tor komórki</span>
              <button
                type="button"
                className="font-medium text-accent hover:text-fg"
                onClick={showRainMotion}
              >
                pokaż
              </button>
            </div>
          ) : null}
          {hasImgwTint ? (
            <button
              type="button"
              aria-pressed={imgwMap}
              onClick={() => setImgwMap(!imgwMap)}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md"
            >
              <span
                className="inline-block size-2.5 rounded-sm ring-2 ring-fg"
                style={{ backgroundColor: imgwMap ? "#e4572e" : "#5c6570" }}
              />
              <span className={imgwMap ? "text-fg" : "text-muted"}>IMGW</span>
            </button>
          ) : null}
          {overlays.length > 0 ? (
            <button
              type="button"
              aria-pressed={drizzleMap}
              onClick={() => setDrizzleMap(!drizzleMap)}
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface/90 px-3 py-1.5 text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md"
            >
              <span
                className="inline-block size-2.5 rounded-full ring-2 ring-fg"
                style={{ backgroundColor: drizzleMap ? "#36bae5" : "#5c6570" }}
              />
              <span className={drizzleMap ? "text-fg" : "text-muted"}>Pokaż mżawkę</span>
            </button>
          ) : null}
        </div>
      ) : null}

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 sm:p-5">
        <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-end">
          <ThreatSheet
            place={place}
            threat={threat}
            pending={snapshotQuery.isPending}
            error={snapshotQuery.isError}
            tracks={tracks}
            imgwLine={imgwLine}
            warningsUnavailable={snapshot?.warningsUnavailable ?? false}
            geoError={geoError}
            onClearGeoError={() => setGeoError(null)}
            onShowRainMotion={showRainMotion}
            radarTime={radarTime}
            analysisSource={snapshot?.radar.analysisSource}
            lightningNote={
              snapshot
                ? lightningCaption(snapshot.lightning.length, snapshot.lightningUnavailable)
                : snapshotQuery.isPending
                  ? undefined
                  : lightningCaption(0, true)
            }
            lightningUnavailable={snapshot?.lightningUnavailable ?? !snapshot}
          />

          <aside className="pointer-events-auto hidden max-h-72 overflow-y-auto rounded-3xl bg-surface/85 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md sm:block">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Ostrzeżenia IMGW</h3>
              {snapshot?.warningsUnavailable ? null : (
                <span className="text-xs text-muted">
                  {snapshot?.stormWarningCount ?? 0} burzowych w kraju
                </span>
              )}
            </div>
            {snapshot?.warningsUnavailable ? (
              <p className="text-sm text-warn">{IMGW_WARNINGS_UNAVAILABLE}</p>
            ) : snapshotQuery.isPending && !snapshot ? (
              <p className="text-sm text-muted">Pobieram komunikaty…</p>
            ) : shownWarnings.length === 0 ? (
              <p className="text-sm text-muted">Brak aktywnych ostrzeżeń burzowych.</p>
            ) : (
              <ul className="space-y-3">
                {shownWarnings.slice(0, 4).map((w) => (
                  <li key={w.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{w.event}</p>
                      <Badge tone={w.degree >= 2 ? "danger" : "warn"}>stopień {w.degree}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">{formatImgwRange(w.from, w.to)}</p>
                    <p className="mt-2 text-xs leading-relaxed text-fg/80">{w.body}</p>
                    {!w.matchesPlace ? (
                      <p className="mt-2 text-xs text-faint">Inny powiat — podgląd krajowy.</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>

      {settingsOpen ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-bg/60 p-3 sm:items-center">
          <div
            role="dialog"
            aria-labelledby="settings-title"
            className="w-full max-w-lg max-h-[min(40rem,88dvh)] overflow-y-auto rounded-3xl bg-surface p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 id="settings-title" className="font-display text-xl font-semibold">
                Lokalizacja i alerty
              </h2>
              <Button
                variant="ghost"
                size="iconSm"
                onClick={() => setSettingsOpen(false)}
                aria-label="Zamknij"
              >
                <X className="size-4" />
              </Button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-muted">
              {geoHint ??
                "Wybierz miasto albo stuknij mapę. GPS działa na telefonie poza tym podglądem — tu przeglądarka go blokuje."}
            </p>

            <form
              className="mt-4 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (query.trim().length >= 2) searchMut.mutate(query.trim());
              }}
            >
              <label className="relative min-w-0 flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Szukaj miasta w Polsce"
                  className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-sm text-fg placeholder:text-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                />
              </label>
              <Button type="submit" disabled={searchMut.isPending}>
                Szukaj
              </Button>
            </form>

            {searchMut.data && searchMut.data.length > 0 ? (
              <ul className="mt-3 max-h-40 overflow-y-auto rounded-xl bg-surface-2">
                {searchMut.data.map((p) => (
                  <li key={`${p.lat}-${p.lon}-${p.label}`}>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-bg"
                      onClick={() => pickPlace(p)}
                    >
                      {p.label}
                      <span className="ml-2 text-xs text-muted">{p.state}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 flex flex-wrap gap-2">
              {CITIES.slice(0, 12).map((c) => (
                <button
                  key={c.label}
                  type="button"
                  onClick={() => pickPlace(c)}
                  className={cn(
                    "h-9 rounded-full px-3 text-xs font-medium",
                    place.label === c.label ? "bg-accent text-accent-fg" : "bg-surface-2 text-fg",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            <label className="mt-5 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={imgwMap}
                onChange={(e) => setImgwMap(e.target.checked)}
                className="accent-accent"
              />
              Ostrzeżenia IMGW na mapie (powiat, stopień)
            </label>
            {overlays.length > 0 ? (
              <label className="mt-3 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={drizzleMap}
                  onChange={(e) => setDrizzleMap(e.target.checked)}
                  className="accent-accent"
                />
                Pokaż mżawkę na mapie (domyślnie wyłączona — jak liczby)
              </label>
            ) : null}

            <div className="mt-5 rounded-xl bg-surface-2 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Alerty na pinezkę</p>
                  <p className="text-xs text-muted">
                    Wołamy, gdy tor opadu trafia w {place.label}. Działa, gdy karta GROM jest
                    otwarta (może być w tle).
                  </p>
                </div>
                <Button
                  variant={alerts.enabled ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    if (alerts.enabled) setAlerts({ enabled: false });
                    else void enableAlerts();
                  }}
                >
                  {alerts.enabled ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                  {alerts.enabled ? "Włączone" : "Włącz"}
                </Button>
              </div>

              {alerts.enabled ? (
                <div className="mt-4 space-y-4 border-t border-border pt-4">
                  <p className="text-xs leading-relaxed text-muted">
                    {permission === "granted"
                      ? "Powiadomienia systemowe: włączone. Do tego baner w aplikacji."
                      : permission === "denied"
                        ? "Przeglądarka blokuje powiadomienia systemowe — zostaje baner w aplikacji. Odblokuj w ustawieniach strony, jeśli chcesz dźwięk i powiadomienie w tle."
                        : permission === "unsupported"
                          ? "Ta przeglądarka nie obsługuje powiadomień systemowych — zostaje baner w aplikacji."
                          : "Powiadomienia systemowe jeszcze bez zgody — zostaje baner w aplikacji."}
                    {permission === "default" ? (
                      <>
                        {" "}
                        <button
                          type="button"
                          className="font-medium text-accent hover:text-fg"
                          onClick={() => void enableAlerts()}
                        >
                          Zezwól
                        </button>
                      </>
                    ) : null}
                  </p>

                  <div>
                    <p className="text-sm">Czułość alertów</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {ALERT_PRESET_ORDER.map((id) => {
                        const preset = ALERT_PRESETS[id];
                        const active = alertPreset === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setAlerts(alertPresetPatch(id))}
                            className={cn(
                              "h-9 rounded-full px-3 text-xs font-medium",
                              active
                                ? "bg-accent text-accent-fg"
                                : "bg-surface text-fg",
                            )}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted">
                      {alertPreset
                        ? ALERT_PRESETS[alertPreset].hint
                        : "własne — suwaki w zaawansowanych"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        primeSound();
                        setAlerts({ sound: !alerts.sound });
                      }}
                    >
                      {alerts.sound ? (
                        <Volume2 className="size-4" />
                      ) : (
                        <VolumeX className="size-4" />
                      )}
                      {alerts.sound ? "Dźwięk" : "Bez dźwięku"}
                    </Button>
                    <label className="flex h-9 items-center gap-2 rounded-full bg-surface px-3 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={alerts.allClear}
                        onChange={(e) => setAlerts({ allClear: e.target.checked })}
                        className="accent-accent"
                      />
                      „Przeszło” po burzy
                    </label>
                    <Button variant="outline" size="sm" onClick={fireTestAlert}>
                      Testuj alert
                    </Button>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={alerts.quietFrom !== null}
                        onChange={(e) =>
                          setAlerts(
                            e.target.checked
                              ? { quietFrom: 22, quietTo: 7 }
                              : { quietFrom: null, quietTo: null },
                          )
                        }
                        className="accent-accent"
                      />
                      Ciche godziny (tylko baner, bez dźwięku i powiadomień)
                    </label>
                    {alerts.quietFrom !== null ? (
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        od
                        <HourSelect
                          value={alerts.quietFrom}
                          onChange={(h) => setAlerts({ quietFrom: h })}
                        />
                        do
                        <HourSelect
                          value={alerts.quietTo ?? 7}
                          onChange={(h) => setAlerts({ quietTo: h })}
                        />
                      </div>
                    ) : null}
                  </div>

                  <details className="rounded-xl bg-surface px-3 py-2">
                    <summary className="cursor-pointer text-sm font-medium">Zaawansowane</summary>
                    <div className="mt-3 space-y-4">
                      <label className="block text-sm">
                        Wołaj, gdy dojście ≤{" "}
                        <span className="font-mono tabular-nums">{alerts.leadMin} min</span>
                        <input
                          type="range"
                          min={10}
                          max={60}
                          step={5}
                          value={alerts.leadMin}
                          onChange={(e) => setAlerts({ leadMin: Number(e.target.value) })}
                          className="mt-2 w-full accent-accent"
                          aria-label="Wyprzedzenie alertu w minutach"
                        />
                      </label>

                      <div>
                        <p className="text-sm">Od jakiej intensywności</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {([1, 2, 3] as const).map((lvl) => (
                            <button
                              key={lvl}
                              type="button"
                              onClick={() => setAlerts({ minLevel: lvl })}
                              className={cn(
                                "h-9 rounded-full px-3 text-xs font-medium",
                                alerts.minLevel === lvl
                                  ? "bg-accent text-accent-fg"
                                  : "bg-surface text-fg",
                              )}
                            >
                              {levelSettingLabelPl(lvl)}
                            </button>
                          ))}
                        </div>
                      </div>

                      <label className="block text-sm">
                        Minimalna szansa{" "}
                        <span className="font-mono tabular-nums">{alerts.minChancePct}%</span>
                        <input
                          type="range"
                          min={0}
                          max={90}
                          step={5}
                          value={alerts.minChancePct}
                          onChange={(e) => setAlerts({ minChancePct: Number(e.target.value) })}
                          className="mt-2 w-full accent-accent"
                          aria-label="Minimalna szansa alertu"
                        />
                      </label>
                    </div>
                  </details>

                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm">Ostatnie alerty</p>
                      {alertLog.length > 0 ? (
                        <button
                          type="button"
                          className="text-xs text-faint hover:text-fg"
                          onClick={clearAlertLog}
                        >
                          wyczyść
                        </button>
                      ) : null}
                    </div>
                    {alertLog.length === 0 ? (
                      <p className="mt-1 text-xs text-faint">
                        Jeszcze nic. Alert pojawi się, gdy radar zobaczy komórkę na kursie.
                      </p>
                    ) : (
                      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                        {alertLog.map((ev: AlertEvent) => (
                          <li key={ev.id} className="flex items-start gap-2 text-xs">
                            <span className="mt-0.5 shrink-0">
                              <AlertIcon kind={ev.kind} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{ev.title}</span>
                              <span className="text-faint">
                                {" "}
                                · {formatAlertTime(ev.at)} · {ev.placeLabel}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-faint">
                    Jeden alert na etap burzy: „nadciąga”, „nad Tobą”, „przeszło”. Bez powtórek co
                    godzinę. Radar starszy niż 30 min nie woła. Push w tle, gdy karta jest zamknięta
                    — w kolejnej wersji.
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-faint">
              Klatki radaru trzymamy chwilowo w pamięci urządzenia (ostatnie kilka skanów), żeby
              policzyć ruch komórki. Nie zapisujemy ich w repozytorium ani w bazie. Ustawienia
              zostają w przeglądarce.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HourSelect({ value, onChange }: { value: number; onChange: (h: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="h-8 rounded-lg border border-border bg-surface px-2 font-mono text-xs text-fg"
    >
      {Array.from({ length: 24 }, (_, h) => (
        <option key={h} value={h}>
          {String(h).padStart(2, "0")}:00
        </option>
      ))}
    </select>
  );
}
