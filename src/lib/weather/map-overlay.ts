/**
 * Canvas overlay for cell tracks + the user pin.
 * Pin is painted last so tracks never cover it (UI review §4 / 10b#10).
 */

export const INK = "#12171f";
export const AMBER = "#f0a202";
export const CREAM = "#f8f4ee";
export const ACCENT = "#6ec8d4";
export const DANGER = "#e25c4a";
export const WHITE = "#ffffff";

/** 10px accent fill (radius). */
export const PIN_FILL_R = 10;
/** 3px white ring. */
export const PIN_RING_W = 3;
/** ~24px halo (radius). */
export const PIN_HALO_R = 24;
export const PIN_HALO_ALPHA = 0.18;

/** Past track: dashed 2px, no ink. */
export const PAST_WIDTH = 2;
export const PAST_DASH = [6, 5] as const;

export type OverlayPt = { x: number; y: number };

export type OverlayTrack = {
  from: OverlayPt;
  now: OverlayPt;
  soon: OverlayPt;
  threatening: boolean;
};

export type OverlayPin = {
  x: number;
  y: number;
  /** Halo tints danger when the sheet level is `now`. */
  danger: boolean;
};

/** The 2d subset `drawMapOverlay` actually touches — real ctx or a recorder. */
export type OverlayCtx = {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  fill: () => void;
  arc: (x: number, y: number, r: number, start: number, end: number) => void;
  closePath: () => void;
  setLineDash: (segments: number[]) => void;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  fillStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineCap: CanvasLineCap;
  lineJoin: CanvasLineJoin;
  globalAlpha: number;
};

export function drawMapOverlay(
  ctx: OverlayCtx,
  width: number,
  height: number,
  tracks: readonly OverlayTrack[],
  pin: OverlayPin,
): void {
  ctx.clearRect(0, 0, width, height);
  const ordered = [...tracks].sort((a, b) => Number(a.threatening) - Number(b.threatening));
  for (const track of ordered) drawTrack(ctx, track);
  drawPin(ctx, pin);
}

function drawTrack(ctx: OverlayCtx, track: OverlayTrack): void {
  const hot = track.threatening;
  const core = AMBER;
  const outline = hot ? 13 : 10;
  const width = hot ? 6 : 4.5;
  const from = track.from;
  const now = track.now;
  const soon = track.soon;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Past: dashed 2px amber, no ink.
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(now.x, now.y);
  ctx.setLineDash([...PAST_DASH]);
  ctx.strokeStyle = core;
  ctx.lineWidth = PAST_WIDTH;
  ctx.stroke();
  ctx.setLineDash([]);

  // Future: ink outline, then amber core.
  ctx.beginPath();
  ctx.moveTo(now.x, now.y);
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
  ctx.lineTo(soon.x - size * Math.cos(ang - 0.42), soon.y - size * Math.sin(ang - 0.42));
  ctx.lineTo(soon.x - size * Math.cos(ang + 0.42), soon.y - size * Math.sin(ang + 0.42));
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

function drawPin(ctx: OverlayCtx, pin: OverlayPin): void {
  ctx.globalAlpha = PIN_HALO_ALPHA;
  ctx.beginPath();
  ctx.arc(pin.x, pin.y, PIN_HALO_R, 0, Math.PI * 2);
  ctx.fillStyle = pin.danger ? DANGER : ACCENT;
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.beginPath();
  ctx.arc(pin.x, pin.y, PIN_FILL_R, 0, Math.PI * 2);
  ctx.fillStyle = ACCENT;
  ctx.fill();
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = PIN_RING_W;
  ctx.stroke();
}
