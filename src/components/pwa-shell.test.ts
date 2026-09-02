import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const ROOT_TSX = readFileSync(join(HERE, "../routes/__root.tsx"), "utf8");
const CSS = readFileSync(join(ROOT, "src/styles.css"), "utf8");
const MAP = readFileSync(join(HERE, "radar-map.tsx"), "utf8");
const DELIVERY = readFileSync(join(ROOT, "src/lib/alert-delivery.ts"), "utf8");
const TREND = readFileSync(join(ROOT, "src/lib/weather/trend.ts"), "utf8");
const PKG = readFileSync(join(ROOT, "package.json"), "utf8");

describe("PWA manifest (§9 / 10b#12)", () => {
  it("ships manifest.json and links it from the document head", () => {
    const manifestPath = join(ROOT, "public/manifest.json");
    assert.ok(existsSync(manifestPath), "missing public/manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      name?: string;
      short_name?: string;
      start_url?: string;
      display?: string;
      theme_color?: string;
      icons?: Array<{ purpose?: string; src?: string }>;
    };
    assert.equal(manifest.name, "GROM");
    assert.equal(manifest.short_name, "GROM");
    assert.equal(manifest.start_url, "/");
    assert.equal(manifest.display, "standalone");
    assert.equal(manifest.theme_color, "#e8edf2");
    assert.ok(
      manifest.icons?.some((icon) => String(icon.purpose).includes("maskable")),
      "missing maskable icon",
    );
    assert.match(ROOT_TSX, /rel:\s*"manifest"/);
    assert.match(ROOT_TSX, /href:\s*"\/manifest\.json"/);
  });

  it("theme-color matches the light map, not ink", () => {
    assert.match(ROOT_TSX, /name:\s*"theme-color"/);
    assert.match(ROOT_TSX, /content:\s*"#e8edf2"/);
    assert.doesNotMatch(ROOT_TSX, /content:\s*"#07090c"/);
  });

  it("ships a bolt-on-ink maskable icon (svg + png)", () => {
    assert.ok(existsSync(join(ROOT, "public/icon.svg")), "missing public/icon.svg");
    assert.ok(existsSync(join(ROOT, "public/icon-192.png")), "missing public/icon-192.png");
    assert.ok(existsSync(join(ROOT, "public/icon-512.png")), "missing public/icon-512.png");
    const svg = readFileSync(join(ROOT, "public/icon.svg"), "utf8");
    assert.match(svg, /#07090[cC]/);
    assert.match(svg, /#6[eE][cC]8[dD]4/);
    const png = readFileSync(join(ROOT, "public/icon-512.png"));
    assert.equal(png[0], 0x89);
    assert.equal(png[1], 0x50);
    assert.equal(png[2], 0x4e);
    assert.equal(png[3], 0x47);
  });
});

describe("prefers-reduced-motion (§7 Motion / 10b#12)", () => {
  it("CSS drops backdrop-blur when the user asks for less motion", () => {
    assert.match(CSS, /prefers-reduced-motion:\s*reduce/);
    assert.match(CSS, /backdrop-filter:\s*none/);
  });

  it("easeTo and fitBounds take a reduced-motion duration", () => {
    assert.match(MAP, /cameraDuration\(/);
    assert.match(MAP, /duration:\s*cameraDuration\(/);
  });

  it("tab-title flash is skipped when reduced motion is on", () => {
    assert.match(DELIVERY, /prefersReducedMotion/);
    assert.match(DELIVERY, /titleFlashIntervalMs/);
  });

  it("cameraDuration snaps to 0 under reduced motion", async () => {
    const { cameraDuration, titleFlashIntervalMs } = await import("../lib/reduced-motion.ts");
    assert.equal(cameraDuration(700, false), 700);
    assert.equal(cameraDuration(1000, false), 1000);
    assert.equal(cameraDuration(700, true), 0);
    assert.equal(cameraDuration(1000, true), 0);
    assert.equal(titleFlashIntervalMs(false), 1500);
    assert.equal(titleFlashIntervalMs(true), null);
  });
});

describe("PWA fences", () => {
  it("does not add workbox or claim a full offline nowcast", () => {
    assert.doesNotMatch(PKG, /workbox/);
    const sw = existsSync(join(ROOT, "public/sw.js"))
      ? readFileSync(join(ROOT, "public/sw.js"), "utf8")
      : "";
    assert.doesNotMatch(sw, /nowcast|offline/i);
    assert.doesNotMatch(ROOT_TSX, /serviceWorker|navigator\.serviceWorker/i);
  });

  it("GROWTH_MATH_ENABLED stays false", () => {
    assert.match(TREND, /export const GROWTH_MATH_ENABLED = false/);
  });
});
