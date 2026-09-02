import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  ACCENT,
  AMBER,
  DANGER,
  INK,
  PAST_DASH,
  PAST_WIDTH,
  PIN_FILL_R,
  PIN_HALO_R,
  PIN_RING_W,
  WHITE,
  drawMapOverlay,
  type OverlayCtx,
  type OverlayTrack,
} from "./map-overlay.ts";

type Op = {
  op: string;
  x?: number;
  y?: number;
  r?: number;
  strokeStyle?: string;
  fillStyle?: string;
  lineWidth?: number;
  dash?: number[];
  globalAlpha?: number;
};

function recorder(): OverlayCtx & { ops: Op[]; _dash: number[] } {
  const rec = {
    ops: [] as Op[],
    _dash: [] as number[],
    strokeStyle: "#000",
    fillStyle: "#000",
    lineWidth: 1,
    lineCap: "butt" as CanvasLineCap,
    lineJoin: "miter" as CanvasLineJoin,
    globalAlpha: 1,
    clearRect() {
      this.ops.push({ op: "clearRect" });
    },
    beginPath() {
      this.ops.push({ op: "beginPath" });
    },
    moveTo(x: number, y: number) {
      this.ops.push({ op: "moveTo", x, y });
    },
    lineTo(x: number, y: number) {
      this.ops.push({ op: "lineTo", x, y });
    },
    stroke() {
      this.ops.push({
        op: "stroke",
        strokeStyle: String(this.strokeStyle),
        lineWidth: this.lineWidth,
        dash: [...this._dash],
      });
    },
    fill() {
      this.ops.push({
        op: "fill",
        fillStyle: String(this.fillStyle),
        globalAlpha: this.globalAlpha,
      });
    },
    arc(x: number, y: number, r: number) {
      this.ops.push({ op: "arc", x, y, r });
    },
    closePath() {
      this.ops.push({ op: "closePath" });
    },
    setLineDash(segments: number[]) {
      this._dash = [...segments];
      this.ops.push({ op: "setLineDash", dash: [...segments] });
    },
  };
  return rec;
}

const TRACK: OverlayTrack = {
  from: { x: 10, y: 80 },
  now: { x: 80, y: 80 },
  soon: { x: 160, y: 80 },
  threatening: true,
};

test("pin constants match §4 / 10b#10 (10px fill, 3px ring, 24px halo)", () => {
  assert.equal(PIN_FILL_R, 10);
  assert.equal(PIN_RING_W, 3);
  assert.equal(PIN_HALO_R, 24);
  assert.equal(ACCENT, "#6ec8d4");
  assert.equal(DANGER, "#e25c4a");
  assert.equal(WHITE, "#ffffff");
});

test("past segment is a dashed 2px line; ink outline is future-only", () => {
  const ctx = recorder();
  drawMapOverlay(ctx, 200, 200, [TRACK], { x: 100, y: 40, danger: false });

  const strokes = ctx.ops.filter((o) => o.op === "stroke");
  const dashed = strokes.find((o) => (o.dash?.length ?? 0) > 0);
  assert.ok(dashed, "expected a dashed stroke for the past segment");
  assert.equal(dashed.lineWidth, PAST_WIDTH);
  assert.equal(dashed.lineWidth, 2);
  assert.deepEqual(dashed.dash, [...PAST_DASH]);
  assert.equal(dashed.strokeStyle, AMBER);

  const futureInk = strokes.find((o) => o.strokeStyle === INK && (o.dash?.length ?? 0) === 0 && (o.lineWidth ?? 0) >= 10);
  assert.ok(futureInk, "expected an ink outline on the future segment");
  assert.equal(futureInk.lineWidth, 13);

  const pastInk = strokes.find(
    (o) => o.strokeStyle === INK && (o.dash?.length ?? 0) > 0,
  );
  assert.equal(pastInk, undefined, "past segment must not carry an ink outline");
});

