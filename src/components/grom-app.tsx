import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, BellOff, Crosshair, Radar, Search, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RadarMap } from "@/components/radar-map";
import { ThreatSheet } from "@/components/threat-sheet";
import { cn } from "@/lib/utils";
import { CITIES } from "@/lib/weather/cities";
import { haversineKm } from "@/lib/weather/geo";
import { getSnapshot, searchPlaces, PL_RADAR_ORIGIN } from "@/lib/weather/server";
import { computeThreat } from "@/lib/weather/threat";
import type { Place, RadarLevel } from "@/lib/weather/types";
import { useGrom } from "@/lib/store";

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
  const notify = useGrom((s) => s.notify);
  const lastNotified = useGrom((s) => s.lastNotified);
  const setPlace = useGrom((s) => s.setPlace);
  const updatePlaceMeta = useGrom((s) => s.updatePlaceMeta);
  const setRadiusKm = useGrom((s) => s.setRadiusKm);
  const setNotify = useGrom((s) => s.setNotify);
  const pushFrame = useGrom((s) => s.pushFrame);
  const markNotified = useGrom((s) => s.markNotified);

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
  });

  const snapshot = snapshotQuery.data;

  const { refetch: refetchSnapshot } = snapshotQuery;

  // Resolve TERYT / label for a bare map pin without changing the radar query key.
  useEffect(() => {
    if (place.terc) return;
    void refetchSnapshot();
  }, [place.lat, place.lon, place.terc, refetchSnapshot]);

  useEffect(() => {
    if (!snapshot?.radar.latestTime) return;
    const hist = snapshot.radar.history?.length
      ? snapshot.radar.history
      : [
          ...(snapshot.radar.prevTime && snapshot.radar.prevSamples.length > 0
            ? [
                {
                  time: snapshot.radar.prevTime,
                  samples: snapshot.radar.prevSamples,
                  maxLevel: snapshot.radar.prevSamples.reduce(
                    (m, s) => (s.level > m ? s.level : m),
                    0 as RadarLevel,
                  ),
                  nearestKm: null,
                },
              ]
            : []),
          {
            time: snapshot.radar.latestTime,
            samples: snapshot.radar.samples,
            maxLevel: snapshot.radar.maxLevel,
            nearestKm: snapshot.radar.nearestKm,
          },
        ];
    for (const frame of hist) pushFrame(frame);
  }, [snapshot, pushFrame]);

  useEffect(() => {
    if (!snapshot?.place.terc || place.terc) return;
    if (haversineKm(snapshot.place.lat, snapshot.place.lon, place.lat, place.lon) < 3) {
      updatePlaceMeta(snapshot.place);
    }
  }, [snapshot, place, updatePlaceMeta]);

  const threat = useMemo(() => {
    if (!snapshot) return null;
    const hist = snapshot.radar.history?.length
      ? snapshot.radar.history
      : [
          ...(snapshot.radar.prevTime != null
            ? [
                {
                  time: snapshot.radar.prevTime,
                  samples: snapshot.radar.prevSamples,
                  maxLevel: snapshot.radar.prevSamples.reduce(
                    (m, s) => (s.level > m ? s.level : m),
                    0 as RadarLevel,
                  ),
                  nearestKm: null,
                },
              ]
            : []),
          ...(snapshot.radar.latestTime != null
            ? [
                {
                  time: snapshot.radar.latestTime,
                  samples: snapshot.radar.samples,
                  maxLevel: snapshot.radar.maxLevel,
                  nearestKm: snapshot.radar.nearestKm,
                },
              ]
            : []),
        ];
    const warnings = snapshot.warnings.map((w) => ({
      ...w,
      matchesPlace: place.terc ? w.teryt.includes(place.terc) : w.matchesPlace,
    }));
    return computeThreat(place, hist, warnings, radiusKm, PL_RADAR_ORIGIN);
  }, [snapshot, radiusKm, place]);

  useEffect(() => {
    if (!threat || !notify) return;
    if (threat.level === "clear" || threat.level === "watch") return;
    const key = `${threat.level}:${Math.floor(Date.now() / 3_600_000)}`;
    if (lastNotified === key) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    new Notification(`GROM · ${threat.title}`, { body: threat.detail });
    markNotified(key);
  }, [threat, notify, lastNotified, markNotified]);

  const searchMut = useMutation({
    mutationFn: (q: string) => searchPlaces({ data: { query: q } }),
  });

  const past = snapshot?.radar.past ?? [];
  const activePath =
    frameIndex !== null && past[frameIndex] ? past[frameIndex].path : (past.at(-1)?.path ?? null);

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

  async function enableNotify() {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotify(perm === "granted");
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

      {tracks.length > 0 ? (
        <div className="pointer-events-none absolute left-3 top-36 z-10 sm:left-5 sm:top-40">
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

      <section className="pointer-events-none absolute inset-x-0 bottom-0 z-10 sm:p-5">
        <div className="mx-auto grid max-w-6xl gap-3 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-end">
          <ThreatSheet
            place={place}
            threat={threat}
            pending={snapshotQuery.isPending}
            error={snapshotQuery.isError}
            tracks={tracks}
            shownWarnings={shownWarnings}
            geoError={geoError}
            onClearGeoError={() => setGeoError(null)}
            onShowRainMotion={showRainMotion}
          />

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
                      <Badge tone={w.degree >= 2 ? "danger" : "warn"}>stopień {w.degree}</Badge>
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
              Promień to zasięg alertu. Szansa, ETA i strzałka są liczone dla pinezki — teraz
              miasta, później dokładnego GPS.
            </p>

            <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-3">
              <div>
                <p className="text-sm font-medium">Powiadomienia przeglądarki</p>
                <p className="text-xs text-muted">
                  Działają, gdy karta jest otwarta. Push w tle — w kolejnej wersji.
                </p>
              </div>
              <Button
                variant={notify ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  if (notify) setNotify(false);
                  else void enableNotify();
                }}
              >
                {notify ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                {notify ? "Włączone" : "Włącz"}
              </Button>
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
