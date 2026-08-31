import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  CheckCircle2,
  CloudLightning,
  CloudRain,
  Crosshair,
  MapPin,
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
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/weather/cities";
import { haversineKm } from "@/lib/weather/geo";
import { getSnapshot, searchPlaces, PL_RADAR_ORIGIN } from "@/lib/weather/server";
import { framesFromScan } from "@/lib/weather/pack";
import { computeThreat } from "@/lib/weather/threat";
import {
  evaluateAlert,
  isQuietHour,
  levelSettingLabelPl,
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
import { LEVEL_SWATCH, levelLabelPl } from "@/lib/weather/palette";
import type { Place, RadarLevel, ThreatLevel, TimelinePoint } from "@/lib/weather/types";
import { useGrom } from "@/lib/store";

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

function formatClock(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleTimeString("pl-PL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatWhen(iso: string) {
  const d = new Date(iso.replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pl-PL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    day: "numeric",
    month: "short",
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
  const radiusKm = useGrom((s) => s.radiusKm);
  const alerts = useGrom((s) => s.alerts);
  const activeAlert = useGrom((s) => s.activeAlert);
  const alertLog = useGrom((s) => s.alertLog);
  const setPlace = useGrom((s) => s.setPlace);
  const updatePlaceMeta = useGrom((s) => s.updatePlaceMeta);
  const setRadiusKm = useGrom((s) => s.setRadiusKm);
  const setAlerts = useGrom((s) => s.setAlerts);
  const setAlertMemory = useGrom((s) => s.setAlertMemory);
  const recordAlert = useGrom((s) => s.recordAlert);
  const dismissAlert = useGrom((s) => s.dismissAlert);
  const clearAlertLog = useGrom((s) => s.clearAlertLog);
  const pushFrame = useGrom((s) => s.pushFrame);
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
      const r = useGrom.getState().radiusKm;
      return getSnapshot({
        data: {
          lat: p.lat,
          lon: p.lon,
          radiusKm: r,
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

  // Unpack the wire frames once per snapshot; threat + RAM history both use this.
  const radarFrames = useMemo(
    () => (snapshot ? framesFromScan(snapshot.radar) : []),
    [snapshot],
  );

  useEffect(() => {
    if (!snapshot?.radar.latestTime) return;
    for (const frame of radarFrames) pushFrame(frame);
  }, [snapshot, radarFrames, pushFrame]);

  useEffect(() => {
    if (!snapshot?.place.terc || place.terc) return;
    if (haversineKm(snapshot.place.lat, snapshot.place.lon, place.lat, place.lon) < 3) {
      updatePlaceMeta(snapshot.place);
    }
  }, [snapshot, place, updatePlaceMeta]);

  const threat = useMemo(() => {
    if (!snapshot) return null;
    const hist = radarFrames;
    const warnings = snapshot.warnings.map((w) => ({
      ...w,
      matchesPlace: place.terc ? w.teryt.includes(place.terc) : w.matchesPlace,
    }));
    return computeThreat(place, hist, warnings, radiusKm, PL_RADAR_ORIGIN);
  }, [snapshot, radarFrames, radiusKm, place]);

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
    });
    if (!shallowEqual(result.memory, memory)) setAlertMemory(result.memory);
    if (!result.event) return;
    recordAlert(result.event);
    deliverAlert(result.event, {
      sound: alerts.sound,
      quiet: isQuietHour(alerts, new Date(now)),
    });
  }, [threat, alerts, place.label, radarTime, setAlertMemory, recordAlert]);

  const searchMut = useMutation({
    mutationFn: (q: string) => searchPlaces({ data: { query: q } }),
  });

  const past = snapshot?.radar.past ?? [];
  const activePath =
    frameIndex !== null && past[frameIndex]
      ? past[frameIndex].path
      : (past.at(-1)?.path ?? null);

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
  const tracks = threat?.tracks ?? [];
  const etaValue =
    threat?.etaMin === 0
      ? "teraz"
      : threat?.etaMin != null
        ? `${threat.etaMin} min`
        : threat &&
            !threat.willHit &&
            threat.missKm != null &&
            threat.missKm > 8 &&
            threat.nearestKm != null &&
            threat.nearestKm > 20 &&
            threat.nearestKm <= 80
          ? "minie"
          : "—";

  return (
    <div className="relative isolate h-dvh overflow-hidden bg-bg text-fg">
      <RadarMap
        lat={place.lat}
        lon={place.lon}
        radiusKm={radiusKm}
        radarHost={snapshot?.radar.host ?? null}
        radarPath={activePath}
        tracks={tracks}
        focus={focus}
        onPick={(lat, lon) => {
          if (Date.now() < ignoreMapClickUntil.current) return;
          setGeoError(null);
          setGeoHint(null);
          setPlace({ lat, lon, label: "Punkt na mapie" });
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-transparent via-transparent to-bg/45" />

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

      {past.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center px-3 sm:top-28">
          <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-surface/85 px-4 py-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md">
            <Radar className="size-4 text-accent" />
            <input
              type="range"
              min={0}
              max={past.length - 1}
              value={frameIndex ?? past.length - 1}
              onChange={(e) => setFrameIndex(Number(e.target.value))}
              className="h-1 w-40 accent-accent sm:w-56"
              aria-label="Czas radaru"
            />
            <span className="w-12 text-right font-mono text-xs tabular-nums text-muted">
              {formatClock(past[frameIndex ?? past.length - 1]?.time ?? null)}
            </span>
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

      {tracks.length > 0 ? (
        <div
          className={cn(
            "pointer-events-none absolute left-3 z-10 sm:left-5",
            // On phones the centered banner sits over the pill; on wider screens they do not touch.
            activeAlert ? "top-64 sm:top-40" : "top-36 sm:top-40",
          )}
        >
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
        </div>
      ) : null}

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
        <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-end">
          <article
            className={cn(
              "pointer-events-auto rounded-3xl bg-surface/90 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md sm:p-5",
              threat ? PANEL[threat.level] : "border-transparent",
              "border",
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
                  {snapshotQuery.isPending && !threat ? "Skanuję radar…" : threat?.title ?? "Brak danych"}
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
                    {threat.toward ? (
                      <span className="text-muted"> → na {threat.toward}</span>
                    ) : null}
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
              {snapshotQuery.isError
                ? "Nie udało się pobrać radaru albo ostrzeżeń. Spróbuj za chwilę."
                : threat?.detail}
            </p>

            <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Szansa" value={threat ? `${threat.chancePct}%` : "—"} />
              <Stat label="ETA" value={etaValue} />
              <Stat
                label="Echo"
                value={
                  threat?.nearestKm != null
                    ? `${threat.nearestKm.toFixed(0)} km${threat.pinLevel > 0 ? ` · ${levelLabelPl(threat.pinLevel)}` : ""}`
                    : "brak"
                }
              />
            </dl>

            {threat && threat.timeline.length > 0 ? (
              <Timeline points={threat.timeline} advected={threat.timelineAdvected} />
            ) : null}

            {tracks.length > 0 && (threat?.nearestKm == null || threat.nearestKm > 25) ? (
              <button
                type="button"
                onClick={showRainMotion}
                className="mt-3 w-full rounded-xl bg-surface-2 px-3 py-2 text-xs font-medium text-accent hover:text-fg"
              >
                Pokaż ruch opadu na mapie
                {threat?.nearestKm != null ? ` · ${threat.nearestKm.toFixed(0)} km` : ""}
              </button>
            ) : null}

            <p className="mt-3 text-xs leading-relaxed text-faint">
              Szansa i ETA są dla pinezki ({place.label}) — miasta albo punktu GPS —
              nie dla całego promienia. Na mapie jedna albo dwie strzałki — te,
              które dotyczą pinezki, nie cały front. Promień w ustawieniach mówi
              tylko, jak daleko wołamy alert.
            </p>

            {shownWarnings[0] ? (
              <p className="mt-3 text-xs text-muted lg:hidden">
                IMGW: {shownWarnings[0].event}
                {shownWarnings[0].degree ? ` · stopień ${shownWarnings[0].degree}` : ""}
                {!shownWarnings[0].matchesPlace ? " · inny powiat" : ""}
              </p>
            ) : null}

            {geoError ? (
              <p className="mt-3 flex items-start justify-between gap-2 text-xs text-warn">
                <span>{geoError}</span>
                <button
                  type="button"
                  className="shrink-0 text-faint hover:text-fg"
                  onClick={() => setGeoError(null)}
                  aria-label="Zamknij komunikat"
                >
                  <X className="size-3.5" />
                </button>
              </p>
            ) : null}

            <p className="mt-4 text-xs leading-relaxed text-faint">
              Źródłem danych ostrzeżeń i sieci POLRAD jest Instytut Meteorologii i
              Gospodarki Wodnej – Państwowy Instytut Badawczy. Dane radarowe zostały
              przetworzone (dBZ → mm/h wg Marshalla–Palmera, siatka ~3 km). Radar:
              RainViewer. Mapa: OpenFreeMap / OSM. To nie jest oficjalny alert RCB.
              Komórka burzowa może powstać lokalnie nawet przy czystym radarze.
            </p>
          </article>

          <aside className="pointer-events-auto hidden max-h-72 overflow-y-auto rounded-3xl bg-surface/85 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] backdrop-blur-md sm:block">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium">Ostrzeżenia IMGW</h3>
              <span className="text-xs text-muted">
                {snapshot?.stormWarningCount ?? 0} burzowych w kraju
              </span>
            </div>
            {snapshotQuery.isPending && !snapshot ? (
              <p className="text-sm text-muted">Pobieram komunikaty…</p>
            ) : shownWarnings.length === 0 ? (
              <p className="text-sm text-muted">Brak aktywnych ostrzeżeń burzowych.</p>
            ) : (
              <ul className="space-y-3">
                {shownWarnings.slice(0, 4).map((w) => (
                  <li key={w.id} className="rounded-xl bg-surface-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{w.event}</p>
                      <Badge tone={w.degree >= 2 ? "danger" : "warn"}>
                        stopień {w.degree}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {formatWhen(w.from)} — {formatWhen(w.to)}
                    </p>
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
              <Button variant="ghost" size="iconSm" onClick={() => setSettingsOpen(false)} aria-label="Zamknij">
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

            <label className="mt-5 block text-sm">
              Promień alertu: <span className="font-mono tabular-nums">{radiusKm} km</span>
              <input
                type="range"
                min={15}
                max={80}
                step={5}
                value={radiusKm}
                onChange={(e) => setRadiusKm(Number(e.target.value))}
                className="mt-2 w-full accent-accent"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Promień to zasięg alertu. Szansa, ETA i strzałka są liczone dla
              pinezki — teraz miasta, później dokładnego GPS.
            </p>

            <div className="mt-5 rounded-xl bg-surface-2 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Alerty na pinezkę</p>
                  <p className="text-xs text-muted">
                    Wołamy, gdy tor opadu trafia w {place.label}. Działa, gdy karta
                    GROM jest otwarta (może być w tle).
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

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        primeSound();
                        setAlerts({ sound: !alerts.sound });
                      }}
                    >
                      {alerts.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
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
                    Jeden alert na etap burzy: „nadciąga”, „nad Tobą”, „przeszło”. Bez
                    powtórek co godzinę. Radar starszy niż 30 min nie woła. Push w tle,
                    gdy karta jest zamknięta — w kolejnej wersji.
                  </p>
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-xs leading-relaxed text-faint">
              Klatki radaru trzymamy chwilowo w pamięci urządzenia (ostatnie kilka
              skanów), żeby policzyć ruch komórki. Nie zapisujemy ich w repozytorium
              ani w bazie. Ustawienia zostają w przeglądarce.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const LEGEND: Array<{ level: RadarLevel; range: string }> = [
  { level: 1, range: "<1" },
  { level: 2, range: "1–4" },
  { level: 3, range: "4–10" },
  { level: 4, range: ">10" },
];

/** MeteoSwiss-style strip: rain at the pin for the next 90 min, one bar per 5 min. */
function Timeline({ points, advected }: { points: TimelinePoint[]; advected: boolean }) {
  const any = points.some((p) => p.level > 0);
  return (
    <div className="mt-3 rounded-2xl bg-surface-2 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-faint">Opad nad pinezką · 90 min · mm/h</span>
        <span className="text-faint">{advected ? "z ruchu echa" : "bez ruchu — jak teraz"}</span>
      </div>
      <div className="mt-2 flex h-9 items-end gap-px" role="img" aria-label="Oś czasu opadu">
        {points.map((p) => (
          <div
            key={p.t}
            title={`+${p.t} min: ${p.level > 0 ? `${levelLabelPl(p.level)}, ~${p.rate} mm/h` : "sucho"}`}
            className="flex-1 rounded-sm"
            style={{
              height: p.level > 0 ? `${25 + p.level * 18}%` : "4px",
              backgroundColor: p.level > 0 ? LEVEL_SWATCH[p.level] : "var(--color-border)",
            }}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-faint">
        <span>teraz</span>
        <span>30</span>
        <span>60</span>
        <span>90 min</span>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-3">
      <dt className="text-xs uppercase tracking-wider text-faint">{label}</dt>
      <dd className="mt-1 font-mono text-sm tabular-nums">{value}</dd>
    </div>
  );
}