test("pin is painted last — halo, then accent fill + white ring — above tracks", () => {
  const ctx = recorder();
  drawMapOverlay(ctx, 200, 200, [TRACK], { x: 100, y: 40, danger: false });

  const arcs = ctx.ops.filter((o) => o.op === "arc");
  assert.ok(arcs.length >= 3, "track now-dot + pin halo + pin fill");

  const pinHalo = [...arcs].reverse().find((o) => o.r === PIN_HALO_R);
  const pinFill = [...arcs].reverse().find((o) => o.r === PIN_FILL_R);
  assert.ok(pinHalo && pinFill, "expected pin halo and fill arcs");
  assert.equal(pinHalo.x, 100);
  assert.equal(pinHalo.y, 40);
  assert.equal(pinFill.x, 100);
  assert.equal(pinFill.y, 40);

  const lastTrackArc = [...arcs].reverse().find((o) => o.r !== PIN_HALO_R && o.r !== PIN_FILL_R);
  assert.ok(lastTrackArc);
  const haloIdx = ctx.ops.indexOf(pinHalo);
  const fillIdx = ctx.ops.indexOf(pinFill);
  const trackIdx = ctx.ops.indexOf(lastTrackArc);
  assert.ok(haloIdx > trackIdx, "pin halo after the last track glyph");
  assert.ok(fillIdx > haloIdx, "pin fill after halo");

  const pinFills = ctx.ops.filter((o) => o.op === "fill" && ctx.ops.indexOf(o) >= haloIdx);
  const haloFill = pinFills.find((o) => o.fillStyle === ACCENT || o.fillStyle === DANGER);
  assert.ok(haloFill);
  assert.equal(haloFill.fillStyle, ACCENT);

  const ring = [...ctx.ops].reverse().find((o) => o.op === "stroke" && o.strokeStyle === WHITE);
  assert.ok(ring, "expected a white ring on the pin");
  assert.equal(ring.lineWidth, PIN_RING_W);
});

test("halo tints danger only when the sheet level is now", () => {
  const calm = recorder();
  drawMapOverlay(calm, 200, 200, [], { x: 50, y: 50, danger: false });
  const calmHalo = calm.ops.find((o) => o.op === "fill" && o.fillStyle === ACCENT && (o.globalAlpha ?? 1) < 1);
  assert.ok(calmHalo, "calm halo is accent");
  assert.equal(
    calm.ops.some((o) => o.op === "fill" && o.fillStyle === DANGER),
    false,
  );

  const now = recorder();
  drawMapOverlay(now, 200, 200, [], { x: 50, y: 50, danger: true });
  const dangerHalo = now.ops.find((o) => o.op === "fill" && o.fillStyle === DANGER);
  assert.ok(dangerHalo, "now-level halo is danger");
  const nowFill = [...now.ops].reverse().find((o) => o.op === "fill" && o.fillStyle === ACCENT);
  assert.ok(nowFill, "fill stays accent even at now");
});

test("radar-map paints the canvas overlay last: tracks then pin; no MapLibre 6px you-dot", async () => {
  const map = await readFile(new URL("../../components/radar-map.tsx", import.meta.url), "utf8");
  const app = await readFile(new URL("../../components/grom-app.tsx", import.meta.url), "utf8");

  assert.match(map, /drawMapOverlay\(/);
  assert.match(map, /danger:\s*live\.threatLevel\s*===\s*"now"/);
  assert.doesNotMatch(map, /you-halo/);
  assert.doesNotMatch(map, /you-dot/);
  assert.doesNotMatch(map, /"circle-radius": 6/);
  assert.doesNotMatch(map, /"circle-radius": 14/);

  const overlayIdx = map.indexOf("drawMapOverlay(");
  const tracksProject = map.indexOf("live.tracks");
  assert.ok(overlayIdx > 0 && tracksProject > 0);
  // Pin project happens in the same paint; pin must not be a MapLibre layer under the canvas.
  assert.match(map, /project\(\[live\.lon,\s*live\.lat\]\)/);

  assert.match(app, /threatLevel=\{threat\?\.level/);
});
