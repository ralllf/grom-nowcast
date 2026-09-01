import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { readTracksMapToggle, TRACKS_MAP_DEFAULT, tracksForMap } from "./tracks-map.ts";

const SAMPLE = [{ id: "a" }, { id: "b" }];

test("fresh settings: tracks overlay off", () => {
  assert.equal(TRACKS_MAP_DEFAULT, false);
  assert.equal(readTracksMapToggle(undefined), false);
  assert.equal(readTracksMapToggle(null), false);
  assert.equal(readTracksMapToggle("yes"), false);
  assert.equal(readTracksMapToggle(true), true);
  assert.equal(readTracksMapToggle(false), false);
});

test("map draw path is empty until the chip is on", () => {
  assert.deepEqual(tracksForMap(SAMPLE, false), []);
  assert.deepEqual(tracksForMap(SAMPLE, true), SAMPLE);
  assert.deepEqual(tracksForMap([], true), []);
});

test("grom-app gates RadarMap through tracksForMap; chip is aria-pressed", async () => {
  const src = await readFile(new URL("../../components/grom-app.tsx", import.meta.url), "utf8");
  assert.match(src, /tracksForMap\(/);
  assert.match(src, /tracks=\{mapTracks\}/);
  assert.match(src, /aria-pressed=\{tracksMap\}/);
  assert.match(src, /tor komórki/);
  assert.match(src, /pokaż/);
});
