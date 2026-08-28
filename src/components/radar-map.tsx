import { useEffect, useRef } from "react";
import type { StyleSpecification } from "maplibre-gl";
import type { CellTrack } from "@/lib/weather/types";
import { circlePolygon } from "@/lib/weather/geo";
import { cn } from "@/lib/utils";

type Focus = {
  token: number;
  lat: number;
  lon: number;
  pinLat: number;
  pinLon: number;
};

type Props = {
  lat: number;
  lon: number;
  radiusKm: number;
  radarHost: string | null;
  radarPath: string | null;
  tracks: CellTrack[];
  focus: Focus | null;
  onPick: (lat: number, lon: number) => void;
  className?: string;
};

/** Light, readable streets. No API key. https://openfreemap.org */
const OFM_LIGHT = "https://tiles.openfreemap.org/styles/positron";

const ESRI_FALLBACK: StyleSpecification = {
  version: 8,
  sources: {
    esri: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, OSM",
      maxzoom: 16,
    },
    labels: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: "esri", type: "raster", source: "esri" },
    { id: "labels", type: "raster", source: "labels" },
  ],
};

const INK = "#12171f";
const AMBER = "#e4572e";
const AMBER_SOFT = "#f0a202";
const CREAM = "#f8f4ee";

type Live = {
  lat: number;
  lon: number;
  radiusKm: number;
  radarHost: string | null;
  radarPath: string | null;
  tracks: CellTrack[];
};

export function RadarMap({
  lat,
  lon,
  radiusKm,
  radarHost,
  radarPath,
  tracks,
  focus,
  onPick,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const readyRef = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;

  const liveRef = useRef<Live>({ lat, lon, radiusKm, radarHost, radarPath, tracks });
  liveRef.current = { lat, lon, radiusKm, radarHost, radarPath, tracks };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let onClick: ((e: import("maplibre-gl").MapMouseEvent) => void) | undefined;
    let usedFallback = false;

    const draw = () => {
      const canvas = canvasRef.current;
      const instance = mapRef.current;
      if (!canvas || !instance || !readyRef.current) return;
      drawTracks(canvas, instance, liveRef.current.tracks);
    };

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !rootRef.current) return;

      const instance = new maplibregl.Map({
        container: rootRef.current,
        style: OFM_LIGHT,
        center: [liveRef.current.lon, liveRef.current.lat],
        zoom: 8.2,
        minZoom: 5,
        maxZoom: 12,
        attributionControl: false,
        fadeDuration: 0,
        dragRotate: false,
        pitchWithRotate: false,
        maxPitch: 0,
      });
      map = instance;

      onClick = (e) => {
        onPickRef.current(e.lngLat.lat, e.lngLat.lng);
      };
      instance.on("click", onClick);

      const paintOverlays = () => {
        if (cancelled) return;
        const live = liveRef.current;
        if (!instance.getSource("radius")) {
          instance.addSource("radius", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: circlePolygon(live.lat, live.lon, live.radiusKm),
            },
          });
          instance.addLayer({
            id: "radius-fill",
            type: "fill",
            source: "radius",
            paint: { "fill-color": "#0e7490", "fill-opacity": 0.08 },
          });
          instance.addLayer({
            id: "radius-line",
            type: "line",
            source: "radius",
            paint: { "line-color": "#0e7490", "line-width": 1.4, "line-opacity": 0.7 },
          });
        } else {
          const radiusSrc = instance.getSource("radius") as import("maplibre-gl").GeoJSONSource;
          radiusSrc.setData({
            type: "Feature",
            properties: {},
            geometry: circlePolygon(live.lat, live.lon, live.radiusKm),
          });
        }

        if (!instance.getSource("you")) {
          instance.addSource("you", {
            type: "geojson",
            data: {
              type: "Feature",
              properties: {},
              geometry: { type: "Point", coordinates: [live.lon, live.lat] },
            },
          });
          instance.addLayer({
            id: "you-halo",
            type: "circle",
            source: "you",
            paint: {
              "circle-radius": 14,
              "circle-color": "#0e7490",
              "circle-opacity": 0.18,
            },
          });
          instance.addLayer({
            id: "you-dot",
            type: "circle",
            source: "you",
            paint: {
              "circle-radius": 6,
              "circle-color": "#12171f",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#0e7490",
            },
          });
        } else {
          const youSrc = instance.getSource("you") as import("maplibre-gl").GeoJSONSource;
          youSrc.setData({
            type: "Feature",
            properties: {},
            geometry: { type: "Point", coordinates: [live.lon, live.lat] },
          });
        }

        syncRadar(instance, live);
        if (!readyRef.current) {
          instance.jumpTo({ center: [live.lon, live.lat], zoom: 8.2 });
        }
        readyRef.current = true;
        mapRef.current = instance;
        sizeCanvas(canvasRef.current, wrapRef.current);
        draw();
      };

      instance.on("style.load", paintOverlays);
      instance.on("render", draw);
      instance.on("resize", () => {
        sizeCanvas(canvasRef.current, wrapRef.current);
        draw();
      });
      instance.on("error", (ev) => {
        if (usedFallback || readyRef.current) return;
        const msg = String(
          (ev as { error?: { message?: string } }).error?.message ?? "",
        );
        if (
          !/api key|401|403|not authorized|forbidden/i.test(msg) &&
          !/failed to (fetch|load)/i.test(msg)
        ) {
          return;
        }
        usedFallback = true;
        instance.setStyle(ESRI_FALLBACK);
      });
    })();

    const ro = new ResizeObserver(() => {
      sizeCanvas(canvasRef.current, wrapRef.current);
      const instance = mapRef.current;
      if (instance && readyRef.current) {
        instance.resize();
        drawTracks(canvasRef.current, instance, liveRef.current.tracks);
      }
    });
    if (wrapRef.current) ro.observe(wrapRef.current);

    return () => {
      cancelled = true;
      readyRef.current = false;
      ro.disconnect();
      if (map && onClick) map.off("click", onClick);
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    const live = liveRef.current;
    const radiusSrc = map.getSource("radius") as import("maplibre-gl").GeoJSONSource | undefined;
    const youSrc = map.getSource("you") as import("maplibre-gl").GeoJSONSource | undefined;
    radiusSrc?.setData({
      type: "Feature",
      properties: {},
      geometry: circlePolygon(live.lat, live.lon, live.radiusKm),
    });
    youSrc?.setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [live.lon, live.lat] },
    });
    map.easeTo({ center: [live.lon, live.lat], duration: 700 });
  }, [lat, lon, radiusKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncRadar(map, liveRef.current);
  }, [radarHost, radarPath]);

  useEffect(() => {
    const map = mapRef.current;
    const canvas = canvasRef.current;
    if (!map || !readyRef.current || !canvas) return;
    drawTracks(canvas, map, tracks);
  }, [tracks]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current || !focus) return;
    map.stop();
    const minLon = Math.min(focus.pinLon, focus.lon);
    const maxLon = Math.max(focus.pinLon, focus.lon);
    const minLat = Math.min(focus.pinLat, focus.lat);
    const maxLat = Math.max(focus.pinLat, focus.lat);
    map.fitBounds(
      [
        [minLon, minLat],
        [maxLon, maxLat],
      ],
      { padding: 90, maxZoom: 8.6, duration: 1000 },
    );
  }, [focus]);

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full bg-map", className)}>
      <div ref={rootRef} className="h-full w-full" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        aria-hidden
      />
    </div>
  );
}

