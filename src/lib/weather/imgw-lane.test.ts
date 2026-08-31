import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { parseImgwWarsaw } from "./imgw-time.ts";
import type { OfficialWarning } from "./types.ts";
import type { PowiatBoundary } from "./teryt.ts";

function warning(partial: Partial<OfficialWarning>): OfficialWarning {
  return {
    id: "w1",
    event: "Burze z gradem",
    degree: 1,
    probability: 80,
    from: "2026-08-31 14:00:00",
    to: "2026-08-31 22:00:00",
    published: "2026-08-31 10:00:00",
    body: "Burze.",
    office: "IMGW-PIB",
    teryt: ["1261"],
    matchesPlace: true,
    stormRelated: true,
    ...partial,
  };
}

describe("slice 4 reuses Slice 3 polygons", () => {
  it("does not statically import powiaty.json (lazy via teryt)", async () => {
    const src = await readFile(new URL("./imgw-lane.ts", import.meta.url), "utf8");
    assert.equal(/powiaty\.json/.test(src), false);
    const map = await readFile(new URL("../../components/radar-map.tsx", import.meta.url), "utf8");
    assert.match(map, /loadPowiatBoundaries/);
    assert.equal(/powiaty\.json/.test(map), false);
  });
});

describe("readImgwMapToggle", () => {
  it("defaults on and persists a boolean", async () => {
    const { readImgwMapToggle, IMGW_MAP_DEFAULT } = await import("./imgw-lane.ts");
    assert.equal(IMGW_MAP_DEFAULT, true);
    assert.equal(readImgwMapToggle(undefined), true);
    assert.equal(readImgwMapToggle(false), false);
    assert.equal(readImgwMapToggle(true), true);
  });
});

describe("formatImgwLane", () => {
  it("builds the two-lane time-boxed sheet line", async () => {
    const { formatImgwLane } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 12:00:00");
    assert.equal(
      formatImgwLane(warning({}), "powiat Kraków", now),
      "Ostrzeżenie IMGW: burze · dziś 14:00–22:00 · powiat Kraków",
    );
  });

  it("shortens storm event names to burze", async () => {
    const { shortStormEvent } = await import("./imgw-lane.ts");
    assert.equal(shortStormEvent("Burze z gradem"), "burze");
    assert.equal(shortStormEvent("Silny deszcz z burzami"), "burze");
    assert.equal(shortStormEvent("Burza"), "burze");
  });

  it("prefixes a bare county with powiat", async () => {
    const { formatImgwLane } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 12:00:00");
    assert.match(formatImgwLane(warning({}), "wielicki", now), /· powiat wielicki$/);
  });
});

describe("stormWarningDegrees", () => {
  it("maps active storm TERYT codes to the max stopień", async () => {
    const { stormWarningDegrees } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 16:00:00");
    const degrees = stormWarningDegrees(
      [
        warning({ teryt: ["1261", "1206"], degree: 1 }),
        warning({ id: "w2", teryt: ["1261"], degree: 2 }),
      ],
      now,
    );
    assert.equal(degrees["1261"], 2);
    assert.equal(degrees["1206"], 1);
  });

  it("includes today's not-yet-started warning (dziś 14:00 while it is noon)", async () => {
    const { stormWarningDegrees } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 12:00:00");
    const degrees = stormWarningDegrees([warning({ teryt: ["1261"], degree: 1 })], now);
    assert.equal(degrees["1261"], 1);
  });

  it("drops non-storm warnings (upały, mgła)", async () => {
    const { stormWarningDegrees } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 16:00:00");
    const degrees = stormWarningDegrees(
      [warning({ event: "Upał", stormRelated: false, teryt: ["1465"], degree: 2 })],
      now,
    );
    assert.deepEqual(degrees, {});
  });

  it("drops historical (already ended) warnings", async () => {
    const { stormWarningDegrees } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 23:00:00");
    const degrees = stormWarningDegrees([warning({ teryt: ["1261"], degree: 3 })], now);
    assert.deepEqual(degrees, {});
  });

  it("normalizes 6-digit TERYT to the powiat (first 4)", async () => {
    const { stormWarningDegrees } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 16:00:00");
    const degrees = stormWarningDegrees(
      [warning({ teryt: ["1261011"], degree: 1 })],
      now,
    );
    assert.equal(degrees["1261"], 1);
    assert.equal(degrees["1261011"], undefined);
  });
});

describe("tintedPowiatCollection", () => {
  const square: PowiatBoundary = {
    t: "1261",
    n: "Kraków",
    b: [19, 50, 20, 51],
    g: [
      [
        [
          [19, 50],
          [20, 50],
          [20, 51],
          [19, 51],
          [19, 50],
        ],
      ],
    ],
  };
  const other: PowiatBoundary = {
    t: "1206",
    n: "krakowski",
    b: [19, 49, 21, 51],
    g: [
      [
        [
          [19, 49],
          [21, 49],
          [21, 51],
          [19, 51],
          [19, 49],
        ],
      ],
    ],
  };

  it("includes only powiats that have an active storm tint", async () => {
    const { tintedPowiatCollection } = await import("./imgw-lane.ts");
    const fc = tintedPowiatCollection([square, other], { "1261": 2 });
    assert.equal(fc.type, "FeatureCollection");
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]?.properties?.t, "1261");
    assert.equal(fc.features[0]?.properties?.degree, 2);
    assert.equal(fc.features[0]?.geometry.type, "Polygon");
  });

  it("does not invent per-gmina features", async () => {
    const { tintedPowiatCollection } = await import("./imgw-lane.ts");
    const fc = tintedPowiatCollection([square], { "1261011": 1, "1261": 1 });
    assert.equal(fc.features.length, 1);
    assert.equal(fc.features[0]?.properties?.t, "1261");
  });
});

describe("localImgwLane", () => {
  it("uses the matching place warning, not a national leftover", async () => {
    const { localImgwLane } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 12:00:00");
    const line = localImgwLane(
      [
        warning({ id: "other", matchesPlace: false, teryt: ["1465"] }),
        warning({ matchesPlace: true, teryt: ["1261"] }),
      ],
      "powiat Kraków",
      now,
    );
    assert.equal(line, "Ostrzeżenie IMGW: burze · dziś 14:00–22:00 · powiat Kraków");
  });

  it("is null when no local storm warning is active", async () => {
    const { localImgwLane } = await import("./imgw-lane.ts");
    const now = parseImgwWarsaw("2026-08-31 12:00:00");
    assert.equal(
      localImgwLane([warning({ matchesPlace: false, stormRelated: true })], "Warszawa", now),
      null,
    );
  });
});
