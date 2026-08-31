import { packSamples } from "./pack.ts";
import type { RadarFrameMeta, RadarLevel, RadarSample, RadarScan } from "./types.ts";

export type AnalysisSource = "sri" | "rainviewer";

export type SampledFrame = {
  time: number;
  samples: RadarSample[];
  maxLevel: RadarLevel;
  nearestKm: null;
  cellKm: number;
  complete: boolean;
};

export type RainViewerMaps = {
  version: string;
  generated: number;
  host: string;
  radar: { past: RadarFrameMeta[]; nowcast: RadarFrameMeta[] };
};

export type AnalysisLoaders = {
  loadSri: () => Promise<SampledFrame[]>;
  /** Cheap weather-maps.json — overlay host + past[], not analysis tiles. */
  getMaps: () => Promise<RainViewerMaps>;
  loadRainViewerFrames: (maps: RainViewerMaps) => Promise<SampledFrame[]>;
};

function framesToScan(
  frames: SampledFrame[],
  source: AnalysisSource,
  maps: RainViewerMaps | null,
): RadarScan {
  const latest = frames.at(-1);
  const before = frames.length >= 2 ? frames.at(-2) : undefined;
  const past =
    maps?.radar.past ??
    frames.map((f) => ({ time: f.time, path: "" }));
  return {
    host: maps?.host ?? "",
    generated: maps?.generated ?? latest?.time ?? 0,
    latestTime: latest?.time ?? null,
    past,
    nowcast: maps?.radar.nowcast ?? [],
    samples: [],
    prevSamples: [],
    prevTime: before?.time ?? null,
    history: frames.map(({ time, samples, maxLevel, nearestKm, complete }) => ({
      time,
      samples: [],
      packed: packSamples(samples),
      maxLevel,
      nearestKm,
      degraded: !complete,
    })),
    maxLevel: latest?.maxLevel ?? 0,
    nearestKm: latest?.nearestKm ?? null,
    echoCount: latest?.samples.length ?? 0,
    cellKm: latest?.cellKm ?? 3,
    analysisSource: source,
  };
}

export async function resolveAnalysis(loaders: AnalysisLoaders): Promise<{
  source: AnalysisSource;
  frames: SampledFrame[];
  maps: RainViewerMaps | null;
  scan: RadarScan;
}> {
  const sriResult = await loaders.loadSri().then(
    (frames) => ({ ok: true as const, frames }),
    (err: unknown) => ({ ok: false as const, err }),
  );
  if (sriResult.ok && sriResult.frames.length > 0) {
    const mapsResult = await loaders.getMaps().then(
      (maps) => ({ ok: true as const, maps }),
      () => ({ ok: false as const }),
    );
    const maps = mapsResult.ok ? mapsResult.maps : null;
    return {
      source: "sri",
      frames: sriResult.frames,
      maps,
      scan: framesToScan(sriResult.frames, "sri", maps),
    };
  }

  try {
    const maps = await loaders.getMaps();
    const frames = await loaders.loadRainViewerFrames(maps);
    return {
      source: "rainviewer",
      frames,
      maps,
      scan: framesToScan(frames, "rainviewer", maps),
    };
  } catch (err) {
    if (!sriResult.ok) throw sriResult.err instanceof Error ? sriResult.err : err;
    throw err;
  }
}
