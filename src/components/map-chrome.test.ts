import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { MAP_CREDIT, scaleBar } from "./map-chrome-logic.ts";
import { LEVEL_SWATCH } from "../lib/weather/palette.ts";
import { SHEET_PEEK_PX } from "./threat-sheet-logic.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const MAP = readFileSync(join(HERE, "radar-map.tsx"), "utf8");
const APP = readFileSync(join(HERE, "grom-app.tsx"), "utf8");
const CHROME_PATH = join(HERE, "map-chrome.tsx");
const LOGIC_PATH = join(HERE, "map-chrome-logic.ts");
const CHROME = existsSync(CHROME_PATH) ? readFileSync(CHROME_PATH, "utf8") : "";
const LOGIC = existsSync(LOGIC_PATH) ? readFileSync(LOGIC_PATH, "utf8") : "";
const ON_MAP = MAP + CHROME + LOGIC;

describe("map chrome zoom (§4 / 10b#7)", () => {
  it("wires zoom + and − buttons on the map", () => {
    assert.ok(/aria-label="Przybliż"/.test(ON_MAP), "missing Przybliż zoom button");
    assert.ok(/aria-label="Oddal"/.test(ON_MAP), "missing Oddal zoom button");
  });
});

describe("map chrome attribution (§4 / 10b#7)", () => {
  it("does not fully disable attribution without a visible OpenFreeMap/OSM credit", () => {
    const attributionOff = /attributionControl:\s*false/.test(MAP);
    const compactOn = /attributionControl:\s*(?:true|\{[^}]*compact)/.test(MAP);
    // Sheet footer already names OpenFreeMap/OSM, but that line is under the peek fold.
    // Credit must be on the map chrome (or MapLibre attribution must be on).
    const visibleOnMap =
      /OpenFreeMap\s*[·\/]\s*OSM/.test(ON_MAP) && /MAP_CREDIT/.test(CHROME);
    if (attributionOff && !compactOn) {
      assert.ok(
        visibleOnMap,
        "attributionControl is false and no on-map OpenFreeMap/OSM credit is wired",
      );
    }
    assert.equal(MAP_CREDIT, "OpenFreeMap / OSM");
  });
});

describe("map chrome locate + legend", () => {
  it("puts an on-map locate button next to zoom", () => {
    assert.ok(/aria-label="Wybierz lokalizację"/.test(CHROME), "missing on-map locate");
    assert.match(APP, /onLocate=\{locate\}/);
  });

  it("paints four rain swatches plus a track glyph", () => {
    assert.match(CHROME, /aria-label="Legenda opadu"/);
    assert.match(CHROME, /RAIN_LEVELS = \[1, 2, 3, 4\]/);
    assert.match(CHROME, /LEVEL_SWATCH\[level\]/);
    assert.equal(LEVEL_SWATCH[1], "#36bae5");
    assert.equal(LEVEL_SWATCH[2], "#005b8e");
    assert.equal(LEVEL_SWATCH[3], "#e8b400");
    assert.equal(LEVEL_SWATCH[4], "#e62800");
    assert.match(CHROME, /#f0a202/);
  });
});

describe("map chrome scale", () => {
  it("picks a nice metric length near 64 px at the default Warsaw view", () => {
    const bar = scaleBar(8.2, 52.2297);
    assert.equal(bar.label, "20 km");
    assert.ok(bar.widthPx >= 48 && bar.widthPx <= 80, `widthPx ${bar.widthPx}`);
  });
});

describe("map chrome fences", () => {
  it("leaves the radar time slider at top-24", () => {
    assert.match(APP, /absolute inset-x-0 top-24/);
    assert.match(APP, /aria-label="Czas radaru"/);
  });

  it("stacks chrome above the 128 px peek, not under the sheet", () => {
    assert.equal(SHEET_PEEK_PX, 128);
    assert.match(CHROME, /128px/);
    assert.match(CHROME, /data-peek=\{SHEET_PEEK_PX\}/);
  });
});