function sizeCanvas(canvas: HTMLCanvasElement | null, wrap: HTMLDivElement | null) {
  if (!canvas || !wrap) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  if (w === 0 || h === 0) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function labelLayerId(map: import("maplibre-gl").Map): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return (
    layers.find((l) => l.id === "label_other")?.id ??
    layers.find((l) => l.id === "place_other")?.id ??
    layers.find((l) => l.id === "labels")?.id ??
    layers.find((l) => l.type === "symbol")?.id
  );
}

function syncRadar(map: import("maplibre-gl").Map, live: Live) {
  const id = "radar";
  const tiles =
    live.radarHost && live.radarPath
      ? [`${live.radarHost}${live.radarPath}/256/{z}/{x}/{y}/2/1_1.png`]
      : [];
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
  if (tiles.length === 0) return;
  map.addSource(id, {
    type: "raster",
    tiles,
    tileSize: 256,
    scheme: "xyz",
    minzoom: 1,
    maxzoom: 5,
  });
  map.addLayer(
    {
      id,
      type: "raster",
      source: id,
      paint: { "raster-opacity": 0.78, "raster-fade-duration": 0 },
    },
    labelLayerId(map),
  );
}

function drawTracks(
  canvas: HTMLCanvasElement | null,
  map: import("maplibre-gl").Map,
  tracks: CellTrack[],
) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);
  if (tracks.length === 0) return;

  const ordered = [...tracks].sort((a, b) => Number(a.threatening) - Number(b.threatening));
  for (const track of ordered) {
    const nowP = map.project([track.now.lon, track.now.lat]);
    const fromP = map.project([track.from.lon, track.from.lat]);
    const soonP = map.project([track.soon.lon, track.soon.lat]);
    const now = { x: nowP.x, y: nowP.y };
    const from = { x: fromP.x, y: fromP.y };
    // Length is geographic (speed × ~30 min) — do not inflate with a pixel floor.
    const soon = { x: soonP.x, y: soonP.y };
    const hot = track.threatening;
    const core = hot ? AMBER : AMBER_SOFT;
    const outline = hot ? 13 : 10;
    const width = hot ? 6 : 4.5;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.lineTo(now.x, now.y);
    ctx.lineTo(soon.x, soon.y);
    ctx.strokeStyle = INK;
    ctx.lineWidth = outline;
    ctx.stroke();
    ctx.strokeStyle = core;
    ctx.lineWidth = width;
    ctx.stroke();

    const ang = Math.atan2(soon.y - now.y, soon.x - now.x);
    const size = hot ? 18 : 14;
    ctx.beginPath();
    ctx.moveTo(soon.x, soon.y);
    ctx.lineTo(
      soon.x - size * Math.cos(ang - 0.42),
      soon.y - size * Math.sin(ang - 0.42),
    );
    ctx.lineTo(
      soon.x - size * Math.cos(ang + 0.42),
      soon.y - size * Math.sin(ang + 0.42),
    );
    ctx.closePath();
    ctx.fillStyle = core;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(now.x, now.y, hot ? 8 : 6.5, 0, Math.PI * 2);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(now.x, now.y, 2.4, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();
  }
}
