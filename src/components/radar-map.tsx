import { useEffect, useRef, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";
import { MapChrome } from "@/components/map-chrome";
import { scaleBar } from "@/components/map-chrome-logic";
import { shouldFallbackBasemap } from "@/components/map-boot";
import {
  IMGW_DEGREE_PAINT,
  tintedPowiatCollection,
  type ImgwGeoJSON,
} from "@/lib/weather/imgw-lane";
import { loadPowiatBoundaries } from "@/lib/weather/teryt";
import {
  placeChangeOffset,
  sheetFitPadding,
  sheetHeightPx,
  type SheetDetent,
} from "@/components/threat-sheet-logic";
import { drawMapOverlay } from "@/lib/weather/map-overlay";
import type { CellTrack, LightningStrike, ThreatLevel } from "@/lib/weather/types";
import { strikeOpacity } from "@/lib/weather/perun";
import { pickRadarLayer, type OverlayCorners } from "@/lib/weather/sri-overlay";
import { cameraDuration } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";

const SM_UP = "(min-width: 640px)";

function cameraSheetPx(detent: SheetDetent): number {
  if (window.matchMedia(SM_UP).matches) return 0;
  return sheetHeightPx(detent, window.innerHeight);
}

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
  radarHost: string | null;
  radarPath: string | null;
  overlayUrl?: string | null;
  overlayCorners?: OverlayCorners | null;
  tracks: readonly CellTrack[];
  imgwOn?: boolean;
  imgwDegrees?: Record<string, number>;
  strikes: LightningStrike[];
  /** Sheet level — pin halo tints danger at `now`. */
  threatLevel?: ThreatLevel | null;
  /** Bottom-sheet detent; drives fitBounds padding and place-change offset. */
  sheetDetent?: SheetDetent;
  focus: Focus | null;
  onPick: (lat: number, lon: number) => void;
  onLocate: () => void;
  locatePending?: boolean;
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
const STRIKE = "#f5c518";

type Live = {
  lat: number;
  lon: number;
  radarHost: string | null;
  radarPath: string | null;
  overlayUrl: string | null;
  overlayCorners: OverlayCorners | null;
  tracks: readonly CellTrack[];
  imgwOn: boolean;
  imgwDegrees: Record<string, number>;
  strikes: LightningStrike[];
  threatLevel: ThreatLevel | null;
};

export function RadarMap({
  lat,
  lon,
  radarHost,
  radarPath,
  overlayUrl = null,
  overlayCorners = null,
  tracks,
  imgwOn = true,
  imgwDegrees = {},
  strikes,
  threatLevel = null,
  sheetDetent = "peek",
  focus,
  onPick,
  onLocate,
  locatePending = false,
  className,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const readyRef = useRef(false);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [scale, setScale] = useState(() => scaleBar(8.2, lat));

  const liveRef = useRef<Live>({
    lat,
    lon,
    radarHost,
    radarPath,
    overlayUrl,
    overlayCorners,
    tracks,
    imgwOn,
    imgwDegrees,
    strikes,
    threatLevel,
  });
  liveRef.current = {
    lat,
    lon,
    radarHost,
    radarPath,
    overlayUrl,
    overlayCorners,
    tracks,
    imgwOn,
    imgwDegrees,
    strikes,
    threatLevel,
  };
  const imgwGenRef = useRef(0);
  const sheetDetentRef = useRef(sheetDetent);
  sheetDetentRef.current = sheetDetent;

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | undefined;
    let onClick: ((e: import("maplibre-gl").MapMouseEvent) => void) | undefined;
    let onScale: (() => void) | undefined;
    let usedFallback = false;
    let styleTimer = 0;

    const draw = () => {
      paintOverlay(canvasRef.current, mapRef.current, liveRef.current, readyRef.current);
    };

    const fitMap = (instance: import("maplibre-gl").Map | null | undefined) => {
      if (!instance || cancelled) return;
      const box = wrapRef.current;
      if (!box || box.clientWidth === 0 || box.clientHeight === 0) return;
      instance.resize();
      sizeCanvas(canvasRef.current, wrapRef.current);
      if (readyRef.current) draw();
    };

    void (async () => {
      const maplibregl = await import("maplibre-gl");
      // MapLibre v6 + Vite: import.meta.url does not find the worker. Without this
      // the browser requests /assets/maplibre-gl-worker.mjs (404), the worker never
      // starts, and vector tiles (streets / cities / names) are never fetched.
      // Raster layers (background, radar) still paint — that is the production bug.
      const { default: workerUrl } = await import(
        "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
      );
      maplibregl.setWorkerUrl(workerUrl);
      if (cancelled || !rootRef.current) return;

      let instance: import("maplibre-gl").Map;
      try {
        instance = new maplibregl.Map({
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
          canvasContextAttributes: { powerPreference: "default" },
        });
      } catch {
        return;
      }
      map = instance;
      mapRef.current = instance;

      onClick = (e) => {
        onPickRef.current(e.lngLat.lat, e.lngLat.lng);
      };
      instance.on("click", onClick);
      onScale = () => {
        if (cancelled) return;
        setScale(scaleBar(instance.getZoom(), instance.getCenter().lat));
      };
      instance.on("moveend", onScale);
      instance.on("zoomend", onScale);
      fitMap(instance);
      requestAnimationFrame(() => fitMap(instance));

      const paintOverlays = () => {
        if (cancelled) return;
        const live = liveRef.current;
        syncRadar(instance, live);
        void syncImgw(instance, live, imgwGenRef);
        syncStrikes(instance, live.strikes);
        if (!readyRef.current) {
          instance.jumpTo({ center: [live.lon, live.lat], zoom: 8.2 });
        }
        readyRef.current = true;
        mapRef.current = instance;
        fitMap(instance);
        draw();
      };

      instance.on("style.load", paintOverlays);
      instance.on("render", draw);
      instance.on("resize", () => {
        sizeCanvas(canvasRef.current, wrapRef.current);
        draw();
      });
      instance.on("error", (ev) => {
        const msg = String((ev as { error?: { message?: string } }).error?.message ?? "");
        if (!shouldFallbackBasemap(msg, readyRef.current) || usedFallback) return;
        usedFallback = true;
        instance.setStyle(ESRI_FALLBACK);
      });
      styleTimer = window.setTimeout(() => {
        if (cancelled || usedFallback || readyRef.current) return;
        usedFallback = true;
        instance.setStyle(ESRI_FALLBACK);
      }, 5000);
    })();

    const ro = new ResizeObserver(() => fitMap(mapRef.current));
    if (wrapRef.current) ro.observe(wrapRef.current);
    const onViewport = () => fitMap(mapRef.current);
    window.visualViewport?.addEventListener("resize", onViewport);

    return () => {
      cancelled = true;
      readyRef.current = false;
      window.clearTimeout(styleTimer);
      ro.disconnect();
      window.visualViewport?.removeEventListener("resize", onViewport);
      if (map && onClick) map.off("click", onClick);
      if (map && onScale) {
        map.off("moveend", onScale);
        map.off("zoomend", onScale);
      }
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.easeTo({
      center: [liveRef.current.lon, liveRef.current.lat],
      duration: cameraDuration(700),
      offset: placeChangeOffset(cameraSheetPx(sheetDetentRef.current)),
    });
    paintOverlay(canvasRef.current, map, liveRef.current, true);
  }, [lat, lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncRadar(map, liveRef.current);
  }, [radarHost, radarPath, overlayUrl, overlayCorners]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    void syncImgw(map, liveRef.current, imgwGenRef);
  }, [imgwOn, imgwDegrees]);

  useEffect(() => {
    paintOverlay(canvasRef.current, mapRef.current, liveRef.current, readyRef.current);
  }, [tracks, threatLevel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncStrikes(map, strikes);
  }, [strikes]);

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
      { padding: sheetFitPadding(cameraSheetPx(sheetDetent)), maxZoom: 8.6, duration: cameraDuration(1000) },
    );
  }, [focus, sheetDetent]);

  return (
    <div ref={wrapRef} className={cn("relative h-full w-full bg-map", className)}>
      <div ref={rootRef} className="h-full w-full" />
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full"
        aria-hidden
      />
      <MapChrome
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
        onLocate={onLocate}
        locatePending={locatePending}
        scale={scale}
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

const IMGW_SRC = "imgw-powiat";
const IMGW_FILL = "imgw-powiat-fill";
const IMGW_LINE = "imgw-powiat-line";
const IMGW_EMPTY: ImgwGeoJSON = { type: "FeatureCollection", features: [] };

function imgwBeforeId(map: import("maplibre-gl").Map): string | undefined {
  if (map.getLayer("radar")) return "radar";
  return labelLayerId(map);
}

function ensureImgwLayers(map: import("maplibre-gl").Map) {
  if (!map.getSource(IMGW_SRC)) {
    map.addSource(IMGW_SRC, { type: "geojson", data: IMGW_EMPTY });
  }
  const before = imgwBeforeId(map);
  if (!map.getLayer(IMGW_FILL)) {
    map.addLayer(
      {
        id: IMGW_FILL,
        type: "fill",
        source: IMGW_SRC,
        paint: {
          "fill-color": IMGW_DEGREE_PAINT.color as unknown as string,
          "fill-opacity": IMGW_DEGREE_PAINT.opacity as unknown as number,
        },
      },
      before,
    );
  }
  if (!map.getLayer(IMGW_LINE)) {
    map.addLayer(
      {
        id: IMGW_LINE,
        type: "line",
        source: IMGW_SRC,
        paint: {
          "line-color": IMGW_DEGREE_PAINT.line as unknown as string,
          "line-width": 0.8,
          "line-opacity": 0.45,
        },
      },
      before,
    );
  }
}

async function syncImgw(
  map: import("maplibre-gl").Map,
  live: Live,
  genRef: { current: number },
) {
  const gen = ++genRef.current;
  const empty = Object.keys(live.imgwDegrees).length === 0 || !live.imgwOn;
  if (empty) {
    if (!map.getStyle() || !map.getSource(IMGW_SRC)) return;
    (map.getSource(IMGW_SRC) as import("maplibre-gl").GeoJSONSource).setData(IMGW_EMPTY);
    if (map.getLayer(IMGW_FILL)) map.setLayoutProperty(IMGW_FILL, "visibility", "none");
    if (map.getLayer(IMGW_LINE)) map.setLayoutProperty(IMGW_LINE, "visibility", "none");
    return;
  }
  const powiaty = await loadPowiatBoundaries();
  if (gen !== genRef.current || !map.getStyle()) return;
  ensureImgwLayers(map);
  const data = tintedPowiatCollection(powiaty, live.imgwDegrees);
  (map.getSource(IMGW_SRC) as import("maplibre-gl").GeoJSONSource).setData(data);
  map.setLayoutProperty(IMGW_FILL, "visibility", "visible");
  map.setLayoutProperty(IMGW_LINE, "visibility", "visible");
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

function strikesGeoJSON(strikes: LightningStrike[], nowMs = Date.now()) {
  return {
    type: "FeatureCollection" as const,
    features: strikes
      .map((s) => {
        const opacity = strikeOpacity(nowMs - s.timeMs);
        if (opacity <= 0) return null;
        return {
          type: "Feature" as const,
          properties: { opacity },
          geometry: { type: "Point" as const, coordinates: [s.lon, s.lat] },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f != null),
  };
}

function syncStrikes(map: import("maplibre-gl").Map, strikes: LightningStrike[]) {
  const data = strikesGeoJSON(strikes);
  const src = map.getSource("strikes") as import("maplibre-gl").GeoJSONSource | undefined;
  if (src) {
    src.setData(data);
    return;
  }
  map.addSource("strikes", { type: "geojson", data });
  map.addLayer({
    id: "strikes",
    type: "circle",
    source: "strikes",
    paint: {
      "circle-radius": 3.4,
      "circle-color": STRIKE,
      "circle-stroke-width": 0.8,
      "circle-stroke-color": INK,
      "circle-opacity": ["get", "opacity"],
    },
  });
}

function syncRadar(map: import("maplibre-gl").Map, live: Live) {
  const id = "radar";
  const layer = pickRadarLayer({
    overlayUrl: live.overlayUrl,
    overlayCorners: live.overlayCorners,
    radarHost: live.radarHost,
    radarPath: live.radarPath,
  });
  const existing = map.getSource(id);
  if (layer.kind === "sri" && existing && existing.type === "image") {
    (existing as import("maplibre-gl").ImageSource).updateImage({
      url: layer.url,
      coordinates: layer.corners,
    });
    if (map.getLayer(id)) {
      map.setLayoutProperty(id, "visibility", "visible");
      map.setPaintProperty(id, "raster-resampling", "nearest");
    }
    return;
  }
  if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(id)) map.removeSource(id);
  if (layer.kind === "none") return;
  if (layer.kind === "sri") {
    map.addSource(id, {
      type: "image",
      url: layer.url,
      coordinates: layer.corners,
    });
  } else {
    map.addSource(id, {
      type: "raster",
      tiles: layer.tiles,
      tileSize: 256,
      scheme: "xyz",
      minzoom: 1,
      maxzoom: 7,
    });
  }
  map.addLayer(
    {
      id,
      type: "raster",
      source: id,
      paint: { "raster-opacity": 0.85, "raster-fade-duration": 0, "raster-resampling": "nearest" },
    },
    labelLayerId(map),
  );
}

function paintOverlay(
  canvas: HTMLCanvasElement | null,
  map: import("maplibre-gl").Map | null,
  live: Live,
  ready: boolean,
) {
  if (!canvas || !map || !ready) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const projected = live.tracks.map((track) => {
    const nowP = map.project([track.now.lon, track.now.lat]);
    const fromP = map.project([track.from.lon, track.from.lat]);
    const soonP = map.project([track.soon.lon, track.soon.lat]);
    return {
      from: { x: fromP.x, y: fromP.y },
      now: { x: nowP.x, y: nowP.y },
      soon: { x: soonP.x, y: soonP.y },
      threatening: track.threatening,
    };
  });
  const pinP = map.project([live.lon, live.lat]);
  drawMapOverlay(ctx, canvas.clientWidth, canvas.clientHeight, projected, {
    x: pinP.x,
    y: pinP.y,
    danger: live.threatLevel === "now",
  });
}
