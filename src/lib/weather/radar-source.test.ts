import assert from "node:assert/strict";
import test from "node:test";
import { resolveAnalysis } from "./radar-source.ts";
import type { SampledFrame } from "./radar-source.ts";
import { POLCOMP_SRI_GRID } from "./sri.ts";
import { rememberSriOverlay, resetSriOverlayCache } from "./sri-overlay-png.ts";

function frame(time: number): SampledFrame {
  return {
    time,
    samples: [{ lat: 50.06, lon: 19.94, level: 3, rate: 6 }],
    maxLevel: 3,
    nearestKm: null,
    cellKm: 3,
    complete: true,
  };
}

const maps = {
  version: "2",
  generated: 1_700_000_000,
  host: "https://tilecache.rainviewer.com",
  radar: { past: [{ time: 1_700_000_000, path: "/v2/radar/1700000000" }], nowcast: [] },
};

test("SRI frames win when the datastore listing decodes", async () => {
  const sri = [frame(1_700_000_300), frame(1_700_000_600)];
  let decodedTiles = 0;
  const out = await resolveAnalysis({
    loadSri: async () => sri,
    getMaps: async () => maps,
    loadRainViewerFrames: async () => {
      decodedTiles++;
      return [frame(1_700_000_000)];
    },
  });
  assert.equal(out.source, "sri");
  assert.equal(out.frames.at(-1)?.time, 1_700_000_600);
  assert.equal(out.maps?.host, maps.host);
  assert.equal(out.scan.analysisSource, "sri");
  assert.equal(out.scan.latestTime, 1_700_000_600);
  assert.equal(out.scan.echoCount, 1);
  assert.equal(out.scan.past.at(-1)?.time, 1_700_000_000);
  assert.equal(decodedTiles, 0);
  assert.equal(out.scan.cellKm, 3, "packed analysis field stays 3 km");
  assert.equal(out.scan.history[0]!.cellKm, 3);
  assert.equal(out.scan.history[0]!.nccCellKm, 2, "SRI motion NCC is 2 km");
});

test("datastore outage falls back to RainViewer tiles", async () => {
  const out = await resolveAnalysis({
    loadSri: async () => {
      throw new Error("404 https://danepubliczne.imgw.pl/pl/datastore/getFilesList");
    },
    getMaps: async () => maps,
    loadRainViewerFrames: async () => [frame(1_700_000_000)],
  });
  assert.equal(out.source, "rainviewer");
  assert.equal(out.scan.analysisSource, "rainviewer");
  assert.equal(out.scan.latestTime, 1_700_000_000);
  assert.equal(out.scan.host, maps.host);
  assert.equal(out.scan.history[0]!.nccCellKm, undefined, "RainViewer keeps pack-scale NCC");
});

test("empty SRI listing is an outage and falls back", async () => {
  const out = await resolveAnalysis({
    loadSri: async () => [],
    getMaps: async () => maps,
    loadRainViewerFrames: async () => [frame(1_700_000_000)],
  });
  assert.equal(out.source, "rainviewer");
  assert.equal(out.scan.latestTime, 1_700_000_000);
});

test("SRI scan carries overlay meta when the field was remembered", async () => {
  resetSriOverlayCache();
  const grid = { ...POLCOMP_SRI_GRID, nx: 2, ny: 2 };
  const data = new Float32Array(4).fill(2);
  rememberSriOverlay(1_700_000_600, data, grid);
  const out = await resolveAnalysis({
    loadSri: async () => [frame(1_700_000_600)],
    getMaps: async () => maps,
    loadRainViewerFrames: async () => {
      throw new Error("should not decode tiles");
    },
  });
  assert.equal(out.scan.overlay?.time, 1_700_000_600);
  assert.equal(out.scan.overlays?.length, 1);
  assert.equal(out.scan.overlay?.corners.length, 4);
});

test("SRI still serves analysis when RainViewer maps fail", async () => {
  const sri = [frame(1_700_000_300)];
  const out = await resolveAnalysis({
    loadSri: async () => sri,
    getMaps: async () => {
      throw new Error("404 https://api.rainviewer.com/public/weather-maps.json");
    },
    loadRainViewerFrames: async () => {
      throw new Error("should not decode tiles");
    },
  });
  assert.equal(out.source, "sri");
  assert.equal(out.scan.latestTime, 1_700_000_300);
  assert.equal(out.scan.host, "");
});

test("both sources down throw so loadSnapshot can mark radarUnavailable", async () => {
  await assert.rejects(
    () =>
      resolveAnalysis({
        loadSri: async () => {
          throw new Error("timeout");
        },
        getMaps: async () => {
          throw new Error("timeout");
        },
        loadRainViewerFrames: async () => {
          throw new Error("timeout");
        },
      }),
    /timeout/,
  );
});
